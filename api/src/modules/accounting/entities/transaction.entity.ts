import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { AccountEntity } from './account.entity';
import { BankEntity } from '../../banks/entities/bank.entity';

@Entity('transactions')
export class TransactionEntity extends BaseBankingEntity {

  @Index()
  @Column({ type: 'uuid' })
  bankId: string;

  @ManyToOne(() => BankEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  @Column({ type: 'uuid' })
  accountId: string;

  @ManyToOne(() => AccountEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'accountId' })
  account: AccountEntity;

  @Column({ type: 'varchar', length: 10 })
  type: string; // DEBIT or CREDIT

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  amount: number;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: { to: (v: any) => v, from: (v: any) => parseFloat(v) },
  })
  runningBalanceSnapshot: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
