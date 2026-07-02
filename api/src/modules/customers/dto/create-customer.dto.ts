import { 
  IsString, IsNotEmpty, IsOptional, IsEmail, 
  IsDateString, IsEnum, MaxLength, ValidateNested, IsObject, Matches
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerCategory } from '../entities/customer.entity';

class CustomerMetadataDto {
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() caste?: string;
  @IsOptional() annualIncome?: number;
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH']) riskCategory?: string;
  @IsOptional() tags?: string[];
}

export class CreateCustomerDto {
  // 🛡️ The Controller will inject BankId & BranchId, but we allow them here 
  // so SuperAdmins can explicitly pass them in the body if needed.
  @IsOptional() @IsString() bankId?: string;
  @IsOptional() @IsString() branchId?: string;

  // --- Identity ---
  // 🚀 FIXED: Renamed to perfectly match the frontend payload and the DB Entity
  @IsString() @IsNotEmpty() @MaxLength(20)
  governmentIdType: string;

  // 🚀 FIXED: Renamed to perfectly match the frontend payload and the DB Entity
  @IsString() @IsNotEmpty() @MaxLength(50)
  governmentId: string;

  // --- Personal Info ---
  @IsOptional() @IsString() @MaxLength(10)
  title?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @IsOptional() @IsString() @MaxLength(100)
  middleName?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  lastName: string;

  @IsOptional() @IsString() @MaxLength(150)
  guardianName?: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @IsOptional() @IsString() @MaxLength(20)
  gender?: string;

  @IsOptional() @IsEnum(CustomerCategory)
  customerCategory?: CustomerCategory;

  @IsOptional() @IsString() @MaxLength(20)
  maritalStatus?: string;

  @IsOptional() @IsDateString()
  marriageDate?: string;

  // --- Contact Info ---
  @IsString() @IsNotEmpty() @MaxLength(20)
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Phone number must be a valid E.164 format' })
  phoneNumber: string;

  @IsOptional() @IsString() @MaxLength(20)
  alternatePhoneNumber?: string;

  @IsOptional() @IsEmail() @MaxLength(150)
  email?: string;

  // --- Address ---
  @IsOptional() @IsString() @MaxLength(255) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(255) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @IsString() @MaxLength(100) country?: string;
  @IsOptional() @IsString() @MaxLength(100) village?: string;
  @IsOptional() @IsString() @MaxLength(20)  pinCode?: string;

  // Pre-generated customer number from the bank's number range sequence
  @IsOptional() @IsString() @MaxLength(50) customerNumber?: string;

  // --- Legacy Compliance Fields ---
  @IsOptional() @IsString() panCardNumber?: string;
  @IsOptional() @IsString() aadhaarNumber?: string;
  @IsOptional() @IsString() drivingLicense?: string;
  @IsOptional() @IsString() voterId?: string;
  @IsOptional() @IsString() passport?: string;
  @IsOptional() @IsString() rationCard?: string;
  @IsOptional() @IsString() cKycNumber?: string;
  @IsOptional() @IsString() eKycNumber?: string;
  @IsOptional() @IsString() gstin?: string;

  // --- Metadata ---
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerMetadataDto)
  metadata?: CustomerMetadataDto;
}