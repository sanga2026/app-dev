import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { LoanApplicationEntity } from './application.entity';

@Entity('loan_audit_logs')
export class LoanAuditLogEntity extends BaseBankingEntity {

  // --- 1. RELATIONSHIP LINK (UUID - No Length) ---
  @Index()
  @Column({ type: 'uuid', nullable: false })
  loanId: string;

  @ManyToOne(() => LoanApplicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loanId' })
  loan: LoanApplicationEntity;

  // --- 2. AUDIT TRAIL DATA ---
  @Column({ type: 'varchar', length: 100 })
  action: string; // e.g., 'STATUS_CHANGE', 'REMARK_ADDED', 'DOCUMENT_UPLOADED'

  @Column({ type: 'varchar', length: 50, nullable: true })
  previousStatus: string;

  @Column({ type: 'varchar', length: 50 })
  newStatus: string;

  // --- 3. ACTOR (The User UUID - No Length) ---
  @Index()
  @Column({ type: 'uuid', nullable: false })
  performedBy: string; // Linked to UserEntity.id

  @Column({ type: 'text', nullable: true })
  remarks: string;
}