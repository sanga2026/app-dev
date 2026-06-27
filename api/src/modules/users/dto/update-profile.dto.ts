import { IsString, IsOptional, IsObject, ValidateNested, IsIn, IsBoolean, MaxLength, IsNotEmpty, isNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { IsBankMobile, IsBankName } from '../../../common/decorators/is-bank-validated';
import { UserRole } from '../../access-control/enums/user-role.enum';
import { not } from 'rxjs/internal/util/not';

// 1. Define the strictly allowed preferences
export class UserPreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  dashboard_layout?: string;

  @IsOptional()
  @IsBoolean()
  is_sidebar_collapsed?: boolean;
}

// 2. Define the main update payload
export class UpdateProfileDto {

 
  @IsBankName('first')
  @IsNotEmpty({ message: 'First name cannot be empty' })
  firstName?: string;

  @IsOptional()
  @IsBankName('middle')
  middleName?: string | null; // Allow null to explicitly clear the middle name

  @IsBankName('last')
  @IsNotEmpty({ message: 'Last name cannot be empty' })
  lastName?: string;

  @IsBankMobile()
  @IsNotEmpty({ message: 'Phone number cannot be empty' })
  phoneNumber?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'Role is mandatory' })
  roleType?: string;

  @IsOptional()
  @IsObject({ message: 'Preferences must be a valid JSON object' })
  preferences?: Record<string, any>;
}