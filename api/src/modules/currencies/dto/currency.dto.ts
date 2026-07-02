import { IsString, Length, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'INR', description: 'ISO 4217 3-char currency code' })
  @IsString()
  @Length(3, 3)
  code: string;

  @ApiProperty({ example: 'Indian Rupee' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: '₹' })
  @IsString()
  @Length(1, 10)
  symbol: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces?: number;
}

export class UpdateCurrencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 10)
  symbol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  decimalPlaces?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
