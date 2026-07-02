import { PermissionMatrix, PermissionAction, ResourcePermissions } from './auth.model';

export interface Role {
  id: string;
  role: string;
  name: string;
  description?: string;
  bankId?: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  permissions: PermissionMatrix;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleOnboardPayload {
  slug: string;
  name: string;
  description?: string;
  permissions: PermissionMatrix;
}

export const ALL_RESOURCES = [
  'banks', 'branches', 'customers', 'loans', 'loan-products',
  'users', 'roles', 'geography', 'currencies', 'master-data',
  'accounting', 'audit', 'global-settings', 'reports', 'dashboard',
] as const;

export type ResourceKey = typeof ALL_RESOURCES[number];

export const ALL_ACTIONS: PermissionAction[] = [
  'read', 'create', 'update', 'delete', 'approve', 'disburse', 'reject', 'export'
];

export const RESOURCE_GROUPS: { label: string; resources: ResourceKey[] }[] = [
  {
    label: 'Banking Operations',
    resources: ['banks', 'branches', 'loans', 'loan-products', 'accounting'],
  },
  {
    label: 'Customer Management',
    resources: ['customers'],
  },
  {
    label: 'User & Access Management',
    resources: ['users', 'roles'],
  },
  {
    label: 'Administration',
    resources: ['geography', 'currencies', 'master-data', 'global-settings'],
  },
  {
    label: 'Analytics & Audit',
    resources: ['reports', 'audit', 'dashboard'],
  },
];

export { PermissionMatrix, PermissionAction, ResourcePermissions };
