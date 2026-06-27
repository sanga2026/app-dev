// src/modules/global-settings/global-settings.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalSettingsController } from './global-settings.controller';
import { GlobalSettingsService } from './global-settings.service';
import { GlobalSettingEntity } from './entities/global-setting.entity';

@Module({
  // 🛡️ Register the entity so the Repository can be injected into the Service
  imports: [TypeOrmModule.forFeature([GlobalSettingEntity])],
  
  // 🌐 Register the Controller so NestJS maps the /global-settings routes
  controllers: [GlobalSettingsController],
  
  // 🧠 Register the Service containing the business logic
  providers: [GlobalSettingsService],
  
  // 🚀 Export the service in case other backend modules need to read settings directly
  exports: [GlobalSettingsService], 
})
export class GlobalSettingsModule {}