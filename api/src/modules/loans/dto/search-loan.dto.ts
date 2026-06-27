import { IsOptional, IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchLoanDto {
  @IsOptional()
  @IsString()
  loanType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // --- LOGIC: CHANGED FROM UUID TO STRING ---
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bankId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;
}