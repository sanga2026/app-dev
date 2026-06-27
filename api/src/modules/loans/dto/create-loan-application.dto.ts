import { IsString, IsNumber, Min, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateLoanApplicationDto {
  @IsString()
  @IsNotEmpty({ message: 'Loan Type is mandatory (e.g., PERSONAL, HOME).' })
  loanType: string;

  @IsNumber()
  @Min(1000, { message: 'Requested Amount must be at least 1,000 INR.' })
  requestedAmount: number;

  @IsNumber()
  @Min(0.1, { message: 'Interest Rate must be greater than zero.' })
  interestRate: number;

  @IsNumber()
  @Min(6, { message: 'Minimum loan term is 6 months.' })
  termInMonths: number;

  @IsString()
  @IsNotEmpty({ message: 'Bank Identifier (bankId) is required for clearing.' })
  bankId: string;

  @IsString()
  @IsNotEmpty({ message: 'Branch Identifier (branchId) is required.' })
  @MaxLength(10, { message: 'Branch ID cannot exceed 10 characters.' })
  branchId: string;
}