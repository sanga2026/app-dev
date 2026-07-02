import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { UserEntity } from '../../modules/users/entities/user.entity';

export abstract class BaseBankingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Audit: who created / updated / deleted ──────────────────────────────
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'deleted_by' })
  deletedBy: string | null;

  // ── Virtual relations (for readability in code) ─────────────────────────
  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater: UserEntity;

  // ── Timestamps ──────────────────────────────────────────────────────────
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  // Soft delete: TypeORM sets this on softDelete(); null = active record
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // Optimistic locking: TypeORM increments this on every UPDATE; prevents lost updates
  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}