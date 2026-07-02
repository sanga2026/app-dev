import {
  Entity, Column, Index, Unique, ManyToOne, JoinColumn
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity }        from '../../banks/entities/bank.entity';
import {
  AccountType, InterestRateType, InterestPayoutFreq,
} from '../../accounting/entities/account.entity';

export enum CompoundingFreq {
  DAILY       = 'DAILY',
  MONTHLY     = 'MONTHLY',
  QUARTERLY   = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY      = 'YEARLY',
}

export enum PenaltyChargeType {
  FLAT       = 'FLAT',
  PERCENTAGE = 'PERCENTAGE',
  NONE       = 'NONE',
}

/** Groups products for UI display — drives which config sections are visible */
export enum ProductCategory {
  DEPOSIT = 'DEPOSIT',   // Savings, Current, FD, RD, NRE, NRO
  LOAN    = 'LOAN',      // Home, Personal, Auto, Gold, Education, OD, CC
  SERVICE = 'SERVICE',   // Locker, Insurance, etc. (future)
}

/**
 * AccountProduct — Bank-defined account product catalog.
 * productCode is AUTO-GENERATED from accountType + accountSubtype.
 * Bank admins define products; branches reuse them when opening accounts.
 */
@Entity('account_products')
@Unique('UQ_PRODUCT_CODE', ['bankId', 'productCode'])
export class AccountProductEntity extends BaseBankingEntity {

  // ── 1. TENANT ────────────────────────────────────────────────────────
  @Index()
  @Column({ type: 'uuid' })
  bankId: string;

  @ManyToOne(() => BankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  // ── 2. IDENTITY ───────────────────────────────────────────────────────
  /** Auto-generated: SAVINGS, PERSONAL_LOAN, PERSONAL_LOAN_2 etc. Read-only after creation. */
  @Column({ type: 'varchar', length: 50 })
  productCode: string;

  @Column({ type: 'varchar', length: 100 })
  productName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: AccountType })
  accountType: AccountType;

  /** Dynamic sub-type: SALARY / REGULAR / SENIOR_CITIZEN for Savings; CAR_NEW / TWO_WHEELER for Auto Loan, etc. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  accountSubtype: string | null;

  /** UI grouping: DEPOSIT | LOAN | SERVICE — derived from accountType on save */
  @Column({ type: 'enum', enum: ProductCategory, default: ProductCategory.DEPOSIT })
  productCategory: ProductCategory;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ── 3. CURRENCY ───────────────────────────────────────────────────────
  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  // ── 4. BALANCE RULES ─────────────────────────────────────────────────
  @Column({
    type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  minimumOpeningAmount: number;   // min deposit to open account

  @Column({
    type: 'numeric', precision: 18, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  minimumBalance: number;         // MAB / minimum maintained balance

  @Column({
    type: 'numeric', precision: 18, scale: 2, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  maximumBalance: number | null;  // cap for PMJDY / SB basic accounts

  // ── 5. INTEREST / RETURN CONFIGURATION ───────────────────────────────
  @Column({
    type: 'numeric', precision: 7, scale: 4, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  interestRate: number | null;    // Annual rate % (e.g. 3.5000 = 3.5%)

  @Column({
    type: 'enum', enum: InterestRateType, default: InterestRateType.FIXED
  })
  interestRateType: InterestRateType;

  @Column({
    type: 'enum', enum: InterestPayoutFreq, nullable: true,
    default: InterestPayoutFreq.QUARTERLY,
  })
  interestPayoutFreq: InterestPayoutFreq | null;

  @Column({
    type: 'enum', enum: CompoundingFreq, nullable: true,
    default: CompoundingFreq.QUARTERLY,
  })
  compoundingFreq: CompoundingFreq | null;
  // Interest earned = P × (1 + r/n)^(n×t) − P
  // where n = compoundingFreq per year, r = annual rate, t = years

  // ── 6. TENURE ─────────────────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  minTenureMonths: number | null; // null = no minimum

  @Column({ type: 'int', nullable: true })
  maxTenureMonths: number | null; // null = perpetual

  @Column({ type: 'int', nullable: true })
  defaultTenureMonths: number | null;  // pre-filled when opening

  // ── 7. LOAN-SPECIFIC FIELDS ───────────────────────────────────────────
  @Column({
    type: 'numeric', precision: 18, scale: 2, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  minLoanAmount: number | null;

  @Column({
    type: 'numeric', precision: 18, scale: 2, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  maxLoanAmount: number | null;

  @Column({
    type: 'numeric', precision: 6, scale: 4, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  processingFeePercent: number | null;  // e.g. 0.5000 = 0.5%

  @Column({
    type: 'numeric', precision: 6, scale: 4, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  foreclosureChargePercent: number | null;

  @Column({
    type: 'numeric', precision: 6, scale: 4, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  penalInterestRate: number | null;     // extra % on overdue instalments

  // ── 8. PENALTY / NON-MAINTENANCE ─────────────────────────────────────
  @Column({ type: 'enum', enum: PenaltyChargeType, default: PenaltyChargeType.NONE })
  penaltyChargeType: PenaltyChargeType;

  @Column({
    type: 'numeric', precision: 14, scale: 2, default: 0,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  penaltyChargeValue: number;           // ₹ or % depending on penaltyChargeType

  // ── 9. TRANSACTION LIMITS ─────────────────────────────────────────────
  @Column({
    type: 'numeric', precision: 14, scale: 2, default: 25000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  dailyWithdrawalLimit: number;

  @Column({
    type: 'numeric', precision: 14, scale: 2, default: 10000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  atmDailyLimit: number;

  @Column({
    type: 'numeric', precision: 14, scale: 2, default: 200000,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  onlineTxnDailyLimit: number;

  // ── 10. AUTO INTEREST CREDIT CONFIG ──────────────────────────────────
  /**
   * If true, the system auto-credits interest to the account on the
   * creditDayOfMonth of every payoutFreq period.
   * The scheduled job reads this flag and the interestRate / compoundingFreq
   * to calculate and post the credit transaction.
   */
  @Column({ type: 'boolean', default: true })
  autoInterestCredit: boolean;

  @Column({ type: 'smallint', default: 1 })
  creditDayOfMonth: number;       // 1-28; day to credit interest each period

  // ── 11. ELIGIBILITY ───────────────────────────────────────────────────
  @Column({ type: 'boolean', default: false })
  seniorCitizenOnly: boolean;

  @Column({ type: 'boolean', default: false })
  nriOnly: boolean;

  @Column({
    type: 'numeric', precision: 5, scale: 2, nullable: true,
    transformer: { to: (v: any) => v, from: (v: any) => v ? parseFloat(v) : null },
  })
  seniorCitizenExtraRate: number | null;  // Extra % rate for senior citizens (e.g. 0.50)

  // ── 12. EXTENSIBILITY ────────────────────────────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, any> | null;
  /*
   * Examples:
   * { "sweepFacility": true, "debitCard": "VISA_CLASSIC", "chequebook": true }
   * { "taxBenefit": "80C", "fdInsured": true, "autoRenewal": true }
   */
}
