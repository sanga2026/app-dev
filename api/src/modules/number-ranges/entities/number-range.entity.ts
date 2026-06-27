// src/modules/number-ranges/entities/number-range.entity.ts

import { 
  Entity, 
  Column, 
  Index, 
  Unique, 
  ManyToOne, 
  JoinColumn 
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity } from '../../banks/entities/bank.entity';

@Entity('number_ranges')
@Unique(['bankId', 'type']) // 🛡️ CRITICAL: Prevents duplicate sequences for the same bank/type
export class NumberRangeEntity extends BaseBankingEntity {
  
  // --- 1. TENANT LINKAGE (The Institutional Anchor) ---
  
  @Index()
  @Column({ type: 'uuid', nullable: false })
  bankId: string;

  @ManyToOne(() => BankEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  // --- 2. SEQUENCE IDENTITY ---

  @Column({ 
    type: 'varchar', 
    length: 50,
    comment: 'Target entity: LOAN, SAVINGS, CUSTOMER, TRANSACTION' 
  })
  type: string;

  @Column({ 
    type: 'varchar', 
    length: 10, 
    comment: 'Static prefix: LON, CUS, ACC', 
    nullable : true
  })
  prefix?: string;

  @Column({ 
    type: 'varchar', 
    length: 5, 
    default: '-', 
    comment: 'Separator between prefix and number', 
    nullable : true
  })
  separator?: string;

  // --- 3. COUNTER LOGIC (Banking Precision) ---

  @Column({ type: 'int', default: 1000 })
  startNumber: number;

  @Column({ type: 'int', default: 1000 })
  currentNumber: number;

  @Column({ type: 'int', default: 99999999 })
  endNumber: number;

  @Column({ 
    type: 'int', 
    default: 6, 
    comment: 'Min digits for padding: 1001 becomes 001001 if padding is 6' 
  })
  padding: number;

  // --- 4. OPERATIONAL STATUS ---

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
  
  @Column({ type: 'boolean', default: false })
  isExhausted: boolean;

  // --- 5. EXTENSIBILITY ---

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    lastResetDate?: Date;
    resetCycle?: 'ANNUAL' | 'NEVER';
    incrementBy?: number;
    separator?: string;
    sampleOutput?: string; // e.g., "SBI-CUS-001001"
  };
}