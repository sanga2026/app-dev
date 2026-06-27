// src/modules/global-settings/global-settings.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSettingEntity } from './entities/global-setting.entity';
import {
  CreateSettingDto,
  UpdateSettingDto,
  SettingType,
} from './dto/global-setting.dto';

@Injectable()
export class GlobalSettingsService {
  private readonly logger = new Logger(GlobalSettingsService.name);
  private cache: Record<string, any> | null = null;

  constructor(
    @InjectRepository(GlobalSettingEntity)
    private readonly settingRepo: Repository<GlobalSettingEntity>,
  ) {}

  // 🚀 1. GET ALL (Highly performant via Cache)
  async getAllSettings(): Promise<Record<string, any>> {
    if (this.cache) return this.cache;

    const settings = await this.settingRepo.find();

    this.cache = settings.reduce((acc, item) => {
      let val: any = item.value;
      if (item.type === 'json') val = JSON.parse(item.value);
      if (item.type === 'number') val = Number(item.value);
      if (item.type === 'boolean') val = item.value === 'true';

      return { ...acc, [item.key]: val };
    }, {});

    return this.cache;
  }

  // 🛡️ 2. CREATE (Hacker-Free Validation)
  async createSetting(
    dto: CreateSettingDto,
    adminId: string,
  ): Promise<GlobalSettingEntity> {
    // Check if key already exists
    const existing = await this.settingRepo.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        `Setting with key '${dto.key}' already exists.`,
      );
    }

    this.validateValueFormat(dto.value, dto.type);

    // 🚀 Explicit Mapping: Fixes the TS Array error AND prevents prototype pollution
    const newSetting = this.settingRepo.create({
      key: dto.key,
      value: dto.value,
      type: dto.type,
      description: dto.description,
      createdBy: adminId,
    });

    // Explicitly tell TypeORM to save a single entity
    const saved = await this.settingRepo.save<GlobalSettingEntity>(newSetting);

    this.cache = null; // 🧨 Invalidate cache
    this.logger.log(
      `[GLOBAL_SETTING_CREATED]: '${dto.key}' created by Admin ${adminId}`,
    );

    return saved;
  }

  // 🛡️ 3. UPDATE
  async updateSetting(
    key: string,
    dto: UpdateSettingDto,
    adminId: string,
  ): Promise<GlobalSettingEntity> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found.`);
    }

    if (dto.value) {
      this.validateValueFormat(dto.value, setting.type as SettingType);
      setting.value = dto.value;
    }

    if (dto.description) setting.description = dto.description;
    setting.updatedBy = adminId;

    const updated = await this.settingRepo.save(setting);
    this.cache = null; // 🧨 Invalidate cache
    this.logger.log(
      `[GLOBAL_SETTING_UPDATED]: '${key}' updated by Admin ${adminId}`,
    );

    return updated;
  }

  // 🔍 SECURITY GUARD: Prevents corrupting the frontend by saving bad JSON or booleans
  private validateValueFormat(value: string, type: SettingType) {
    if (type === SettingType.BOOLEAN && value !== 'true' && value !== 'false') {
      throw new BadRequestException(
        'Boolean type values must be exactly "true" or "false".',
      );
    }
    if (type === SettingType.NUMBER && isNaN(Number(value))) {
      throw new BadRequestException('Number type values must be numeric.');
    }
    if (type === SettingType.JSON) {
      try {
        JSON.parse(value);
      } catch (e) {
        throw new BadRequestException('Invalid JSON format provided.');
      }
    }
  }
}
