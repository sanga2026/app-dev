import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { StateEntity } from './state.entity';
import { VillageEntity } from './village.entity';

@Entity('towns')
export class TownEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  stateId: string;

  @ManyToOne(() => StateEntity, (state) => state.towns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stateId' })
  state: StateEntity;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pinCode: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => VillageEntity, (village) => village.town)
  villages: VillageEntity[];
}
