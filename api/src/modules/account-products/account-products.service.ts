import {
  Injectable, NotFoundException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { AccountProductEntity, ProductCategory } from './entities/account-product.entity';
import { AccountType } from '../accounting/entities/account.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';
import {
  CreateAccountProductDto, UpdateAccountProductDto,
} from './dto/account-product.dto';

// Which AccountType values belong to LOAN vs DEPOSIT
const LOAN_TYPES: AccountType[] = [
  AccountType.HOME_LOAN, AccountType.PERSONAL_LOAN, AccountType.AUTO_LOAN,
  AccountType.GOLD_LOAN, AccountType.EDUCATION_LOAN,
  AccountType.CASH_CREDIT, AccountType.OVERDRAFT,
];

@Injectable()
export class AccountProductsService {
  private readonly logger = new Logger(AccountProductsService.name);

  constructor(
    @InjectRepository(AccountProductEntity)
    private readonly repo: Repository<AccountProductEntity>,
  ) {}

  private assertScope(user: UserEntity, bankId: string) {
    if (user.roleType === UserRole.SUPER_ADMIN) return;
    if (user.bankId !== bankId)
      throw new ForbiddenException('Access Denied: Not your bank.');
  }

  /** Derive ProductCategory from AccountType */
  private deriveCategory(accountType: AccountType): ProductCategory {
    return LOAN_TYPES.includes(accountType)
      ? ProductCategory.LOAN
      : ProductCategory.DEPOSIT;
  }

  /**
   * Auto-generate productCode from accountType + accountSubtype.
   * Format: SAVINGS | PERSONAL_LOAN | PERSONAL_LOAN_SALARY | PERSONAL_LOAN_2
   * Appends _2, _3 … if the base code is already taken by this bank.
   */
  private async generateProductCode(
    bankId: string,
    accountType: string,
    accountSubtype?: string,
  ): Promise<string> {
    const base = accountSubtype
      ? `${accountType}_${accountSubtype.toUpperCase().replace(/\s+/g, '_')}`
      : accountType;

    // Check if base code is free
    const existing = await this.repo.findOne({ where: { bankId, productCode: base } });
    if (!existing) return base;

    // Find next available suffix
    const withPrefix = await this.repo.find({
      where: { bankId, productCode: Like(`${base}_%`) },
      select: ['productCode'],
    });
    const usedSuffixes = withPrefix
      .map(p => {
        const suffix = p.productCode.slice(base.length + 1);
        return parseInt(suffix, 10);
      })
      .filter(n => !isNaN(n));
    const next = usedSuffixes.length > 0 ? Math.max(...usedSuffixes) + 1 : 2;
    return `${base}_${next}`;
  }

  // ── READ ──────────────────────────────────────────────────────────────

  findAll(bankId: string, activeOnly = false): Promise<AccountProductEntity[]> {
    return this.repo.find({
      where: activeOnly ? { bankId, isActive: true } : { bankId },
      order: { productCategory: 'ASC', accountType: 'ASC', productName: 'ASC' },
    });
  }

  async findOne(bankId: string, id: string): Promise<AccountProductEntity> {
    const p = await this.repo.findOne({ where: { id, bankId } });
    if (!p) throw new NotFoundException(`Account product '${id}' not found.`);
    return p;
  }

  // ── CREATE ────────────────────────────────────────────────────────────

  async create(
    bankId: string,
    dto: CreateAccountProductDto,
    user: UserEntity,
  ): Promise<AccountProductEntity> {
    this.assertScope(user, bankId);

    if (!dto.accountType) {
      throw new Error('accountType is required when creating an account product.');
    }

    const productCode = await this.generateProductCode(
      bankId, dto.accountType, dto.accountSubtype,
    );
    const productCategory = this.deriveCategory(dto.accountType);

    const product = this.repo.create({
      ...dto,
      productCode,
      productCategory,
      bankId,
      isActive: true,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const saved = await this.repo.save(product);
    this.logger.log(`[PRODUCT_CREATED] ${saved.productCode} (${saved.accountType}) by ${user.email}`);
    return saved;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────

  async update(
    bankId: string,
    id: string,
    dto: UpdateAccountProductDto,
    user: UserEntity,
  ): Promise<AccountProductEntity> {
    this.assertScope(user, bankId);
    const product = await this.findOne(bankId, id);
    // productCode and accountType are immutable after creation
    const { accountType: _type, ...updateFields } = dto as any;
    Object.assign(product, { ...updateFields, updatedBy: user.id });
    return this.repo.save(product);
  }

  async toggleStatus(
    bankId: string, id: string, isActive: boolean, user: UserEntity,
  ): Promise<AccountProductEntity> {
    this.assertScope(user, bankId);
    const product = await this.findOne(bankId, id);
    product.isActive  = isActive;
    product.updatedBy = user.id;
    return this.repo.save(product);
  }

  // ── DELETE ────────────────────────────────────────────────────────────

  async remove(
    bankId: string, id: string, user: UserEntity,
  ): Promise<{ message: string }> {
    this.assertScope(user, bankId);
    const product = await this.findOne(bankId, id);
    await this.repo.remove(product);
    return { message: `Product '${product.productName}' deleted.` };
  }
}
