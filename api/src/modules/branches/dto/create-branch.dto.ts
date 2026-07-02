import { 
  IsNotEmpty, 
  IsOptional, 
  IsString, 
  IsUUID, 
  IsBoolean, 
  Length, 
  Matches, 
  MaxLength, 
  IsEmail, 
  IsObject,
  IsEnum,
  IsDateString
} from 'class-validator';

// 💡 Make sure to import this from your branch.entity file, or define it here if you prefer.
export enum BranchType {
  HEAD_OFFICE = 'HEAD_OFFICE',
  ZONAL_OFFICE = 'ZONAL_OFFICE',
  REGIONAL_OFFICE = 'REGIONAL_OFFICE',
  RETAIL_BRANCH = 'RETAIL_BRANCH',
  CORPORATE_BRANCH = 'CORPORATE_BRANCH',
  SERVICE_CENTER = 'SERVICE_CENTER'
}

export class CreateBranchDto {

  // --- 1. TENANT HIERARCHY ---

  @IsOptional()
  @IsUUID()
  bankId?: string;

  // --- 2. CORE IDENTITY ---

  @IsNotEmpty({ message: 'Branch name is mandatory (e.g., Indiranagar Branch).' })
  @IsString()
  @MaxLength(100)
  name: string;

  // 🚀 NEW: Added Branch Type
  @IsNotEmpty({ message: 'Branch Type is mandatory.' })
  @IsEnum(BranchType, { message: 'Invalid Branch Type provided.' })
  branchType: BranchType;

  // 🚀 NEW: Added Opening Date
  @IsNotEmpty({ message: 'Inauguration date is mandatory.' })
  @IsDateString({}, { message: 'Must be a valid ISO date string (YYYY-MM-DD).' })
  openingDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.' })
  slug?: string;

  // --- 3. BANKING ROUTING & CODES ---

  @IsNotEmpty({ message: 'IFSC Code is mandatory for branch operations.' })
  @IsString()
  @Length(11, 11, { message: 'Standard Violation: IFSC must be exactly 11 characters.' })
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { 
    message: 'Invalid IFSC format. Expected 4 letters, then 0, then 6 alphanumeric characters (e.g., SBIN0012345).' 
  })
  ifsc: string;

  // 🚀 NEW: Added MICR Code
  @IsOptional()
  @IsString()
  @Length(9, 9, { message: 'MICR code must be exactly 9 characters long.' })
  micrCode?: string;

  // 🚀 NEW: Added SWIFT Code
  @IsOptional()
  @IsString()
  @Length(8, 11, { message: 'SWIFT code must be between 8 and 11 characters long.' })
  swiftCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // --- 4. CONTACT & LOCATION ---

  @IsNotEmpty({ message: 'Address Line 1 is mandatory.' })
  @IsString()
  @MaxLength(255)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsNotEmpty({ message: 'City is mandatory.' })
  @IsString()
  @MaxLength(100)
  city: string;

  // 🚀 NEW: Added Village
  @IsOptional()
  @IsString()
  @MaxLength(100)
  village?: string;

  @IsNotEmpty({ message: 'State is mandatory.' })
  @IsString()
  @MaxLength(100)
  state: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @IsNotEmpty({ message: 'Postal Code is mandatory.' })
  @IsString()
  @MaxLength(10)
  postalCode: string;

  @IsNotEmpty({ message: 'Phone number is mandatory.' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'If provided, branch email must be a valid email address.' })
  @MaxLength(150)
  email?: string;

  // --- 5. EXTENSIBILITY ---

  @IsOptional()
  @IsObject()
  metadata?: {
    managerName?: string;
    openingTime?: string;
    closingTime?: string;
    isAtmAvailable?: boolean;
    tier?: 'METRO' | 'URBAN' | 'SEMI-URBAN' | 'RURAL'; // 🚀 UPDATED: Added SEMI-URBAN
    gstin?: string;               // 🚀 NEW: Added to metadata
    cashRetentionLimit?: number;  // 🚀 NEW: Added to metadata
  };
}