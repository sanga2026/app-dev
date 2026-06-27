import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { CustomerEntity } from '../../customers/entities/customer.entity';

@Entity('loan_applications')
export class LoanApplicationEntity extends BaseBankingEntity {

  // --- 1. TENANT & HIERARCHY (All UUIDs - No Length) ---
  @Index()
  @Column({ type: 'uuid' })
  bankId: string;

  @Index()
  @Column({ type: 'uuid' })
  branchId: string;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.loans, { 
    nullable: false, 
    onDelete: 'RESTRICT' 
  })
  @JoinColumn({ name: 'customerId' })
  customer: CustomerEntity;

  // --- 2. AUDIT TRAIL (Users are now UUIDs) ---
  @Column({ type: 'uuid', nullable: false })
  makerId: string; // The staff who created the loan (e.g., Nisarga)

  @Column({ type: 'uuid', nullable: true })
  checkerId: string; // The supervisor who approved (e.g., Sagar)

  // --- 3. LOAN SPECIFICATIONS ---
  @Column({ type: 'varchar', length: 50 })
  loanType: string;

  @Column({ 
    type: 'decimal', // Use 'decimal' for financial precision
    precision: 15, 
    scale: 2,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) }
  })
  loanAmount: number;

  // --- 4. WORKFLOW STATUS ---
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string; // PENDING, APPROVED, REJECTED, DISBURSED

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
  
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; 
}