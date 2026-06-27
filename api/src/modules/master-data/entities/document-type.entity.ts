// src/modules/master-data/entities/document-type.entity.ts

import { 
  Entity, 
  Column, 
  PrimaryColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne, 
  JoinColumn
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * 🗂️ DOCUMENT CATEGORY ENUM
 * Helps the UI filter dropdowns (e.g., Only show "IDENTITY" docs for KYC)
 */
export enum DocumentCategory {
  IDENTITY = 'IDENTITY',
  ADDRESS = 'ADDRESS',
  BUSINESS = 'BUSINESS',
  INCOME = 'INCOME'
}

@Entity('document_types')
export class DocumentTypeEntity {
  
  // --- 1. CORE IDENTITY ---
  
  /**
   * Primary ID is the readable code (e.g., 'PAN', 'PASSPORT', 'VOTER_ID')
   * This acts as a Natural Key, making foreign keys in other tables highly readable.
   */
  @PrimaryColumn({ type: 'varchar', length: 20 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // Display Name (e.g., 'Permanent Account Number')

  @Column({ 
    type: 'enum', 
    enum: DocumentCategory, 
    default: DocumentCategory.IDENTITY 
  })
  category: DocumentCategory;

  // --- 2. REGULATORY LOGIC ---

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isMandatory: boolean; // Useful if a specific doc is globally required

  /**
   * REGEX VALIDATION: 
   * Frontend & Backend can safely share this.
   * e.g., PAN: ^[A-Z]{5}[0-9]{4}[A-Z]{1}$
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  validationRegex: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  placeholder: string; // e.g., 'ABCDE1234F' (Powers UI input hints dynamically)

  @Column({ type: 'varchar', length: 50, default: 'INDIA' })
  country: string;

  // --- 3. AUDIT TRAIL ---

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true, name: 'updated_by' })
  updatedBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updater: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}