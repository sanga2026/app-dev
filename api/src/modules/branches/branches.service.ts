import {
  Injectable, ConflictException, NotFoundException, Logger,
  InternalServerErrorException, BadRequestException, HttpException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { BranchEntity } from './entities/branch.entity';
import { BankService } from '../banks/banks.service';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);

  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    private readonly bankService: BankService,
  ) {}

/**
   * 🚀 CREATE: Onboards a new branch
   */
/**
   * 🚀 CREATE: Onboards a new branch with Auto-Generated Branch Code
   */
  async create(bankId: string, dto: any, user: UserEntity) {
    try {
      // 🛡️ 1. TENANT RESOLUTION & RBAC
      if (user.roleType !== UserRole.SUPER_ADMIN && user.bankId !== bankId) {
        throw new ForbiddenException('Security Violation: Access denied for the requested bank context.');
      }

      // 🛡️ 2. PARENT BANK VALIDATION
      const bankResult = await this.bankService.findOne(bankId);
      if (!bankResult?.data) {
        throw new NotFoundException(`Parent Bank not found.`);
      }
      
      const bank = bankResult.data;
      if (!bank.isActive) {
        throw new BadRequestException(`Operational Block: Parent Bank '${bank.name}' is currently inactive.`);
      }

      // 🛡️ 3. IFSC PREFIX VALIDATION
      const rawIfsc = dto.ifsc.toUpperCase().trim();
      const inputPrefix = rawIfsc.substring(0, 4);
      const bankPrefix = bank.ifscPrefix.toUpperCase();

      if (inputPrefix !== bankPrefix) {
        throw new BadRequestException(`IFSC Prefix Mismatch: Must start with ${bankPrefix}.`);
      }

      // 🚀 4. AUTO-GENERATE BRANCH CODE
      // Find the branch with the highest numeric code for this specific bank
      const lastBranch = await this.branchRepo.findOne({
        where: { bankId: bank.id },
        order: { branchCode: 'DESC' }
      });

      let newBranchCodeNumber = 1; // Default to 1 if this is the very first branch
      
      if (lastBranch && lastBranch.branchCode) {
         // Attempt to parse the last code. If it's numeric (e.g. "000015"), increment it.
         const lastCodeNum = parseInt(lastBranch.branchCode, 10);
         if (!isNaN(lastCodeNum)) {
             newBranchCodeNumber = lastCodeNum + 1;
         }
      }

      // Pad with zeros to 6 digits (e.g., 1 becomes "000001")
      const generatedBranchCode = String(newBranchCodeNumber).padStart(6, '0');
      const generatedSlug = `${bank.slug}-${generatedBranchCode}`;

      // 🛡️ 5. DATA NORMALIZATION
      const normalizedMicr = dto.micrCode ? String(dto.micrCode).toUpperCase().trim() : null;
      const normalizedSwift = dto.swiftCode ? String(dto.swiftCode).toUpperCase().trim() : null;

      // 🛡️ 6. PERSISTENCE
      const branch = this.branchRepo.create({
        ...dto,
        bankId: bank.id,
        name: dto.name.trim(),
        slug: generatedSlug,
        ifsc: rawIfsc,
        branchCode: generatedBranchCode, // 🚀 Inject the auto-generated code
        micrCode: normalizedMicr,
        swiftCode: normalizedSwift,
        isActive: true,
        createdBy: user.id,
        updatedBy: user.id,
      });

      const saved = await this.branchRepo.save(branch) as unknown as BranchEntity;
      this.logger.log(`[BRANCH_CREATED] Auto-Generated Code ${saved.branchCode} linked to Bank: ${bank.name}`);

      return {
        success: true,
        message: `Branch '${saved.name}' onboarded successfully with code ${saved.branchCode}.`,
        data: saved,
      };

    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      
      if (error.code === '23505') {
        throw new ConflictException(`Identity Conflict: A branch with this IFSC or Branch Code already exists.`);
      }

      this.logger.error(`[BRANCH_CREATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Critical technical error during branch creation.');
    }
  }

  /**
   * 🔍 FIND ONE: Database-Level Tenant Isolation
   */
  async findOne(bankId: string, identifier: string, user: UserEntity) {
    try {
      // 1. 🔒 IAM SECURITY: Verify authorization for this bankId
      if (user.roleType !== UserRole.SUPER_ADMIN && user.bankId !== bankId) {
        throw new ForbiddenException('Access Denied: You do not have permission to view branches for this institution.');
      }

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);
      
      // 2. 🚀 FAST FETCH: Enforce bankId directly in the SQL query
      const branch = await this.branchRepo.findOne({
        where: isUuid ? { id: identifier, bankId } : { slug: identifier.toLowerCase().trim(), bankId },
        relations: ['creator', 'creator.role', 'updater', 'updater.role']
      });

      if (!branch) {
        throw new NotFoundException(`Branch lookup failed or access restricted.`);
      }

      return { success: true, data: branch };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BRANCH_VIEW_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('An error occurred while retrieving branch details.');
    }
  }
/**
   * 📊 FIND ALL BY BANK (With Advanced Multi-Column Search)
   */
  async findAllByBank(bankId: string, user: UserEntity, query: { limit: number; offset: number; search?: string }) {
    try {
      // 1. SECURITY: Cross-Tenant Validation
      if (user.roleType !== UserRole.SUPER_ADMIN && user.bankId !== bankId) {
        throw new ForbiddenException('Access Denied: You cannot view branches for another institution.');
      }

      // 2. 🚀 BUILD SEARCH CRITERIA
      let whereClause: any = { bankId: bankId }; // Default: just get all branches for this bank

      if (query.search) {
        const searchTerm = `%${query.search.trim()}%`;
        
        // 🚀 UPDATED: Added village, micrCode, and swiftCode to the global search
        whereClause = [
          { bankId: bankId, name: ILike(searchTerm) },
          { bankId: bankId, branchCode: ILike(searchTerm) },
          { bankId: bankId, ifsc: ILike(searchTerm) },
          { bankId: bankId, micrCode: ILike(searchTerm) }, // 👈 NEW
          { bankId: bankId, swiftCode: ILike(searchTerm) }, // 👈 NEW
          { bankId: bankId, city: ILike(searchTerm) },
          { bankId: bankId, state: ILike(searchTerm) },
          { bankId: bankId, village: ILike(searchTerm) }    // 👈 NEW
        ];
      }

      // 3. FETCH DATA
      const [branches, total] = await this.branchRepo.findAndCount({
        where: whereClause,
        take: query.limit,
        skip: query.offset,
        order: { name: 'ASC' }, // Sort alphabetically by branch name
      });

      return {
        success: true,
        message: `Successfully retrieved branches.`,
        total,
        data: branches,
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BRANCH_LIST_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException(`Could not load branches.`);
    }
  }

  /**
   * 📝 UPDATE: Smart Immutability Check
   */
  async update(bankId: string, branchId: string, dto: any, user: UserEntity) {
    const result = await this.findOne(bankId, branchId, user);
    const branch = result.data;

    // 🛡️ REFINED IMMUTABILITY CHECK
    const immutableFields = ['slug', 'branchCode', 'bankId', 'ifsc'];
    const illegal = immutableFields.filter((field) => {
      const newValue = dto[field];
      if (newValue === undefined) return false;
      return String(newValue).trim().toLowerCase() !== String((branch as any)[field] || '').trim().toLowerCase();
    });

    if (illegal.length > 0) {
      throw new BadRequestException(`Security Violation: Core identifiers (${illegal.join(', ')}) are immutable.`);
    }

    const { id, creator, createdAt, updatedBy, updatedAt, ...safeDto } = dto;

    const updated = this.branchRepo.merge(branch, {
      ...safeDto,
      updatedBy: user.id,
      updatedAt: new Date(), 
    });

    try {
      const saved = await this.branchRepo.save(updated);
      this.logger.log(`[BRANCH_UPDATE] Branch '${saved.name}' updated by ${user.email}`);
      
      return { success: true, message: `Branch updated successfully.`, data: saved };
    } catch (error) {
      this.logger.error(`[BRANCH_UPDATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to save branch updates.');
    }
  }

  /**
   * 🛑 UPDATE STATUS: Boolean Toggle
   */
  async updateStatus(bankId: string, branchId: string, isActive: boolean, user: UserEntity) {
    const result = await this.findOne(bankId, branchId, user);
    const branch = result.data;

    branch.isActive = isActive;
    branch.updatedBy = user.id;
    branch.updatedAt = new Date();

    const saved = await this.branchRepo.save(branch);
    this.logger.warn(`[BRANCH_STATUS] ${saved.ifsc} set to ${isActive} by ${user.email}`);

    return {
      success: true,
      message: `Branch status updated.`,
      data: { id: saved.id, isActive: saved.isActive }
    };
  }

  /**
   * 🗑️ DELETE BRANCH
   */
  async delete(bankId: string, branchId: string, user: UserEntity) {
    const result = await this.findOne(bankId, branchId, user);
    
    try {
      await this.branchRepo.remove(result.data);
      this.logger.log(`[BRANCH_DELETED] Branch ${branchId} removed by ${user.email}`);
      return { success: true, message: 'Branch permanently deleted.' };
    } catch (error) {
      this.logger.error(`[BRANCH_DELETE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to delete branch. It may have associated records.');
    }
  }

}