import {
  Injectable, ConflictException, BadRequestException, Logger,
  NotFoundException, InternalServerErrorException, HttpException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';
import { CustomerEntity, KycStatus } from './entities/customer.entity';
import { NumberRangeService } from '../number-ranges/number-range.service';
import { DocumentTypeService } from '../master-data/document-types.service';
import { BankService } from '../banks/banks.service';
import { BranchService } from '../branches/branches.service';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    private readonly nrService: NumberRangeService,
    private readonly masterData: DocumentTypeService,
    private readonly bankService: BankService,
    private readonly branchService: BranchService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 🚀 CREATE: Onboard a new customer under specific bank & branch hierarchy
   */
  async create(dto: any, user: UserEntity) {
    try {
      // 🛡️ 1. IAM GUARD: Identify the target institution context
      const targetBankId = user.role?.role === UserRole.SUPER_ADMIN ? dto.bankId : user.bankId;

      if (!targetBankId) {
        throw new BadRequestException('Institutional Error: Target Bank ID is required.');
      }

      // 🛡️ 2. BANK EXISTENCE & STATUS GUARD
      const bankResult = await this.bankService.findOne(targetBankId, user) as any;
      const bank = bankResult.data;

      const isBankOperational = bank.isActive !== undefined ? bank.isActive : bank.status === 'ACTIVE';
      if (!isBankOperational) {
        throw new BadRequestException(`Onboarding Blocked: Parent Bank '${bank.name}' is currently Inactive.`);
      }

      // 🛡️ 3. BRANCH VALIDATION
      if (!dto.branchId) throw new BadRequestException('Operational Error: A Home Branch must be assigned.');
      
      const branchResult = await this.branchService.findOne(dto.bankId, dto.branchId, user) as any;
      const branch = branchResult.data;

      if (!branch.isActive) {
        throw new BadRequestException(`Onboarding Blocked: Branch '${branch.name}' is suspended.`);
      }
      
      if (branch.bankId !== bank.id) {
        throw new ForbiddenException('Security Violation: Selected branch does not belong to the verified Bank.');
      }

      // 🛡️ 4. DOCUMENT & KYC VALIDATION (Matches entity fields)
      const docType = this.masterData.getDocumentDetails(dto.governmentIdType?.toUpperCase());
      if (!docType) {
        throw new BadRequestException(`Compliance Error: Government ID type '${dto.governmentIdType}' is not supported.`);
      }

      if (!dto.governmentId) {
        throw new BadRequestException('Compliance Error: Government ID identifier value is mandatory.');
      }

      // 🛡️ 5. GLOBAL DUPLICATE CHECK (Enforces @Unique(['bankId', 'governmentId']))
      const existing = await this.customerRepository.findOne({
        where: { governmentId: dto.governmentId.trim().toUpperCase(), bankId: bank.id },
      });
      if (existing) {
        throw new ConflictException(`Identity Conflict: Customer with this ID is already registered at ${bank.name}.`);
      }

      // 🛡️ 6. CUSTOMER NUMBER (CIF) GENERATION
      const customerNo = await this.nrService.getNextNumber(bank.id, 'CUSTOMER');

      // 🛡️ 7. PERSISTENCE (Fully aligned with schema columns)
      const customer = this.customerRepository.create({
        ...dto,
        customerNumber: customerNo,
        bankId: bank.id,
        branchId: branch.id,
        governmentId: dto.governmentId.trim().toUpperCase(),
        governmentIdType: docType.id,
        kycStatus: KycStatus.PENDING,
        isActive: true, 
        isBlacklisted: false,
        isLocked: false,
        createdBy: user.id,
        updatedBy: user.id,
      });

      const saved = await this.customerRepository.save(customer) as unknown as CustomerEntity;

      const auditInfo = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: { name: user.role?.name || 'Authorized User' }
      };

      return {
        success: true,
        statusCode: 201,
        message: `Customer ${saved.firstName} onboarded successfully. CIF: ${saved.customerNumber}`,
        data: saved,
        creator: auditInfo, 
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[CUSTOMER_CREATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException("Critical failure during customer onboarding process.");
    }
  }

  /**
   * 🔍 FIND ONE: Search by UUID, Customer Number (CIF), or unique Government ID
   */
  async findOne(identifier: string, user: UserEntity) {
    try {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(identifier);
      
      let searchCriteria: any = {};
      if (isUuid) {
        searchCriteria.id = identifier;
      } else if (identifier.includes('-')) {
        // Fallback or pattern identification for structural CIFs (e.g. SBI-CUS-1001)
        searchCriteria.customerNumber = identifier.trim();
      } else {
        searchCriteria.governmentId = identifier.trim().toUpperCase();
      }

      // Explicit select map targeting exact entity columns
      const customer = await this.customerRepository.findOne({ 
        where: searchCriteria,
        select: {
          id: true,
          bankId: true,
          branchId: true,
          customerNumber: true,
          title: true,
          firstName: true,
          middleName: true,
          lastName: true,
          guardianName: true,
          dateOfBirth: true,
          gender: true,
          maritalStatus: true,
          marriageDate: true,
          customerCategory: true,
          email: true,
          phoneNumber: true,
          alternatePhoneNumber: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          pinCode: true,
          kycStatus: true,
          kycVerifiedAt: true,
          governmentIdType: true,
          governmentId: true,
          cKycNumber: true,
          eKycNumber: true,
          gstin: true,
          isActive: true,
          isBlacklisted: true,
          isLocked: true,
          metadata: {
            occupation: true,
            caste: true,
            annualIncome: true,
            riskCategory: true,
            tags: true
          },
          createdAt: true,
          updatedAt: true,
          bank: { id: true, name: true, slug: true },
          branch: { id: true, name: true, ifsc: true },
          creator: { firstName: true, lastName: true, role: { name: true } },
          updater: { firstName: true, lastName: true, role: { name: true } }
        },
        relations: ['bank', 'branch', 'creator', 'creator.role', 'updater', 'updater.role']
      });

      if (!customer) {
        throw new NotFoundException(`Customer record '${identifier}' not found.`);
      }

      // 🛡️ Multi-Tenant Isolation Enforcement
      const isSuperAdmin = user.role?.role === UserRole.SUPER_ADMIN;
      if (!isSuperAdmin && customer.bankId !== user.bankId) {
        this.logger.warn(`[SECURITY_ALERT]: User ${user.email} attempted cross-tenant access to Customer ${identifier}`);
        throw new ForbiddenException('Access Denied: You do not have permission to access this customer record.');
      }

      return { success: true, statusCode: 200, data: customer };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[CUSTOMER_FETCH_ERROR]: ${getErrorMessage(error)}`, error instanceof Error ? error.stack : '');
      throw new InternalServerErrorException("An error occurred while retrieving customer details.");
    }
  }

  /**
   * 📝 UPDATE: Modify Core Contact details or Profile Metadata
   */
  async update(id: string, dto: any, user: UserEntity) {
    try {
      const result = await this.findOne(id, user);
      const customer = result.data;

      // 🛡️ 1. SECURITY STATUS GUARD
      if (customer.isBlacklisted || customer.isLocked || !customer.isActive) {
        const reason = customer.isBlacklisted ? 'BLACKLISTED' :
                       customer.isLocked ? 'LOCKED' : 'INACTIVE';
        throw new ForbiddenException(`Update Denied: Account status is marked as ${reason}. Profile modifications frozen.`);
      }

      // 🛡️ 2. IMMUTABILITY GUARD (Matches your schema architecture)
      const lockedFields = ['bankId', 'branchId', 'customerNumber', 'governmentId', 'governmentIdType'];
      const illegalChanges = lockedFields.filter(
        field => dto[field] !== undefined && dto[field].toString() !== customer[field]?.toString()
      );

      if (illegalChanges.length > 0) {
        throw new BadRequestException(`Security Policy: Permanent operational keys (${illegalChanges.join(', ')}) cannot be altered.`);
      }

      // 🛡️ 3. SANITIZATION & METADATA MERGING
      const updatedData = {
        ...dto,
        firstName: dto.firstName?.trim() ?? customer.firstName,
        lastName: dto.lastName?.trim() ?? customer.lastName,
        phoneNumber: dto.phoneNumber?.trim() ?? customer.phoneNumber,
        email: dto.email?.toLowerCase().trim() ?? customer.email,
        metadata: dto.metadata ? { ...customer.metadata, ...dto.metadata } : customer.metadata,
        updatedBy: user.id,
        updatedAt: new Date(),
      };

      // Strip keys just in case
      lockedFields.forEach(field => delete updatedData[field]);

      const merged = this.customerRepository.merge(customer, updatedData);
      const saved = await this.customerRepository.save(merged);

      return {
        success: true,
        message: `Profile ${saved.customerNumber} updated successfully.`,
        data: saved,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[CUSTOMER_UPDATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException("Technical failure during profile update execution.");
    }
  }

  /**
   * 📊 FIND ALL: Target institutional index directory with Multi-Column Search
   */
  async findAll(user: UserEntity, branchId?: string, isActive?: boolean, search?: string) {
    try {
      const baseWhere: any = {};

      // 🛡️ 1. MULTI-TENANT ROUTING ISOLATION
      const isSuperAdmin = user.role?.role === UserRole.SUPER_ADMIN;
      if (!isSuperAdmin) {
        baseWhere.bankId = user.bankId;
      }

      // 🛡️ 2. HIERARCHICAL MAPPING
      if (branchId) baseWhere.branchId = branchId;
      if (isActive !== undefined) baseWhere.isActive = isActive;

      // 🔍 3. FUZZY MATCH ENGINE
      let whereClause: any = baseWhere;
      
      if (search) {
        const searchTerm = `%${search.trim()}%`;
        whereClause = [
          { ...baseWhere, firstName: ILike(searchTerm) },
          { ...baseWhere, lastName: ILike(searchTerm) },
          { ...baseWhere, phoneNumber: ILike(searchTerm) },
          { ...baseWhere, governmentId: ILike(searchTerm) },
          { ...baseWhere, customerNumber: ILike(searchTerm) },
          { ...baseWhere, email: ILike(searchTerm) }
        ];
      }

      const customers = await this.customerRepository.find({
        where: whereClause,
        select: {
          id: true,
          bankId: true,
          branchId: true,
          customerNumber: true,
          title: true,
          firstName: true,
          middleName: true,
          lastName: true,
          customerCategory: true,
          email: true,
          phoneNumber: true,
          city: true,
          state: true,
          kycStatus: true,
          governmentIdType: true,
          governmentId: true,
          isActive: true,
          isBlacklisted: true,
          isLocked: true,
          createdAt: true,
          branch: { id: true, name: true, ifsc: true },
          creator: { firstName: true, lastName: true },
        },
        relations: ['branch', 'creator'],
        order: { createdAt: 'DESC' },
        take: 1000, 
      });

      return {
        success: true,
        statusCode: 200,
        count: customers.length,
        message: `Successfully indexed ${customers.length} records.`,
        data: customers,
      };

    } catch (error) {
      this.logger.error(`[CUSTOMER_LIST_ERROR]: ${getErrorMessage(error)}`, error instanceof Error ? error.stack : '');
      throw new InternalServerErrorException("Failed to compile customer master records directory.");
    }
  }

  /**
   * 🛑 UPDATE STATUS: Process operational override, fraud flags, or manual KYC overrides
   */
  async updateStatus(
    identifier: string, 
    statusDto: { isActive?: boolean; isBlacklisted?: boolean; isLocked?: boolean; kycStatus?: string }, 
    user: UserEntity
  ) {
    try {
      const result = await this.findOne(identifier, user);
      const customer = result.data;

      this.logger.warn(`[STATUS_MUTATION] Context execution by ${user.email} targeting Customer CIF: ${customer.customerNumber}`);

      // 🛡️ 1. APPLY SCHEMATIC MUTATIONS
      if (statusDto.isActive !== undefined) customer.isActive = statusDto.isActive;
      if (statusDto.isBlacklisted !== undefined) customer.isBlacklisted = statusDto.isBlacklisted;
      if (statusDto.isLocked !== undefined) customer.isLocked = statusDto.isLocked;
      
      if (statusDto.kycStatus !== undefined) {
        customer.kycStatus = statusDto.kycStatus as KycStatus;
        if (statusDto.kycStatus === KycStatus.VERIFIED) {
          customer.kycVerifiedAt = new Date();
        }
      }

      // 🛡️ 2. REGULATORY CASCADE RULES
      if (customer.isBlacklisted) {
        customer.isActive = false;
        this.logger.warn(`[AML_COMPLIANCE] Auto-Deactivating localized profile ${customer.customerNumber} due to systemic blacklist assignment.`);
      }

      customer.updatedBy = user.id;
      customer.updatedAt = new Date();

      const saved = await this.customerRepository.save(customer);
      
      const updaterInfo = {
        firstName: user.firstName,
        lastName: user.lastName,
        role: { name: user.role?.name || 'Authorized Systems' }
      };

      return {
        success: true,
        message: `Security matrix matrices updated for Customer profile ${saved.customerNumber}.`,
        data: { 
          id: saved.id, 
          isActive: saved.isActive, 
          isBlacklisted: saved.isBlacklisted, 
          isLocked: saved.isLocked,
          kycStatus: saved.kycStatus,
          kycVerifiedAt: saved.kycVerifiedAt,
          updater: updaterInfo, 
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[STATUS_UPDATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException("Failed to resolve profile status modification request.");
    }
  }
}