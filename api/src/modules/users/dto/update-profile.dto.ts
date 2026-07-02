import { IsString, IsOptional, IsObject, IsIn, IsBoolean, MaxLength, IsNotEmpty, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { IsBankMobile, IsBankName, IsBankEmail } from '../../../common/decorators/is-bank-validated';

// Allowed preferences shape
export class UserPreferencesDto {
  @IsOptional() @IsString() @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional() @IsString()
  language?: string;

  @IsOptional() @IsString()
  dashboard_layout?: string;

  @IsOptional() @IsBoolean()
  is_sidebar_collapsed?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsBankName('first')
  firstName?: string;

  @IsOptional()
  @IsBankName('middle')
  middleName?: string | null;

  @IsOptional()
  @IsBankName('last')
  lastName?: string;

  @IsOptional()
  @IsBankEmail()
  @MaxLength(150)
  email?: string | null;

  @IsOptional()
  @IsBankMobile()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  roleType?: string;

  @IsOptional()
  @IsUUID('4', { message: 'roleId must be a valid UUID.' })
  roleId?: string | null;

  @IsOptional()
  @IsObject({ message: 'Preferences must be a valid JSON object.' })
  preferences?: Record<string, any>;
}