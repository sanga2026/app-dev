// src/modules/users/dto/create-user.dto.ts

import { 
  IsOptional, 
  IsUUID, 
  IsEnum, 
  IsBoolean, 
  IsObject, 
  MaxLength, 
  IsString, 
  IsNotEmpty,
  Matches,
  IsEmail
} from 'class-validator';
// 🚀 Reusing our centralized "Banking-Grade" decorators!
import { 
  IsBankName, 
  IsBankEmail, 
  IsBankMobile, 
  IsBankPassword 
} from '../../../common/decorators/is-bank-validated';
import { UserRole } from '../../access-control/enums/user-role.enum';
import { Optional } from '@nestjs/common/decorators/core/optional.decorator';

export class CreateUserDto {
  /* =========================================================================
   * 1. CORE IDENTITY
   * ========================================================================= */

  @IsBankName('first') // Ensures 3-100 chars, no weird symbols
  firstName: string;

  @IsOptional()
  @Matches(/^[a-zA-Z\s\.\-]{0,100}$/, { message: 'Middle name contains invalid characters' })
  middleName?: string | null;

  @IsBankName('last') // Ensures 1-100 chars, no weird symbols
  lastName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address format' })
  email?: string | null;

  @IsOptional()
  @IsBankMobile() // Strips +91 and enforces exactly 10 digits
  phoneNumber?: string;

  // 🛡️ Hacker-Free: Limits size to prevent buffer/database overflow
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Staff ID cannot exceed 10 characters' })
  staffId?: string;

  /* =========================================================================
   * 2. SECURITY
   * ========================================================================= */

  @IsBankPassword() // Enforces 8-25 chars, Upper, Lower, Number, Special
  password: string;

  /* =========================================================================
   * 3. TENANCY & ROLE HIERARCHY
   * ========================================================================= */

  @IsOptional()
  @IsUUID('4', { message: 'Bank ID must be a valid UUID v4' })
  bankId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Branch ID must be a valid UUID v4' })
  branchId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Role ID must be a valid UUID v4' })
  roleId?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Role is mandatory' })
  roleType?: UserRole | null;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid Role Type provided' })
  role?: UserRole | null;

  /* =========================================================================
   * 4. STATUS & PREFERENCES
   * ========================================================================= */

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject({ message: 'Preferences must be a valid JSON object' })
  preferences?: Record<string, any>;
}