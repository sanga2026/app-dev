import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
// Import your UserEntity (you might need a dynamic import or careful pathing to avoid circular deps)
import { UserEntity } from '../../modules/users/entities/user.entity';

export abstract class BaseBankingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- RAW DATA ---
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string;

  // --- VIRTUAL RELATIONS (For Readability) ---
  // This allows you to do: bank.creator.firstName
  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater: UserEntity;

  // --- TIMESTAMPS ---
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}