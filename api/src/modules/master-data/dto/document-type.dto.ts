import { 
  IsString, 
  IsNotEmpty, 
  MaxLength, 
  IsOptional, 
  IsBoolean, 
  IsEnum,
  Matches
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
import { DocumentCategory } from '../entities/document-type.entity';

// ==========================================
// 1. CREATE DTO
// ==========================================
export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Document ID code is required (e.g., PAN, AADHAAR).' })
  @Matches(/^[A-Z_]+$/, { message: 'ID must contain only uppercase letters and underscores.' })
  @MaxLength(20)
  id: string; 

  @IsString()
  @IsNotEmpty({ message: 'Document display name is required.' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  // Made mandatory based on your controller logic
  @IsString()
  @IsNotEmpty({ message: 'A Regex validation pattern is required to enforce data integrity.' })
  @MaxLength(255)
  validationRegex: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;
}

// ==========================================
// 2. UPDATE DTO
// ==========================================
// We explicitly omit 'id' because the primary key should NEVER be updated.
export class UpdateDocumentTypeDto extends PartialType(
  OmitType(CreateDocumentTypeDto, ['id'] as const)
) {}

// ==========================================
// 3. STATUS TOGGLE DTO
// ==========================================
export class UpdateDocumentStatusDto {
  @IsBoolean({ message: 'isActive must be a boolean value.' })
  @IsNotEmpty()
  isActive: boolean;
}