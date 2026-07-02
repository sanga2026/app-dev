export interface Customer {
  id: string;
  bankId: string;
  branchId: string;
  customerNumber: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  guardianName?: string;
  dateOfBirth?: string;
  gender: string;
  maritalStatus?: string;
  marriageDate?: string;
  customerCategory: CustomerCategory;
  email?: string;
  phoneNumber: string;
  alternatePhoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  village?: string;
  state?: string;
  pinCode?: string;
  kycStatus: KycStatus;
  kycVerifiedAt?: string;
  governmentIdType?: string;
  governmentId?: string;
  cKycNumber?: string;
  eKycNumber?: string;
  gstin?: string;
  isActive: boolean;
  isBlacklisted: boolean;
  isLocked: boolean;
  metadata?: CustomerMetadata;
  createdAt?: string;
}

export interface CustomerMetadata {
  occupation?: string;
  caste?: string;
  annualIncome?: number;
  riskCategory?: 'LOW' | 'MEDIUM' | 'HIGH';
  tags?: string[];
}

export enum KycStatus {
  PENDING  = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED  = 'EXPIRED',
}

export enum CustomerCategory {
  PUBLIC         = 'PUBLIC',
  STAFF          = 'STAFF',
  SENIOR_CITIZEN = 'SENIOR_CITIZEN',
  CORPORATE      = 'CORPORATE',
}

export interface CustomerOnboardPayload {
  bankId: string;
  branchId: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender: string;
  maritalStatus?: string;
  customerCategory: CustomerCategory;
  email?: string;
  phoneNumber: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  governmentIdType?: string;
  governmentId?: string;
}
