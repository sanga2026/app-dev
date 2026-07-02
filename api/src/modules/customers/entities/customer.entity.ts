// src/modules/customers/entities/customer.entity.ts

import { 
  Entity, 
  Column, 
  OneToMany, 
  Index, 
  ManyToOne, 
  JoinColumn, 
  Unique
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity } from '../../banks/entities/bank.entity';
import { BranchEntity } from '../../branches/entities/branch.entity';

/**
 * 🛡️ KYC STATUS ENUM
 */
export enum KycStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

/**
 * 👥 CUSTOMER CATEGORY ENUM (Maps to legacy PES: Public/Emp/Senior)
 */
export enum CustomerCategory {
  PUBLIC = 'PUBLIC',
  STAFF = 'STAFF',
  SENIOR_CITIZEN = 'SENIOR_CITIZEN',
  CORPORATE = 'CORPORATE'
}

@Entity('customers')
@Unique(['bankId', 'branchId', 'governmentId'])  // 🛡️ Core uniqueness constraint per tenant
export class CustomerEntity extends BaseBankingEntity {

  // ==========================================
  // 1. HIERARCHY & TENANCY
  // ==========================================

  @Index()
  @Column({ type: 'uuid', nullable: false })
  bankId: string;

  // 🚀 UPDATED: Added explicit inverse relationship
  @ManyToOne(() => BankEntity, (bank) => bank.customers)
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  @Index()
  @Column({ type: 'uuid', nullable: false })
  branchId: string;

  // 🚀 UPDATED: Added explicit inverse relationship
  @ManyToOne(() => BranchEntity, (branch) => branch.customers)
  @JoinColumn({ name: 'branchId' })
  branch: BranchEntity;

  @Index({ unique: true })
  @Column({ 
    type: 'varchar', 
    length: 50, 
    unique: true, 
    nullable: false,
    comment: 'Internal UCIC (e.g., SBI-CUS-1001)'
  })
  customerNumber: string;

  // ==========================================
  // 2. PERSONAL DETAILS
  // ==========================================

  @Column({ type: 'varchar', length: 10, nullable: true })
  title: string; // Mr, Mrs, Shri, Smt

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middleName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 150, nullable: true, comment: 'Father/Husband/Proprietor Name' })
  guardianName: string; 

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'varchar', length: 20, default: 'OTHER' })
  gender: string; // MALE, FEMALE, OTHER

  @Column({ type: 'varchar', length: 20, nullable: true })
  maritalStatus: string;

  @Column({ type: 'date', nullable: true, comment: 'Marrte Date from legacy form' })
  marriageDate: Date;

  @Column({
    type: 'enum',
    enum: CustomerCategory,
    default: CustomerCategory.PUBLIC
  })
  customerCategory: CustomerCategory;

  // ==========================================
  // 3. CONTACT & ADDRESS DETAILS
  // ==========================================

  @Index()
  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'Secondary/Landline Phone' })
  alternatePhoneNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine2: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  // 🚀 ADDED: Synchronized with the UI and DTO changes!
  @Column({ type: 'varchar', length: 100, nullable: true })
  village: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'PIN Code' })
  pinCode: string;

  // ==========================================
  // 4. IDENTITY & KYC (Regulatory Anchors)
  // ==========================================

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING
  })
  kycStatus: KycStatus;

  @Column({ type: 'timestamp', nullable: true })
  kycVerifiedAt: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  governmentIdType: string; 

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Primary unique ID for constraint' })
  governmentId: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  cKycNumber: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  eKycNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gstin: string;

  // ==========================================
  // 5. OPERATIONAL STATUS (Security Matrix)
  // ==========================================

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_blacklisted' })
  isBlacklisted: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_locked' })
  isLocked: boolean;

  // Dynamic Metadata for fields like Caste, Occupation, Risk Category
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    occupation?: string;
    caste?: string;
    annualIncome?: number;
    riskCategory?: 'LOW' | 'MEDIUM' | 'HIGH';
    tags?: string[];
  };

  // ==========================================
  // 6. RELATIONS
  // ==========================================

  @OneToMany('LoanApplicationEntity', 'customer')
  loans: any[];

  @OneToMany('AccountEntity', 'customer')
  accounts: any[];
}