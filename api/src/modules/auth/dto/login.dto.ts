// src/modules/auth/dto/login.dto.ts
import { IsNotEmpty } from 'class-validator';
import { IsBankIdentifier, IsBankPassword } from '../../../common/decorators/is-bank-validated';

export class LoginDto {
  @IsNotEmpty()
  @IsBankIdentifier()
  identifier: string;

  @IsNotEmpty()
  @IsBankPassword()
  password: string;
}