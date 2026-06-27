// src/modules/global-settings/dto/global-setting.dto.ts

import { IsString, IsNotEmpty, IsEnum, IsOptional, ValidateIf } from 'class-validator';

export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

export class CreateSettingDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string; // Always a string, but validated later based on type

  @IsEnum(SettingType)
  @IsNotEmpty()
  type: SettingType;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSettingDto {
  @IsString()
  @IsOptional()
  value?: string;

  @IsString()
  @IsOptional()
  description?: string;
}