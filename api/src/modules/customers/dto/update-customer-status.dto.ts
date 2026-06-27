// src/modules/customers/dto/update-customer-status.dto.ts

import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { KycStatus } from '../entities/customer.entity';

export class UpdateCustomerStatusDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isBlacklisted?: boolean;
  @IsOptional() @IsBoolean() isLocked?: boolean;
  @IsOptional() @IsEnum(KycStatus) kycStatus?: KycStatus;
}