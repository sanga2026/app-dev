import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEntity, AccountStatus } from './entities/account.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { NumberRangeService } from '../number-ranges/number-range.service';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';
import {
  CreateAccountDto, UpdateAccountDto, UpdateAccountStatusDto, CreateTransactionDto,
} from './dto/account.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly repo: Repository<AccountEntity>,
    @InjectRepository(TransactionEntity)
    private readonly txnRepo: Repository<TransactionEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly nrService: NumberRangeService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private assertScope(user: UserEntity, bankId: string, branchId?: string) {
    if (user.roleType === UserRole.SUPER_ADMIN) return;
    if (user.bankId !== bankId)
      throw new ForbiddenException('Access Denied: Cross-bank operation not allowed.');
    if (branchId && user.branchId && user.branchId !== branchId)
      throw new ForbiddenException('Access Denied: Cross-branch operation not allowed.');
  }

  private async assertCustomerExists(bankId: string, branchId: string, customerId: string) {
    const c = await this.customerRepo.findOne({
      where: { id: customerId, bankId, branchId },
    });
    if (!c) throw new NotFoundException(`Customer not found in this branch.`);
    return c;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(
    bankId: string, branchId: string, customerId: string,
    user: UserEntity,
  ): Promise<AccountEntity[]> {
    this.assertScope(user, bankId);
    await this.assertCustomerExists(bankId, branchId, customerId);
    return this.repo.find({
      where: { bankId, branchId, customerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    bankId: string, branchId: string, customerId: string,
    accountId: string, user: UserEntity,
  ): Promise<AccountEntity> {
    this.assertScope(user, bankId);
    const account = await this.repo.findOne({
      where: { id: accountId, bankId, branchId, customerId },
      relations: ['branch', 'customer'],
    });
    if (!account) throw new NotFoundException('Account not found.');
    return account;
  }

  async create(
    bankId: string, branchId: string, customerId: string,
    dto: CreateAccountDto, user: UserEntity,
  ): Promise<AccountEntity> {
    this.assertScope(user, bankId);
    const customer = await this.assertCustomerExists(bankId, branchId, customerId);

    // Generate account number from number range (SAVINGS type)
    const accountNumberType = `ACCOUNT_${dto.accountType}`;
    let accountNumber: string;
    try {
      accountNumber = await this.nrService.getNextNumber(bankId, accountNumberType);
    } catch {
      // Fallback: try generic SAVINGS range or generate one
      try {
        accountNumber = await this.nrService.getNextNumber(bankId, 'SAVINGS');
      } catch {
        // Last resort: timestamp-based number
        accountNumber = `${Date.now()}`.slice(-14);
      }
    }

    // Inherit IFSC + MICR from branch
    const account = this.repo.create({
      ...dto,
      accountNumber,
      bankId,
      branchId,
      customerId,
      currency:       dto.currency ?? customer.metadata?.['currency'] ?? 'INR',
      currentBalance: 0,
      availableBalance: 0,
      lienAmount: 0,
      openedAt: dto.openedAt ? new Date(dto.openedAt) : new Date(),
      createdBy: user.id,
      updatedBy: user.id,
    });

    const saved = await this.repo.save(account);
    this.logger.log(`[ACCOUNT_OPENED] ${saved.accountNumber} (${saved.accountType}) for Customer ${customerId} by ${user.email}`);
    return saved;
  }

  async update(
    bankId: string, branchId: string, customerId: string,
    accountId: string, dto: UpdateAccountDto, user: UserEntity,
  ): Promise<AccountEntity> {
    this.assertScope(user, bankId);
    const account = await this.findOne(bankId, branchId, customerId, accountId, user);

    if (account.status === AccountStatus.CLOSED)
      throw new BadRequestException('Cannot modify a closed account.');

    Object.assign(account, { ...dto, updatedBy: user.id });
    return this.repo.save(account);
  }

  async updateStatus(
    bankId: string, branchId: string, customerId: string,
    accountId: string, dto: UpdateAccountStatusDto, user: UserEntity,
  ): Promise<AccountEntity> {
    this.assertScope(user, bankId);
    const account = await this.findOne(bankId, branchId, customerId, accountId, user);

    if (account.status === AccountStatus.CLOSED && dto.status !== AccountStatus.CLOSED)
      throw new BadRequestException('Cannot reopen a closed account.');

    account.status            = dto.status;
    account.statusReasonCode  = dto.statusReasonCode ?? null;
    account.freezeReference   = dto.freezeReference  ?? null;
    account.updatedBy         = user.id;

    if (dto.status === AccountStatus.CLOSED) {
      account.closedAt = new Date();
    }

    const saved = await this.repo.save(account);
    this.logger.warn(`[ACCOUNT_STATUS] ${account.accountNumber} → ${dto.status} by ${user.email}`);
    return saved;
  }

  async remove(
    bankId: string, branchId: string, customerId: string,
    accountId: string, user: UserEntity,
  ): Promise<{ message: string }> {
    this.assertScope(user, bankId);
    const account = await this.findOne(bankId, branchId, customerId, accountId, user);

    if (account.currentBalance !== 0)
      throw new BadRequestException('Cannot delete an account with non-zero balance. Close it first.');
    if (account.status !== AccountStatus.CLOSED)
      throw new BadRequestException('Account must be CLOSED before deletion.');

    await this.repo.remove(account);
    this.logger.warn(`[ACCOUNT_DELETED] ${account.accountNumber} deleted by ${user.email}`);
    return { message: `Account ${account.accountNumber} deleted.` };
  }

  async postTransaction(
    bankId: string, branchId: string, customerId: string,
    accountId: string, dto: CreateTransactionDto, user: UserEntity,
  ): Promise<TransactionEntity> {
    this.assertScope(user, bankId);
    const account = await this.findOne(bankId, branchId, customerId, accountId, user);

    if (account.status !== AccountStatus.ACTIVE)
      throw new BadRequestException(`Cannot transact on an account with status: ${account.status}.`);

    const amount = Number(dto.amount);

    if (dto.type === 'DEBIT') {
      if (amount > Number(account.availableBalance))
        throw new BadRequestException(
          `Insufficient balance. Available: ₹${account.availableBalance}, Requested: ₹${amount}.`
        );
      account.currentBalance   = Number((Number(account.currentBalance)   - amount).toFixed(2));
      account.availableBalance = Number((Number(account.availableBalance) - amount).toFixed(2));
    } else {
      account.currentBalance   = Number((Number(account.currentBalance)   + amount).toFixed(2));
      account.availableBalance = Number((Number(account.availableBalance) + amount).toFixed(2));
    }

    account.lastTransactionDate = new Date();
    account.updatedBy = user.id;
    await this.repo.save(account);

    const txn = new TransactionEntity();
    txn.accountId              = accountId;
    txn.bankId                 = bankId;
    txn.type                   = dto.type as any;
    txn.amount                 = amount;
    txn.note                   = dto.note ?? null;
    txn.reference              = dto.reference ?? null;
    txn.runningBalanceSnapshot = account.currentBalance;
    txn.createdBy              = user.id;
    txn.updatedBy              = user.id;

    const saved = await this.txnRepo.save(txn);
    this.logger.log(
      `[TXN] ${dto.type} ₹${amount} on ${account.accountNumber} by ${user.email} | Bal: ${account.currentBalance}`
    );
    return saved;
  }
}
