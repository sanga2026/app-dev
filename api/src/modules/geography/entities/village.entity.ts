import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TownEntity } from './town.entity';

@Entity('villages')
export class VillageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  townId: string;

  @ManyToOne(() => TownEntity, (town) => town.villages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'townId' })
  town: TownEntity;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pinCode: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
