import { IsString, Length, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCountryDto {
  @ApiProperty({ example: 'IN' })
  @IsString() @Length(2, 2)
  code: string;

  @ApiProperty({ example: 'India' })
  @IsString() @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional() @IsString()
  dialCode?: string;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional() @IsString() @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ example: '🇮🇳' })
  @IsOptional() @IsString()
  flag?: string;
}

export class UpdateCountryDto {
  @IsOptional() @IsString() @Length(1, 100)
  name?: string;
  @IsOptional() @IsString()
  dialCode?: string;
  @IsOptional() @IsString() @Length(3, 3)
  currencyCode?: string;
  @IsOptional() @IsString()
  flag?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateStateDto {
  @ApiProperty({ example: 'Karnataka' })
  @IsString() @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: 'IN-KA' })
  @IsOptional() @IsString()
  code?: string;
}

export class UpdateStateDto {
  @IsOptional() @IsString() @Length(1, 100)
  name?: string;
  @IsOptional() @IsString()
  code?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateTownDto {
  @ApiProperty({ example: 'Bengaluru' })
  @IsString() @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: '560001' })
  @IsOptional() @IsString()
  pinCode?: string;
}

export class UpdateTownDto {
  @IsOptional() @IsString() @Length(1, 150)
  name?: string;
  @IsOptional() @IsString()
  pinCode?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateVillageDto {
  @ApiProperty({ example: 'Koramangala' })
  @IsString() @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: '560034' })
  @IsOptional() @IsString()
  pinCode?: string;
}

export class UpdateVillageDto {
  @IsOptional() @IsString() @Length(1, 150)
  name?: string;
  @IsOptional() @IsString()
  pinCode?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
