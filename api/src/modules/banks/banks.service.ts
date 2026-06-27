// src/modules/banks/banks.service.ts

import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import slugify from 'slugify';

// Entities & Enums
import { BankEntity } from './entities/bank.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';

// DTOs
import { CreateBankDto } from './dto/create-bank.dto';
import { OnboardBankDto } from './dto/onboard-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

// Utils
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class BankService {
  private readonly logger = new Logger(BankService.name);

  constructor(
    @InjectRepository(BankEntity)
    private readonly bankRepo: Repository<BankEntity>,
  ) {}

  /**
   * 🚀 ONBOARD TENANT (Simplified & Streamlined)
   * Creates the Bank with its SaaS plan. Admin assignment happens later.
   */
// src/modules/banks/banks.service.ts

async onboardTenant(dto: OnboardBankDto, requester: UserEntity) {
  try {
    // 1. Normalize Inputs (Prevention of case-sensitivity duplicates)
    const normalizedTaxId = dto.taxIdentifier.trim().toUpperCase();
    const normalizedIfsc = dto.ifscPrefix.trim().toUpperCase();
    
    // 🛡️ HACKER-FREE SLUG: Append TaxID slice to allow duplicate bank names while keeping URLs unique
    const baseSlug = slugify(dto.name, { lower: true, strict: true, trim: true });
    const bankSlug = `${baseSlug}-${normalizedTaxId.slice(-4)}`;

    // 2. SURGICAL DUPLICATE CHECK (Check individual regulatory unique fields)
    const existing = await this.bankRepo.findOne({
      where: [
        { slug: bankSlug }, 
        { taxIdentifier: normalizedTaxId },
        { ifscPrefix: normalizedIfsc }
      ],
    });

    if (existing) {
      // 🕵️ Pinpoint exactly which unique constraint was violated
      let conflictDetail = `Bank name '${dto.name}' is already registered with a similar profile.`;
      
      if (existing.taxIdentifier === normalizedTaxId) {
        conflictDetail = `Tax ID (GSTIN/PAN) '${normalizedTaxId}' is already linked to another institution.`;
      } else if (existing.ifscPrefix === normalizedIfsc) {
        conflictDetail = `IFSC Prefix '${normalizedIfsc}' is already in use by another bank.`;
      }

      throw new ConflictException(conflictDetail);
    }

    // 3. CREATE ENTITY
    const bank = this.bankRepo.create({
      ...dto,
      slug: bankSlug,
      taxIdentifier: normalizedTaxId,
      ifscPrefix: normalizedIfsc,
      isActive: true,
      settings: { 
        ...dto.settings, // Preserve any other settings passed
        subscriptionPlan: dto.subscriptionPlan 
      },
      createdBy: requester.id,
      updatedBy: requester.id,
    });

    const savedBank = await this.bankRepo.save(bank);
    
    this.logger.log(`[TENANT_ONBOARD_SUCCESS]: ${savedBank.name} provisioned with Slug: ${savedBank.slug}`);

    // 4. RETURN SUCCESSFUL RICH RESPONSE
    return {
      success: true,
      message: `Institution '${savedBank.name}' has been successfully provisioned on the ${dto.subscriptionPlan} plan.`,
      data: savedBank,
    };

  } catch (error) {
    // 🛡️ RE-THROW intentional NestJS exceptions (409 Conflict, 400 Bad Request, etc.)
    if (error instanceof HttpException) throw error;

    // Fallback for Database-level constraint naming violations (The UQ_... error)
    if ((error as any).code === '23505') {
      throw new ConflictException('A duplicate entry was detected. Please verify that the Tax ID and IFSC Prefix are unique.');
    }

    this.logger.error(`[BANK_ONBOARD_CRITICAL]: ${getErrorMessage(error)}`);
    throw new InternalServerErrorException('A system error occurred during bank provisioning. Please try again or contact support.');
  }
}

  /**
   * 🏢 CREATE: Standard Bank Entity Creation
   */
  async create(dto: CreateBankDto, requester: UserEntity) {
    try {
      const bankSlug = slugify(dto.name, { lower: true, strict: true, trim: true });
      const normalizedTaxId = dto.taxIdentifier.trim().toUpperCase();

      const existing = await this.bankRepo.findOne({
        where: [{ slug: bankSlug }, { taxIdentifier: normalizedTaxId }],
      });

      if (existing) {
        throw new ConflictException('A bank with this Name or Tax ID already exists.');
      }

      const bank = this.bankRepo.create({
        ...dto,
        slug: bankSlug,
        taxIdentifier: normalizedTaxId,
        isActive: true,
        createdBy: requester.id,
        updatedBy: requester.id,
      });

      const saved = await this.bankRepo.save(bank);
      
      return {
        success: true,
        message: `Bank '${saved.name}' created successfully.`,
        data: saved,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BANK_CREATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to create bank entity.');
    }
  }

  /**
   * 📊 FIND ALL: Global list for SUPER_ADMIN
   * 🚀 ADJUSTED: Supports limit/offset for Angular Table performance
   */
  async findAll(limit: number = 10, offset: number = 0) {
    try {
      const [banks, total] = await this.bankRepo.findAndCount({
        take: limit,
        skip: offset,
        relations: ['creator', 'creator.role', 'updater', 'updater.role'],
        order: { name: 'ASC' },
      });

      return {
        success: true,
        total,
        data: banks,
      };
    } catch (error) {
      this.logger.error(`[BANK_FIND_ALL_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve the bank registry.');
    }
  }

  /**
   * 🔍 FIND ONE: Lookup bank by UUID or Slug
   */
  async findOne(identifier: string, userContext?: UserEntity) {
    try {
      if (!identifier || identifier === 'null') {
        throw new BadRequestException('Valid Bank Identifier is required.');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);
      const searchCriteria = isUuid ? { id: identifier } : { slug: identifier.toLowerCase().trim() };

      const bank = await this.bankRepo.findOne({
        where: searchCriteria,
        relations: ['creator', 'creator.role', 'updater', 'updater.role'],
      });

      if (!bank) {
        throw new NotFoundException(`Bank '${identifier}' not found.`);
      }

      // 🔒 IAM SECURITY: Verify roleType based on DB schema
      if (userContext && userContext.roleType !== UserRole.SUPER_ADMIN) {
        if (bank.id !== userContext.bankId) {
          this.logger.warn(`[SECURITY_ALERT] Tenant Bypass Attempt: ${userContext.email} -> ${bank.slug}`);
          throw new ForbiddenException('Access Denied: This institution belongs to another tenant.');
        }
      }

      return {
        success: true,
        data: bank,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BANK_FETCH_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Error fetching bank details.');
    }
  }

  /**
   * 📝 UPDATE: Profile modifications
   */
  async update(id: string, dto: UpdateBankDto, requester: UserEntity) {
    try {
      const result = await this.findOne(id);
      const bank = result.data;

      // 🛡️ SECURITY: Immutable field protection
      const immutableFields = ['slug', 'taxIdentifier', 'registrationNumber', 'ifscPrefix'];
      const violations = immutableFields.filter(key => 
        dto[key as keyof UpdateBankDto] && 
        dto[key as keyof UpdateBankDto]?.toString().toLowerCase() !== bank[key as keyof BankEntity]?.toString().toLowerCase()
      );

      if (violations.length > 0) {
        throw new BadRequestException(`Security Violation: Foundational IDs are immutable: ${violations.join(', ')}`);
      }

      const merged = this.bankRepo.merge(bank, {
        ...dto,
        metadata: dto.metadata ? { ...bank.metadata, ...dto.metadata } : bank.metadata,
        settings: dto.settings ? { ...bank.settings, ...dto.settings } : bank.settings,
        updatedBy: requester.id,
      });

      const saved = await this.bankRepo.save(merged);

      return {
        success: true,
        message: `Institution profile for '${saved.name}' updated successfully.`,
        data: saved,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BANK_UPDATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('System error during profile update.');
    }
  }

  /**
   * 🛑 UPDATE STATUS: Boolean Toggle
   */
  async updateStatus(id: string, isActive: boolean, user: UserEntity) {
    try {
      const result = await this.findOne(id);
      const bank = result.data;

      bank.isActive = isActive;
      bank.updatedBy = user.id;

      const saved = await this.bankRepo.save(bank);

      this.logger.log(`[STATUS_CHANGE]: Bank ${bank.slug} set to ${isActive} by ${user.email}`);

      return {
        success: true,
        message: `Bank '${saved.name}' is now ${saved.isActive ? 'Active' : 'Inactive'}.`,
        data: { id: saved.id, isActive: saved.isActive },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BANK_STATUS_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to change bank operational status.');
    }
  }

}