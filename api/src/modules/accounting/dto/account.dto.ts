import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsDateString, IsObject, MaxLength, Min, Max, IsInt, IsPositive
} from 'class-validator';
import { AccountType, AccountStatus, InterestRateType, InterestPayoutFreq } from '../entities/account.entity';

export class CreateTransactionDto {
  @IsEnum(['CREDIT', 'DEBIT'])
  type: 'CREDIT' | 'DEBIT';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsOptional() @IsString() @MaxLength(255)
  note?: string;

  @IsOptional() @IsString() @MaxLength(100)
  reference?: string;
}

export class CreateAccountDto {
  @IsEnum(AccountType)
  accountType: AccountType;

  @IsOptional() @IsString() @MaxLength(30)
  accountSubtype?: string;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsOptional() @IsNumber() @Min(0)
  minimumBalance?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  interestRate?: number;

  @IsOptional() @IsEnum(InterestRateType)
  interestRateType?: InterestRateType;

  @IsOptional() @IsEnum(InterestPayoutFreq)
  interestPayoutFreq?: InterestPayoutFreq;

  @IsOptional() @IsDateString()
  maturityDate?: string;

  @IsOptional() @IsNumber() @Min(0)
  dailyWithdrawalLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  atmDailyLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  onlineTxnDailyLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  overdraftLimit?: number;

  @IsOptional() @IsBoolean()
  pepFlag?: boolean;

  @IsOptional() @IsString() @MaxLength(10)
  riskCategory?: string;

  @IsOptional() @IsInt() @Min(300) @Max(900)
  cibilScore?: number;

  @IsOptional() @IsDateString()
  openedAt?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(30)
  accountSubtype?: string;

  @IsOptional() @IsNumber() @Min(0)
  minimumBalance?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  interestRate?: number;

  @IsOptional() @IsEnum(InterestRateType)
  interestRateType?: InterestRateType;

  @IsOptional() @IsEnum(InterestPayoutFreq)
  interestPayoutFreq?: InterestPayoutFreq;

  @IsOptional() @IsDateString()
  maturityDate?: string;

  @IsOptional() @IsNumber() @Min(0)
  dailyWithdrawalLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  atmDailyLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  onlineTxnDailyLimit?: number;

  @IsOptional() @IsNumber() @Min(0)
  overdraftLimit?: number;

  @IsOptional() @IsBoolean()
  pepFlag?: boolean;

  @IsOptional() @IsString() @MaxLength(10)
  riskCategory?: string;

  @IsOptional() @IsInt() @Min(300) @Max(900)
  cibilScore?: number;

  @IsOptional() @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @IsOptional() @IsString() @MaxLength(30)
  statusReasonCode?: string;

  @IsOptional() @IsString() @MaxLength(100)
  freezeReference?: string;
}
