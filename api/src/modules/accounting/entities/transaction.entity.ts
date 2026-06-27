import { Entity, Column, ManyToOne, JoinColumn, ColumnOptions } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { AccountEntity } from './account.entity';
import { BankEntity } from '../../banks/entities/bank.entity';

@Entity('transactions')
export class TransactionEntity extends BaseBankingEntity {
  
  // --- TENANT LAYER ---
  @Column({ type: 'varchar', length: 30, nullable: false, index: true } as ColumnOptions)
  bankId: string;

  @ManyToOne(() => BankEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  // --- LEDGER LAYER ---
  @Column({ type: 'varchar', length: 30, nullable: false } as ColumnOptions) // 🛡️ Changed from uuid to varchar
  accountId: string;

  @ManyToOne(() => AccountEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account: AccountEntity;

  // --- FINANCIAL COLUMNS ---
  @Column({ type: 'varchar', length: 10, nullable: false } as ColumnOptions)
  type: string; // DEBIT or CREDIT

  @Column({ 
    type: 'numeric', 
    precision: 15, 
    scale: 2, 
    nullable: false,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) } 
  } as ColumnOptions)
  amount: number;

  @Column({ 
    type: 'numeric', 
    precision: 15, 
    scale: 2, 
    nullable: false,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) } 
  } as ColumnOptions)
  runningBalanceSnapshot: number;

  @Column({ type: 'varchar', length: 100, nullable: true } as ColumnOptions)
  reference: string;

  @Column({ type: 'varchar', length: 255, nullable: true } as ColumnOptions)
  note: string;
}