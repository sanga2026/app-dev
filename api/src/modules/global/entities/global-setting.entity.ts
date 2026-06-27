import { Entity, Column, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('global_settings')
export class GlobalSettingEntity {
  @PrimaryColumn()
  key: string; // e.g., 'ABOUT_US', 'SUPPORT_EMAIL', 'MAINTENANCE_MODE'

  @Column({ type: 'text' })
  value: string; // Stored as string, but can be parsed as JSON if needed

  @Column({ default: 'text' })
  type: string; // 'text', 'json', 'number', 'boolean'

  @Column({ nullable: true })
  description: string; // To help the Super Admin understand what this setting does

@Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string;

  // Auto-managed timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}