// src/audit/entities/access-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('access_logs')
export class AccessLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // Foreign key

  @Column()
  event: string; // e.g., 'Login Success', 'Password Changed', 'Failed Login'

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  device: string; // User-Agent string parsed

  @CreateDateColumn()
  createdAt: Date;

  // Optional: Link directly to user entity
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}