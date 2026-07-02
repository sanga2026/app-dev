import {
  Entity, Column, Index, ManyToOne, JoinColumn, Unique
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { CustomerEntity }   from '../../customers/entities/customer.entity';
import { BranchEntity }     from '../../branches/entities/branch.entity';
import { BankEntity }       from '../../banks/entities/bank.entity';

// ─── Enums ────────────────────────────────────────────────────────────────

export enum AccountType {
  SAVINGS           = 'SAVINGS',
  SAVINGS_BASIC     = 'SAVINGS_BASIC',      // PMJDY / zero-balance
  CURRENT           = 'CURRENT',
  FIXED_DEPOSIT     = 'FIXED_DEPOSIT',
  RECURRING_DEPOSIT = 'RECURRING_DEPOSIT',
  NRE_SAVINGS       = 'NRE_SAVINGS',
  NRO_SAVINGS       = 'NRO_SAVINGS',
  CASH_CREDIT       = 'CASH_CREDIT',
  OVERDRAFT         = 'OVERDRAFT',
  HOME_LOAN         = 'HOME_LOAN',
  PERSONAL_LOAN     = 'PERSONAL_LOAN',
  AUTO_LOAN         = 'AUTO_LOAN',
  GOLD_LOAN         = 'GOLD_LOAN',
  EDUCATION_LOAN    = 'EDUCATION_LOAN',
}

export enum AccountStatus {
  ACTIVE             = 'ACTIVE',
  DORMANT            = 'DORMANT',       // no txn > 24 months
  INOPERATIVE        = 'INOPERATIVE',   // no txn > 12 months
  FROZEN             = 'FROZEN',        // court / regulatory order
  BLOCKED            = 'BLOCKED',       // internal hold
  CLOSED             = 'CLOSED',
  NPA                = 'NPA',           // Non-Performing Asset
  UNDER_LITIGATION   = 'UNDER_LITIGATION',
}

export enum InterestRateType {
  FIXED    = 'FIXED',
  FLOATING = 'FLOATING',   // MCLR-linked
}

export enum InterestPayoutFreq {
  MONTHLY     = 'MONTHLY',
  QUARTERLY   = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY      = 'YEARLY',
  AT_MATURITY = 'AT_MATURITY',
}

// ─── Entity ───────────────────────────────────────────────────────────────

@Entity('accounts')
@Unique('UQ_ACCOUNT_NUMBER', ['accountNumber'])
export class AccountEntity extends BaseBankingEntity {

  // ── 1. TENANT HIERARCHY ──────────────────────────────────────────────
  @Index()
  @Column({ type: 'uuid' })
  bankId: string;

  @ManyToOne(() => BankEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => BranchEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: BranchEntity;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;

  // ── 2. IDENTITY & ROUTING ─────────────────────────────────────────────
  @Column({ type: 'varchar', length: 20, unique: true })
  accountNumber: string;                        // 10-18 digit numeric

  @Column({ type: 'char', length: 11, nullable: true })
  ifscCode: string;                             // Inherited from branch; stored for fast lookup

  @Column({ type: 'char', length: 9, nullable: true })
  micrCode: string;                             // Cheque clearing code

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;                             // ISO 4217

  // ── 3. CLASSIFICATION ────────────────────────────────────────────────
  @Column({ type: 'enum', enum: AccountType, default: AccountType.SAVINGS })
  accountType: AccountType;

  @Column({ type: 'varchar', length: 30, nullable: true })
  accountSubtype: string;                       // SALARY, SENIOR_CITIZEN, BSBD, etc.

  // ── 4. OPERATIONAL BALANCES ──────────────────────────────────────────
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  currentBalance: number;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  availableBalance: number;                     // current - lien

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  lienAmount: number;                           // amount under hold / court order

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  minimumBalance: number;                       // MAB requirement

  // ── 5. INTEREST ───────────────────────────────────────────────────────
  @Column({ type: 'numeric', precision: 6, scale: 4, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null } })
  interestRate: number | null;                  // Annual % (e.g. 3.5000)

  @Column({ type: 'enum', enum: InterestRateType, default: InterestRateType.FIXED })
  interestRateType: InterestRateType;

  @Column({ type: 'enum', enum: InterestPayoutFreq, default: InterestPayoutFreq.QUARTERLY, nullable: true })
  interestPayoutFreq: InterestPayoutFreq | null;

  @Column({ type: 'date', nullable: true })
  lastInterestAppliedDate: Date | null;

  @Column({ type: 'date', nullable: true })
  maturityDate: Date | null;                    // FD / RD / Loan

  // ── 6. LIMITS ─────────────────────────────────────────────────────────
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 25000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  dailyWithdrawalLimit: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 10000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  atmDailyLimit: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 200000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) } })
  onlineTxnDailyLimit: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null } })
  overdraftLimit: number | null;

  // ── 7. STATUS & LIFECYCLE ─────────────────────────────────────────────
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status: AccountStatus;

  @Column({ type: 'date', nullable: true })
  openedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  lastTransactionDate: Date | null;             // Used for dormancy detection

  @Column({ type: 'varchar', length: 30, nullable: true })
  statusReasonCode: string | null;              // COURT_ORDER, AML_FLAG, etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  freezeReference: string | null;               // Court order / ED reference

  // ── 8. KYC & RISK ────────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  pepFlag: boolean;                             // Politically Exposed Person

  @Column({ type: 'varchar', length: 10, nullable: true })
  riskCategory: string | null;                  // LOW / MEDIUM / HIGH

  @Column({ type: 'smallint', nullable: true })
  cibilScore: number | null;                    // 300-900; mainly for loan accounts

  // ── 9. EXTENSIBILITY (type-specific fields) ───────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
  /*
   * SAVINGS/CURRENT: { nominee, joint_holders, scheme_code, demat_linked }
   * FD/RD:           { principal_amount, tenure_months, auto_renewal, tds_applicable, form_15g_submitted }
   * LOAN:            { sanctioned_amount, emi_amount, emi_due_date, tenure_months, collateral_type, npa_stage, days_past_due }
   * NRE/NRO:         { country_of_residence, passport_number, repatriation_allowed }
   */
}
