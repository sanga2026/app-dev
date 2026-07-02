import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type DataAuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Immutable audit trail for every data mutation across the system.
 * Created by AuditInterceptor automatically on POST/PATCH/DELETE.
 */
@Entity('data_audit_logs')
export class DataAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  resource: string;

  @Column({ type: 'varchar', length: 20 })
  action: DataAuditAction;

  @Column({ type: 'uuid', nullable: true, name: 'entity_id' })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'request_body' })
  requestBody: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'response_snapshot' })
  responseSnapshot: Record<string, any> | null;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 20, default: '200', name: 'status_code' })
  statusCode: string;

  // Immutable — no updatedAt, no soft delete
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
