import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('currencies')
export class CurrencyEntity {
  @PrimaryColumn({ type: 'char', length: 3 })
  code: string; // ISO 4217 e.g. INR, USD, EUR

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  symbol: string;

  @Column({ type: 'smallint', default: 2 })
  decimalPlaces: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
