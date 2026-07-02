import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { CountryEntity } from './country.entity';
import { TownEntity } from './town.entity';

@Entity('states')
export class StateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'char', length: 2 })
  countryCode: string;

  @ManyToOne(() => CountryEntity, (country) => country.states, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'countryCode' })
  country: CountryEntity;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  code: string; // ISO subdivision code e.g. IN-KA

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => TownEntity, (town) => town.state)
  towns: TownEntity[];
}
