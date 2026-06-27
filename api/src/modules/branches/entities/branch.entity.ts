// src/modules/branches/entities/branch.entity.ts

import { 
  Entity, 
  Column, 
  ManyToOne, 
  JoinColumn, 
  Index, 
  Unique,
  OneToMany
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity } from '../../banks/entities/bank.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { CustomerEntity } from '../../customers/entities/customer.entity';

/**
 * 🏢 BRANCH TYPE ENUM
 * Helps in hierarchical reporting and access control
 */
export enum BranchType {
  HEAD_OFFICE = 'HEAD_OFFICE',
  ZONAL_OFFICE = 'ZONAL_OFFICE',
  REGIONAL_OFFICE = 'REGIONAL_OFFICE',
  RETAIL_BRANCH = 'RETAIL_BRANCH',
  CORPORATE_BRANCH = 'CORPORATE_BRANCH',
  SERVICE_CENTER = 'SERVICE_CENTER'
}

/**
 * 🚀 BRANCH METADATA
 * Extracted Interface for clean JSONB typing
 */
export interface BranchMetadata {
  managerName?: string;
  openingTime?: string;
  closingTime?: string;
  isAtmAvailable?: boolean;
  tier?: 'METRO' | 'URBAN' | 'SEMI-URBAN' | 'RURAL';
  gstin?: string; // State-wise GSTIN often registered at the regional branch level
  cashRetentionLimit?: number; // Maximum cash allowed in the branch vault
}

/**
 * THE BRANCH ENTITY
 * Represents a physical or virtual operational unit of a Bank.
 */
@Entity('branches')
@Unique(['bankId', 'branchCode']) // 🛡️ Internal code must be unique within a single bank
export class BranchEntity extends BaseBankingEntity {

  // ==========================================
  // 1. TENANT HIERARCHY (The Parent Institution)
  // ==========================================

  @Index()
  @Column({ type: 'uuid' }) 
  bankId: string;

  @ManyToOne(() => BankEntity, (bank) => bank.branches, {
    nullable: false,
    onDelete: 'RESTRICT', // 🛡️ Prevents accidental mass-deletion of branches
  })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  // 🚀 UPDATED: Self-referential relationship for hierarchical branch structures
  @Column({ type: 'uuid', nullable: true })
  parentBranchId: string; 

  @ManyToOne(() => BranchEntity, (branch) => branch.subBranches, { nullable: true })
  @JoinColumn({ name: 'parentBranchId' })
  parentBranch: BranchEntity;

  @OneToMany(() => BranchEntity, (branch) => branch.parentBranch)
  subBranches: BranchEntity[];

  // ==========================================
  // 2. CORE IDENTITY & CATEGORIZATION
  // ==========================================

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g., 'Indiranagar Branch'

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string; // e.g., 'hdfc-indiranagar-001'

  @Column({
    type: 'enum',
    enum: BranchType,
    default: BranchType.RETAIL_BRANCH
  })
  branchType: BranchType;

  @Column({ type: 'date', nullable: true, comment: 'Date of branch inauguration' })
  openingDate: Date;

  // ==========================================
  // 3. BANKING ROUTING & CLEARING CODES
  // ==========================================

  /**
   * IFSC: The 11-character Indian Financial System Code.
   * Format: [BankPrefix(4)][0][BranchCode(6)]
   */
  @Index()
  @Column({ type: 'char', length: 11, unique: true })
  ifsc: string;

  /**
   * MICR: Magnetic Ink Character Recognition (9 digits)
   * Essential for cheque clearing in India.
   * Format: [CityCode(3)][BankCode(3)][BranchCode(3)]
   */
  @Index()
  @Column({ type: 'char', length: 9, nullable: true })
  micrCode: string;

  /**
   * SWIFT/BIC: For international/forex enabled branches (8 or 11 chars)
   */
  @Column({ type: 'varchar', length: 11, nullable: true })
  swiftCode: string;

  /**
   * BRANCH CODE: The internal code provided by the bank.
   */
  @Index()
  @Column({ type: 'varchar', length: 20 })
  branchCode: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ==========================================
  // 4. CONTACT & LOCATION (Optimized for India)
  // ==========================================

  @Column({ type: 'varchar', length: 255 })
  addressLine1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine2: string;

  @Index() // 🚀 Keeps queries fast when filtering branches by city
  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  village: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'char', length: 6 }) 
  postalCode: string;

  // 🚀 ADDED: Country column for consistency with BankEntity
  @Column({ type: 'varchar', length: 50, default: 'India' }) 
  country: string;

  // 🚀 UPDATED: Length 20 to safely hold E.164 formats (+919876543210)
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string;

  // ==========================================
  // 5. RELATIONS (The Data Anchors)
  // ==========================================

  @OneToMany(() => UserEntity, (user) => user.branch)
  users: UserEntity[]; // The Branch Staff & Managers

  @OneToMany(() => CustomerEntity, (customer) => customer.branch)
  customers: CustomerEntity[]; // Customers onboarded/assigned to this branch

  // 💡 Note: Use strings 'AccountEntity' if you run into circular dependency import issues
  @OneToMany('AccountEntity', 'branch')
  accounts: any[]; // Financial Accounts mapped to this branch

  @OneToMany('LoanApplicationEntity', 'branch')
  loans: any[]; // Loan applications processed by this branch

  // ==========================================
  // 6. EXTENSIBILITY
  // ==========================================

  @Column({ type: 'jsonb', nullable: true })
  metadata: BranchMetadata; 
}