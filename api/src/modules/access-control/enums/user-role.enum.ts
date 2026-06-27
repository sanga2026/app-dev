export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',       // Platform Owner (Global Scope)
  BANK_ADMIN = 'BANK_ADMIN',         // Tenant Owner (Bank Scope)
  BRANCH_MANAGER = 'BRANCH_MANAGER', // Location Lead (Branch Scope)
  STAFF = 'STAFF',                   // Operations (Branch Scope)
  CUSTOMER = 'CUSTOMER',             // End User (Personal Scope)
}