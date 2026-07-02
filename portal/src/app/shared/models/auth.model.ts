export interface AccessLog {
  id: string;
  event: string;
  ipAddress: string;
  device: string;
  createdAt: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  email: string;
  phoneNumber?: string;
  roleType: string;
  role?: string;
  bankId?: string | null;
  branchId?: string | null;
  permissions?: PermissionMatrix;
  isDarkMode?: boolean;
  isSidebarCollapsed?: boolean;
  language?: string;
  dashboardLayout?: string;
  emailAlerts?: boolean;
  smsAlerts?: boolean;
}

export interface UserSession {
  id: string;
  device: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

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
  accounting?:       ResourcePermissions;
  audit?:            ResourcePermissions;
  'global-settings'?: ResourcePermissions;
  reports?:          ResourcePermissions;
  dashboard?:        ResourcePermissions;
  [resource: string]: ResourcePermissions | undefined;
}
