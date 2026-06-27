// src/modules/global-settings/global-settings.controller.ts

import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Param, 
  Body, 
  UseGuards, 
  SetMetadata, 
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { GlobalSettingsService } from './global-settings.service';
import { CreateSettingDto, UpdateSettingDto } from './dto/global-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 
import { RolesGuard } from '../auth/guards/roles.guard';       
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';

@Controller('global-settings')
export class GlobalSettingsController {
  constructor(private readonly settingsService: GlobalSettingsService) {}

  // 🌐 1. PUBLIC GET (Open to Angular App Initializer)
  @Get()
  async getAllSettings() {
    const settings = await this.settingsService.getAllSettings();
    return {
      success: true,
      message: 'Global settings retrieved successfully.',
      data: settings,
    };
  }

  // 🛡️ 2. SECURE POST (Super Admin Only)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // 👈 Triple-Lock specific to POST
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  async createSetting(
    @Body() dto: CreateSettingDto,
    @CurrentUser() admin: UserEntity,
  ) {
    console.log('\n👉 [HTTP POST] /global-settings hit! Controller reached.');
    console.log(`👉 [PAYLOAD] Key: ${dto.key}, Admin: ${admin?.email}\n`);

    dto.key = dto.key.toUpperCase().trim();
    const newSetting = await this.settingsService.createSetting(dto, admin.id);

    return {
      success: true,
      message: `Setting '${newSetting.key}' created successfully.`,
      data: newSetting,
    };
  }

  // 🛡️ 3. SECURE PATCH (Super Admin Only)
  @Patch(':key') // 👈 Changed from ':id' back to ':key' to match the Param
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // 👈 Triple-Lock specific to PATCH
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  async updateSetting(
    @Param('key') key: string, // 👈 Now this will correctly map to the URL
    @Body() dto: UpdateSettingDto,
    @CurrentUser() admin: UserEntity,
  ) {
    const sanitizedKey = key.toUpperCase().trim();
    
    const updatedSetting = await this.settingsService.updateSetting(
      sanitizedKey, 
      dto, 
      admin.id
    );

    return {
      success: true,
      message: `Setting '${sanitizedKey}' updated successfully.`,
      data: updatedSetting,
    };
  }
}