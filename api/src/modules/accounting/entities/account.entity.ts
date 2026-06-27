import { Entity, Column, ColumnOptions } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';

@Entity('accounts')
export class AccountEntity extends BaseBankingEntity {
  @Column({ type: 'varchar', length: 30, index: true } as ColumnOptions)
  bankId: string;

  @Column({ type: 'varchar', length: 30 } as ColumnOptions)
  branchId: string;

  @Column({ type: 'varchar', length: 30 } as ColumnOptions)
  customerId: string;

  @Column({ type: 'varchar', length: 50, unique: true } as ColumnOptions)
  accountNumber: string;

  @Column({ type: 'varchar', length: 20 } as ColumnOptions)
  accountType: string;

  @Column({ 
    type: 'numeric', 
    precision: 15, 
    scale: 2, 
    default: 0.00,
    transformer: { to: (v) => v, from: (v) => parseFloat(v) } 
  } as ColumnOptions)
  balance: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' } as ColumnOptions)
  status: string;
}