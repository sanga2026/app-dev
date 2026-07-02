export interface Branch {
  id: string;
  bankId: string;
  name: string;
  slug: string;
  branchType: BranchType;
  ifsc: string;
  micrCode?: string;
  swiftCode?: string;
  branchCode: string;
  isActive: boolean;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  village?: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  openingDate?: string;
  parentBranchId?: string;
  metadata?: BranchMetadata;
  createdAt?: string;
}

export interface BranchMetadata {
  managerName?: string;
  openingTime?: string;
  closingTime?: string;
  isAtmAvailable?: boolean;
  tier?: 'METRO' | 'URBAN' | 'SEMI-URBAN' | 'RURAL';
  gstin?: string;
  cashRetentionLimit?: number;
}

export enum BranchType {
  HEAD_OFFICE      = 'HEAD_OFFICE',
  ZONAL_OFFICE     = 'ZONAL_OFFICE',
  REGIONAL_OFFICE  = 'REGIONAL_OFFICE',
  RETAIL_BRANCH    = 'RETAIL_BRANCH',
  CORPORATE_BRANCH = 'CORPORATE_BRANCH',
  SERVICE_CENTER   = 'SERVICE_CENTER',
}

export interface BranchOnboardPayload {
  bankId: string;
  name: string;
  branchType: BranchType;
  ifsc: string;
  micrCode?: string;
  swiftCode?: string;
  branchCode: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  village?: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  openingDate?: string;
  parentBranchId?: string;
  metadata?: BranchMetadata;
}
