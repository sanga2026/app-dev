import { IsEmail, IsNotEmpty } from 'class-validator';
import { IsBankEmail } from '../../../common/decorators/is-bank-validated';

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsBankEmail()
  email: string;
}