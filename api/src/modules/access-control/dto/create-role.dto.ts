// src/modules/access-control/dto/create-role.dto.ts
import { IsString, IsNotEmpty, IsObject, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  slug: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;

  @IsString() @IsOptional()
  description?: string;

  @IsBoolean() @IsOptional()
  isSystemRole?: boolean;

  @IsObject() @IsNotEmpty()
  permissions: Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean }>;
}