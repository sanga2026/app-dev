import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { LoanApplicationEntity } from '../loans/entities/application.entity';
import { LoanAuditLogEntity } from '../loans/entities/loan-audit-log.entity';
import { AccountEntity, AccountType, AccountStatus } from '../accounting/entities/account.entity';
import { SearchLoanDto } from '../loans/dto/search-loan.dto';
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class MakerCheckerService {
  private readonly logger = new Logger(MakerCheckerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * PHASE 1: INITIATION (The Maker)
   * Logic: Onboards customer (if new), creates a Savings Wallet, and initiates Loan.
   * All actions are scoped to a specific Bank and Branch.
   */
  async createRequest(entityClass: any, dto: any): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      try {
        // 1. Multi-Tenancy Validation
        if (!dto.bankId || !dto.branchId) {
          throw new BadRequestException(
            'Bank ID and Branch ID are mandatory for initiation.',
          );
        }

        // 2. Identity & Wallet Logic
        let customer = await manager.findOne(CustomerEntity, {
          where: { governmentId: dto.governmentId, bankId: dto.bankId },
        });

        if (!customer) {
          this.logger.log(
            `[Maker] Creating new customer profile: ${dto.governmentId}`,
          );
          customer = await manager.save(
            manager.create(CustomerEntity, {
              customerName: dto.customerName,
              governmentId: dto.governmentId,
              email: dto.customerEmail,
              phoneNumber: dto.phoneNumber,
              bankId: dto.bankId,
              branchId: dto.branchId,
            }),
          );

          // Every customer gets a primary Savings "Wallet" at the onboarding branch
          await manager.save(
            manager.create(AccountEntity, {
              customerId: customer.id,
              bankId: dto.bankId,
              branchId: dto.branchId,
              accountNumber: `SA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              accountType: AccountType.SAVINGS,
              currentBalance: 0.0,
              availableBalance: 0.0,
              lienAmount: 0.0,
              status: AccountStatus.ACTIVE,
            }),
          );
        }

        // 3. Loan Application Logic
        const newLoan = manager.create(LoanApplicationEntity, {
          bankId: dto.bankId,
          branchId: dto.branchId,
          customerId: customer.id,
          loanType: dto.loanType,
          loanAmount: dto.requestedAmount,
          status: 'PENDING',
          makerId: dto.makerId || 'SYSTEM_MAKER',
          notes: dto.notes,
        });
        const savedLoan = await manager.save(newLoan);

        // 4. Audit Log
        await this.logAudit(
          manager,
          savedLoan.id,
          'INITIATE',
          'DRAFT',
          'PENDING',
          dto.makerId,
        );

        return {
          success: true,
          loanId: savedLoan.id,
          message: 'Loan initiated and pending supervisor approval.',
        };
      } catch (error) {
        this.logger.error(`[MAKER ERROR] ${getErrorMessage(error)}`);
        throw error instanceof BadRequestException
          ? error
          : new InternalServerErrorException(getErrorMessage(error));
      }
    });
  }

  /**
   * PHASE 2: APPROVAL (The Checker)
   * Logic: Transition status from PENDING to APPROVED.
   */
  async approveRequest(id: string, body: any) {
    return await this.dataSource.transaction(async (manager) => {
      try {
        const loan = await this.findAndValidateLoan(manager, id, 'PENDING');

        loan.status = 'APPROVED';
        loan.checkerId = body.checkerId;
        await manager.save(loan);

        await this.logAudit(
          manager,
          id,
          'APPROVE',
          'PENDING',
          'APPROVED',
          body.checkerId,
          body.notes,
        );
        return { success: true, message: 'Loan application approved.' };
      } catch (error) {
        this.logger.error(`[CHECKER ERROR] Approval failed: ${getErrorMessage(error)}`);
        throw error;
      }
    });
  }

  /**
   * PHASE 3: REJECTION
   * Logic: Stop the application and record the reason.
   */
  async rejectRequest(
    id: string,
    reason: string,
    checkerId: string = 'SYSTEM',
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const loan = await this.findAndValidateLoan(manager, id, 'PENDING');

      loan.status = 'REJECTED';
      loan.metadata = { ...loan.metadata, rejectionReason: reason };
      await manager.save(loan);

      await this.logAudit(
        manager,
        id,
        'REJECT',
        'PENDING',
        'REJECTED',
        checkerId,
        reason,
      );
      return { success: true, message: 'Loan rejected.' };
    });
  }

  /**
   * PHASE 4: DISBURSEMENT
   * Logic: Create a Loan Liability Account and verify the Savings Wallet.
   */
  async disburseRequest(id: string, body: any) {
    return await this.dataSource.transaction(async (manager) => {
      try {
        const loan = await this.findAndValidateLoan(manager, id, 'APPROVED');

        // Logic: Verify target Savings Account exists within the SAME Bank
        const wallet = await manager.findOne(AccountEntity, {
          where: {
            customerId: loan.customerId,
            accountType: AccountType.SAVINGS,
            bankId: loan.bankId,
          },
        });

        if (!wallet) {
          throw new BadRequestException(
            'Disbursement Blocked: Customer has no active SAVINGS wallet in this bank.',
          );
        }

        // 1. Create the Loan Account (The debt record)
        const loanAccount = await manager.save(
          manager.create(AccountEntity, {
            customerId: loan.customerId,
            bankId: loan.bankId,
            branchId: loan.branchId,
            accountNumber: `LN-${Date.now()}`,
            accountType: AccountType.PERSONAL_LOAN,
            currentBalance: loan.loanAmount,
            availableBalance: loan.loanAmount,
            lienAmount: 0,
            status: AccountStatus.ACTIVE,
          }),
        );

        // 2. Update status
        loan.status = 'DISBURSED';
        await manager.save(loan);

        await this.logAudit(
          manager,
          id,
          'DISBURSE',
          'APPROVED',
          'DISBURSED',
          body.disbursedBy,
          `Funded to LN: ${loanAccount.accountNumber}`,
        );

        return {
          success: true,
          loanAccountNumber: loanAccount.accountNumber,
          disbursedToWallet: wallet.accountNumber,
        };
      } catch (error) {
        this.logger.error(`[DISBURSE ERROR] ${getErrorMessage(error)}`);
        throw error;
      }
    });
  }

  /**
   * PHASE 5: SEARCH & DETAIL
   * Logic: Enforce multi-tenancy by filtering every query with bankId.
   */
  async searchRequests(
    entityClass: any,
    filters: SearchLoanDto,
  ): Promise<any[]> {
    const query = this.dataSource
      .getRepository(entityClass)
      .createQueryBuilder('loan');

    if (filters.bankId)
      query.andWhere('loan.bankId = :bankId', { bankId: filters.bankId });
    if (filters.status)
      query.andWhere('loan.status = :status', { status: filters.status });
    if (filters.branchId)
      query.andWhere('loan.branchId = :branchId', {
        branchId: filters.branchId,
      });

    return await query.orderBy('loan.createdAt', 'DESC').getMany();
  }

  async getLoanDetail(id: string, bankId: string) {
    const loan = await this.dataSource
      .getRepository(LoanApplicationEntity)
      .findOne({
        where: { id, bankId },
        relations: ['customer'], // Load customer profile for the checker's view
      });
    if (!loan)
      throw new NotFoundException('Loan not found or access restricted.');
    return loan;
  }

  /**
   * PHASE 5: REPORTING & ANALYTICS (The Vault Dashboard)
   * Logic: Aggregates loan counts and total values by status.
   * Supports optional filtering by bankId and branchId.
   */
  async getVaultStats(
    entityClass: any,
    bankId?: string,
    branchId?: string,
  ): Promise<any> {
    try {
      const query = this.dataSource
        .getRepository(entityClass)
        .createQueryBuilder('loan')
        .select('loan.status', 'status')
        .addSelect('COUNT(loan.id)', 'count')
        .addSelect('SUM(loan.loanAmount)', 'totalValue');

      // LOGIC: Filter stats by Tenant/Location if provided
      if (bankId) {
        query.andWhere('loan.bankId = :bankId', { bankId });
      }
      if (branchId) {
        query.andWhere('loan.branchId = :branchId', { branchId });
      }

      const stats = await query.groupBy('loan.status').getRawMany();

      // Mapping raw database strings to clean JSON numbers
      return {
        timestamp: new Date(),
        scope: { bankId: bankId || 'GLOBAL', branchId: branchId || 'ALL' },
        vaultSummary: stats.map((s) => ({
          status: s.status,
          count: parseInt(s.count, 10),
          totalPortfolio: parseFloat(s.totalValue || '0'),
        })),
      };
    } catch (error) {
      this.logger.error(
        `[STATS ERROR] Failed to aggregate vault data: ${getErrorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Could not retrieve vault statistics.',
      );
    }
  }

  // --- PRIVATE SYSTEM HELPERS ---

  private async findAndValidateLoan(
    manager: EntityManager,
    id: string,
    requiredStatus: string,
  ) {
    const loan = await manager.findOne(LoanApplicationEntity, {
      where: { id },
    });
    if (!loan) throw new NotFoundException(`Loan record ${id} not found.`);
    if (loan.status !== requiredStatus) {
      throw new BadRequestException(
        `Workflow Violation: Loan is in ${loan.status} status, but ${requiredStatus} is required.`,
      );
    }
    return loan;
  }

  private async logAudit(
    manager: EntityManager,
    loanId: string,
    action: string,
    prev: string,
    next: string,
    user: string,
    remarks?: string,
  ) {
    const log = manager.create(LoanAuditLogEntity, {
      loanId,
      action,
      previousStatus: prev,
      newStatus: next,
      performedBy: user || 'SYSTEM',
      remarks: remarks || 'State transition successful',
    });
    return await manager.save(log);
  }
}
