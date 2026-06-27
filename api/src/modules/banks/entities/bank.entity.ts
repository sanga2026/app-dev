import { 
  Entity, 
  Column, 
  Index, 
  OneToMany 
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { BranchEntity } from '../../branches/entities/branch.entity';
import { LoanProductEntity } from '../../loan-products/entities/loan-product.entity';
// 🚀 ADDED: Import the Customer entity we just worked on
import { CustomerEntity } from '../../customers/entities/customer.entity';

/**
 * THE BANK (TENANT) ENTITY
 * Represents the top-level institutional tenant in the S-Market system.
 */
@Entity('banks')
export class BankEntity extends BaseBankingEntity {

  // --- 1. CORE IDENTITY & BRANDING ---

  @Column({ type: 'varchar', length: 255 })
  name: string; // e.g., "State Bank of India"

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string; // Unique URL/System identifier (e.g., 'sbi')

  @Column({ type: 'varchar', length: 255, nullable: true })
  logoUrl: string;

  // 🚀 ADDED: Standard corporate website
  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string; 

  // --- 2. REGULATORY & COMPLIANCE (HDFC/SBI Standard) ---

  /**
   * IFSC_PREFIX: Every bank has a unique 4-character prefix (SBIN, HDFC, ICIC).
   */
  @Index({ unique: true })
  @Column({ type: 'char', length: 4, unique: true })
  ifscPrefix: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 25, unique: true, nullable: true })
  registrationNumber: string; // RBI License or CIN Number

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 15, unique: true })
  taxIdentifier: string; // GSTIN (15 characters in India)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // --- 3. HQ CONTACT & ADDRESS ---

  @Column({ type: 'varchar', length: 100, nullable: true })
  hqEmail: string;

  // 🚀 UPDATED: Increased length to 20 to safely fit E.164 formats (+919876543210)
  @Column({ type: 'varchar', length: 20, nullable: true })
  hqPhone: string;

  @Column({ type: 'varchar', length: 255 })
  addressLine1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine2: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  // 🚀 ADDED: Village field to sync with our UI and DTO updates
  @Column({ type: 'varchar', length: 100, nullable: true })
  village: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'char', length: 6 }) // Indian PIN Codes are exactly 6 digits
  postalCode: string;

  @Column({ type: 'varchar', length: 50, default: 'India' })
  country: string;

  // --- 4. SAAS CONFIGURATIONS ---

  // 🚀 ADDED: Base currency (Crucial for reporting & loan ledgers)
  @Column({ type: 'char', length: 3, default: 'INR' })
  baseCurrency: string;

  // 🚀 ADDED: Timezone (Crucial for End-of-Day batch processing)
  @Column({ type: 'varchar', length: 50, default: 'Asia/Kolkata' })
  timezone: string;

  // --- 5. DATA LINKAGE (Multi-Tenant Hierarchy) ---

  @OneToMany(() => BranchEntity, (branch) => branch.bank)
  branches: BranchEntity[];

  @OneToMany(() => LoanProductEntity, (loanProduct) => loanProduct.bank, { cascade: true })
  loanProducts: LoanProductEntity[];

  @OneToMany(() => UserEntity, (user) => user.bank)
  users: UserEntity[];

  // 🚀 ADDED: Bi-directional link to Customers
  @OneToMany(() => CustomerEntity, (customer) => customer.bank)
  customers: CustomerEntity[];


  // --- 6. EXTENSIBILITY ---

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // For extra audit or UI data

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>; // For bank-specific configurations
}