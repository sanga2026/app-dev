// src/modules/banks/entities/loan-product.entity.ts

import { 
  Entity, 
  Column, 
  Index, 
  ManyToOne, 
  JoinColumn, 
  Unique
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity } from '../../banks/entities/bank.entity'; // Verify path matches your setup

@Entity('loan_products')
@Unique(['bankId', 'productCode']) // 🛡️ Restricts to exactly one configuration per loan category per bank
export class LoanProductEntity extends BaseBankingEntity {

  // --- 1. TENANT HIERARCHY (Stored at Bank Level) ---

  @Index()
  @Column({ type: 'uuid', nullable: false })
  bankId: string;

  // 🚀 Explicitly linked to the one-to-many property inside BankEntity
  @ManyToOne(() => BankEntity, (bank) => bank.loanProducts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  // --- 2. CORE IDENTITY ---

  @Column({ type: 'varchar', length: 150, nullable: false })
  productName: string; // e.g., "SBI MaxGain Home Loan"

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: false }) 
  productCode: string; // Captured from dropdown value (e.g., 'PERSONAL_LOAN')

  @Column({ type: 'text', nullable: true })
  description: string;

  // --- 3. FINANCIAL SPECIFICATIONS (Banking Precision) ---

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) }
  })
  interestRate: number;

  @Column({ 
    type: 'decimal', 
    precision: 18, 
    scale: 2, 
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) }
  })
  minBalance: number; // Represents minimum criteria or base floor limits

  @Column({ type: 'int', nullable: true })
  maxTenureMonths: number;

  @Column({ type: 'char', length: 3, default: 'INR' })
  currency: string;

  // --- 4. OPERATIONAL STATUS ---

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // --- 5. EXTENSIBILITY ---

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    features?: string[];
    eligibility?: string;
    termsAndConditionsUrl?: string;
    processingFeePercentage?: number;
  };
}