export interface Bank {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  website?: string;
  ifscPrefix: string;
  registrationNumber?: string;
  taxIdentifier: string;
  isActive: boolean;
  hqEmail?: string;
  hqPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  village?: string;
  state: string;
  postalCode: string;
  country: string;
  baseCurrency: string;
  timezone: string;
  metadata?: Record<string, any>;
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankOnboardPayload {
  name: string;
  ifscPrefix: string;
  registrationNumber?: string;
  taxIdentifier: string;
  hqEmail?: string;
  hqPhone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  village?: string;
  state: string;
  postalCode: string;
  country: string;
  baseCurrency?: string;
  timezone?: string;
  website?: string;
  logoUrl?: string;
}
