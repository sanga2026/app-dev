// src/modules/access-control/entities/role.entity.ts

import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';

@Entity('roles')
@Unique('UQ_TENANT_ROLE_SLUG', ['bankId', 'role']) // Naming it prevents migration headaches later!
export class RoleEntity extends BaseBankingEntity {
  @Index() 
  @Column({ type: 'varchar', length: 50 })
  role: string; // e.g., 'TELLER', 'BRANCH_MANAGER'

  @Index() 
  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g., 'Senior Teller'

  @Column({ type: 'text', nullable: true })
  description: string;

  // 🌍 NULL = Global Template (Super Admin only). UUID = Bank Custom Role.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  bankId: string | null;

  // 🔒 TRUE = Hardcoded platform role (cannot be deleted). FALSE = Standard or Custom role.
  @Column({ type: 'boolean', default: false })
  isSystemRole: boolean;

  // 🛑 Soft-disable a role without breaking historical audit logs
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * 🎛️ GRANULAR PERMISSIONS
   * Example: { "users": { "read": true, "create": false, "update": false, "delete": false } }
   * The 'gin' index makes querying inside this JSON object blazing fast at scale.
   */ 
  @Column({ type: 'jsonb', default: {} })
  permissions: Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean }>;
}