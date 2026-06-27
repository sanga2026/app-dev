import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { IsBankPassword } from '../../../common/decorators/is-bank-validated';

export class UpdatePasswordDto {
  @IsNotEmpty({ message: 'Current password is required' })
  @IsBankPassword()
  currentPassword: string;

  @IsNotEmpty({ message: 'New password is required' })
  @IsBankPassword()
  newPassword: string;
}