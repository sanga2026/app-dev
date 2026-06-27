// src/modules/users/entities/user.entity.ts

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseBankingEntity } from '../../../common/entities/base-banking.entity';
import { BankEntity } from '../../banks/entities/bank.entity';
import { BranchEntity } from '../../branches/entities/branch.entity';
import { RoleEntity } from '../../access-control/entities/role.entity';
import * as bcrypt from 'bcrypt';
import { Exclude } from 'class-transformer';

@Entity('users')
export class UserEntity extends BaseBankingEntity {
  // --- 1. CORE IDENTITY (Standardized Lengths) ---

  @Column({ type: 'varchar', length: 100 }) // Standard First Name limit
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) // Standard Middle Name limit
  middleName: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) // Standard Last Name limit
  lastName: string;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string; // Add the '?' so TypeScript knows it's optional

  /**
   * BANKING USERNAME (e.g., SBI_123456)
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10, unique: true, nullable: true })
  username: string;

  /**
   * STAFF_ID (The 10-digit Unique identifier)
   * Standard for HDFC/SBI employee tracking.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10, unique: true, nullable: true })
  staffId: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phoneNumber: string;

  // --- 2. SECURITY ---

  @Exclude({ toPlainOnly: true })
  @Column({ type: 'varchar', length: 255, select: false }) // Hashes are always ~60 chars
  password: string;

  // --- 3. TENANCY & ROLE HIERARCHY ---

  @Index()
  @Column({ type: 'uuid', nullable: true })
  bankId: string | null;

  @ManyToOne(() => BankEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bankId' })
  bank: BankEntity;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch: BranchEntity;

  // Dynamic Role logic (Slug/Permissions)
  @ManyToOne(() => RoleEntity, { eager: true, nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: RoleEntity;

  @Column({ type: 'uuid', nullable: true })
  roleId?: string | null;

  // Structural Role Type (Master Level)
  @Column({ type: 'varchar', length: 100 })
  roleType: string;

  // --- 4. STATUS & AUDIT ---

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt: Date;

  // --- 5. AUTOMATION HOOKS ---

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 12); // Round 12 for higher banking security
    }
  }

  @Column({ type: 'varchar', nullable: true })
  resetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpires: Date | null;

  @Column({
    type: 'jsonb', // Use 'json' if you are on MySQL
    default: {},
    nullable: false,
  })
  preferences: Record<string, any>;
}
