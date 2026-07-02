// src/modules/banks/dto/create-bank.dto.ts

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  MinLength,
  IsObject,
  IsUrl,
  Matches, // 🚀 Added Matches for E.164 phone validation
} from 'class-validator';

// 🚀 Removed IsBankMobile from imports since we are switching to global E.164 regex
import {
  IsBankIfscPrefix,
  IsBankTaxId,
  IsBankEmail,
  IsBankPostalCode,
  IsBankRegistrationNumber,
} from '../../../common/decorators/is-bank-validated';

export class CreateBankDto {
  // --- 1. CORE IDENTITY & BRANDING ---
  @IsNotEmpty({ message: 'Bank name is mandatory.' })
  @IsString()
  @MinLength(3, { message: 'Bank name must be at least 3 characters.' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUrl({}, { message: 'If provided, Logo URL must be a valid web address.' })
  @MaxLength(255)
  logoUrl?: string;

  @IsOptional()
  @IsUrl({}, { message: 'If provided, website must be a valid URL.' })
  @MaxLength(255)
  website?: string;

  // --- 2. REGULATORY & COMPLIANCE ---
  @IsNotEmpty({ message: 'IFSC Prefix is mandatory.' })
  @IsBankIfscPrefix()
  ifscPrefix: string;

  @IsNotEmpty({
    message:
      'Corporate Registration Number (CIN) is mandatory for legal compliance.',
  })
  @IsBankRegistrationNumber()
  registrationNumber?: string;

  @IsNotEmpty({
    message: 'Tax Identifier (GSTIN) is mandatory for financial compliance.',
  })
  @IsBankTaxId()
  taxIdentifier: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // --- 3. HQ CONTACT & ADDRESS ---
  @IsOptional()
  @IsBankEmail({
    message: 'If provided, the HQ Email must be a valid email address.',
  })
  @MaxLength(150)
  hqEmail?: string;

  // 🚀 FIXED: Switched to Matches to support the "+91" country code merge from the UI
  @IsNotEmpty({ message: 'HQ Phone number is mandatory.' })
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'HQ Phone must be a valid E.164 format (e.g., +919876543210)' })
  hqPhone: string;

  @IsNotEmpty({
    message:
      'Address Line 1 is a mandatory field. Please provide the HQ street address.',
  })
  @IsString()
  @MaxLength(255)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsNotEmpty({ message: 'City is a mandatory field.' })
  @IsString()
  @MaxLength(100)
  city: string;

  // 🚀 FIXED: Added village to whitelist so NestJS accepts the new UI payload
  @IsOptional()
  @IsString()
  @MaxLength(100)
  village?: string;

  @IsNotEmpty({ message: 'State is a mandatory field.' })
  @IsString()
  @MaxLength(100)
  state: string;

  @IsNotEmpty({ message: 'Postal Code (PIN) is mandatory.' })
  @IsBankPostalCode()
  postalCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  // --- 4. EXTENSIBILITY ---
  @IsOptional()
  @IsObject({ message: 'Metadata must be a valid JSON object.' })
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject({ message: 'Settings must be a valid JSON object.' })
  settings?: Record<string, any>;
}