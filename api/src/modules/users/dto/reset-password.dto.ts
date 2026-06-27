// src/modules/auth/dto/reset-password.dto.ts
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsBankPassword } from '../../../common/decorators/is-bank-validated';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsString()
  token: string;

 @IsNotEmpty()
 @IsBankPassword()
  password: string;
}