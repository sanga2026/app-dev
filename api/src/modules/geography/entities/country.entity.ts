import { Entity, Column, PrimaryColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { StateEntity } from './state.entity';

@Entity('countries')
export class CountryEntity {
  @PrimaryColumn({ type: 'char', length: 2 })
  code: string; // ISO 3166-1 alpha-2 e.g. IN, US

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  dialCode: string; // e.g. +91

  @Column({ type: 'char', length: 3, nullable: true })
  currencyCode: string; // FK to CurrencyEntity (string reference to avoid circular)

  @Column({ type: 'varchar', length: 10, nullable: true })
  flag: string; // emoji or icon code

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => StateEntity, (state) => state.country)
  states: StateEntity[];
}
