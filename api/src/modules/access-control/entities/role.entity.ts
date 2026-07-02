import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'disburse' | 'reject' | 'export';

export type ResourcePermissions = Partial<Record<PermissionAction, boolean>>;

export interface PermissionMatrix {
  banks?:            ResourcePermissions;
  branches?:         ResourcePermissions;
  customers?:        ResourcePermissions;
  loans?:            ResourcePermissions;
  'loan-products'?:  ResourcePermissions;
  users?:            ResourcePermissions;
  roles?:            ResourcePermissions;
  geography?:        ResourcePermissions;
  currencies?:       ResourcePermissions;
  'master-data'?:    ResourcePermissions;
  reports?:          ResourcePermissions;
  'global-settings'?: ResourcePermissions;
  accounting?:       ResourcePermissions;
  audit?:            ResourcePermissions;
  [resource: string]: ResourcePermissions | undefined;
}

@Entity('roles')
@Unique('UQ_TENANT_ROLE_SLUG', ['bankId', 'role'])
export class RoleEntity extends BaseBankingEntity {
  @Index()
  @Column({ type: 'varchar', length: 50 })
  role: string; // e.g. 'TELLER', 'BRANCH_MANAGER'

  @Index()
  @Column({ type: 'varchar', length: 100 })
  name: string; // display name e.g. 'Senior Teller'

  @Column({ type: 'text', nullable: true })
  description: string;

  // NULL = Global Template (Super Admin). UUID = Bank Custom Role.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  bankId: string | null;

  // TRUE = Hardcoded platform role (cannot be deleted)
  @Column({ type: 'boolean', default: false })
  isSystemRole: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * GRANULAR PERMISSION MATRIX
   * Structure: { resource: { read, create, update, delete, approve, disburse, reject, export } }
   * GIN index on JSONB for fast querying.
   */
  @Column({ type: 'jsonb', default: {} })
  permissions: PermissionMatrix;
}
