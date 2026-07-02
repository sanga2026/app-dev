import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  Logger,
  ForbiddenException,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { BankService } from '../banks/banks.service';
import { BranchService } from '../branches/branches.service';
import { RoleEntity } from '../access-control/entities/role.entity';
import { UserRole } from '../access-control/enums/user-role.enum';
import { getErrorMessage } from '../../common/utils/error-handler.util';
import * as bcrypt from 'bcrypt';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { AuditService } from '../audit/audit.service';

/**
 * Interface for User Search Filters
 * Aligns with Controller @Query parameters
 */
export interface UserSearchFilters {
  roleId?: string;
  branchId?: string;
  staffId?: string; // 🔍 HDFC Standard lookup
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Inject(forwardRef(() => BankService))
    private readonly bankService: BankService,
    private readonly branchService: BranchService,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * CREATE SUPER ADMIN (Bootstrap)
   * logic: Creates the Platform Owner with Global Scope (bankId: null).
   */
  async createSuperAdmin(dto: any) {
    try {
      const { email, password } = dto;
      const normalizedEmail = email.toLowerCase().trim();

      // 1. Uniqueness Check
      const existing = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      if (existing)
        throw new ConflictException(
          'Identity Conflict: This email is already registered.',
        );

      // 2. Fetch the Master 'SUPER_ADMIN' role from DB
      const saRole = await this.roleRepo.findOne({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (!saRole)
        throw new InternalServerErrorException(
          'System Error: Super Admin role not initialized.',
        );

      // 3. Create Entity (Username and StaffID are auto-generated)
      const user = this.userRepo.create({
        ...dto,
        email: normalizedEmail,
        username: await this.generateUniqueUsername('SA'),
        staffId: this.generateStaffId(),
        roleId: saRole.id,
        roleType: UserRole.SUPER_ADMIN,
        bankId: null,
        branchId: null,
        isActive: true,
      });

      const saved = (await this.userRepo.save(user)) as unknown as UserEntity;

      // Self-Audit (First user in the system)
      await this.userRepo.update(saved.id, {
        createdBy: saved.id,
        updatedBy: saved.id,
      });

      return {
        success: true,
        message: 'Platform Owner onboarded successfully.',
        data: saved,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[BOOTSTRAP_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException(
        'Failed to initialize Super Admin.',
      );
    }
  }

  /**
   * CREATE BANK USER (Onboarding)
   * logic: Enforces Tenant Isolation and Banking ID standards.
   */
  async createUser(dto: any, adminUser: UserEntity) {
    try {
      const { email, roleType, bankId, branchId } = dto;

      const normalizedEmail = email?.toLowerCase().trim();

      // 1. Validation: Identity Conflict
  
      const existing = await this.userRepo.findOne({
        where: { email: normalizedEmail },
      });
      
      if (existing && normalizedEmail)
        throw new ConflictException('A user with this email already exists.');
        

      if (!roleType)
        throw new BadRequestException('Role identifier (Slug) is required.');

      if (roleType === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException(
          'The SUPER_ADMIN role is restricted and cannot be assigned manually.',
        );
      }
      // 🚀 2. Tenant Lockdown (Moved UP for secure queries)
      // If Super Admin, they can assign users to ANY bank. Otherwise, lock to Admin's bank.
      const targetBankId =
        adminUser.roleType === UserRole.SUPER_ADMIN ? bankId : adminUser.bankId;

      // 🛡️ 3. Smart Role Lookup (Global OR Tenant-Specific)
      const sanitizedSlug = roleType.toUpperCase().trim();
      
      const targetRole = await this.roleRepo.findOne({
        where: [
          // Match 1: Is it a custom role for THIS bank?
          {
            role: sanitizedSlug,
            bankId: targetBankId === null ? IsNull() : targetBankId,
          },
          // Match 2: Is it a Global Template provided by the Super Admin?
          { role: sanitizedSlug, bankId: IsNull() },
        ],
      });

      if (!targetRole) {
        throw new NotFoundException(
          `Role '${sanitizedSlug}' is invalid or not available for your institution.`,
        );
      }

      // 4. Security Guard: Prevent non-SuperAdmins from creating SuperAdmins
      if (
        targetRole.role === UserRole.SUPER_ADMIN &&
        adminUser.roleType !== UserRole.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          'Security Policy: Only Platform Owners can onboard Super Admins.',
        );
      }

      // 5. Validate UUIDs if provided
      const uuidFields = { bankId: targetBankId, branchId };
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      for (const [key, value] of Object.entries(uuidFields)) {
        if (value && !uuidRegex.test(value)) {
          throw new BadRequestException(
            `Validation Failed: The field '${key}' must be a valid UUID.`,
          );
        }
      }

      // 🚀 6. Dynamic Prefix Logic
      const roleCode = targetRole.role
        .split('_')
        .map((w) => w[0])
        .join('')
        .toUpperCase();
      let dynamicPrefix = targetBankId ? roleCode : roleCode;

      // 7. Generate Identifiers
      const username = await this.generateUniqueUsername(dynamicPrefix);
      const staffId = this.generateStaffId();

      // 8. Create Entity
      const user = this.userRepo.create({
        ...dto,
        username,
        staffId,
        email: normalizedEmail,
        bankId: targetBankId || null,
        branchId: branchId || null,
        roleId: targetRole.id, // Foreign Key to the Role entity
        roleType: targetRole.role, // String identifier for Guards
        isActive: true,
        createdBy: adminUser.id,
        updatedBy: adminUser.id,
      });

      const saved = (await this.userRepo.save(user)) as unknown as UserEntity;

      // 9. Rich Audit Response
      const auditInfo = {
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.roleType || 'Authorized User',
      };

      return {
        success: true,
        message: `User ${saved.firstName} successfully onboarded.`,
        data: {
          ...saved,
          role: { name: targetRole.name, slug: targetRole.role },
          creator: auditInfo,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[CREATE_USER_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('User onboarding failed.');
    }
  }

  /**
   * ASSIGN ROLE TO USER (Hybrid Lookup)
   * logic: Supports UUID or Slug (e.g., 'BRANCH_MANAGER')
   * Security: Enforces Tenant Isolation and Hierarchy Protection.
   */
  async assignRoleToUser(
    targetUserId: string,
    roleIdentifier: string,
    admin: UserEntity,
  ) {
    // 1. Fetch the target user (Verifying they belong to the same bank)
    const result = await this.findOne(targetUserId, admin);
    const targetUser = result.data;

    // 2. Identify if roleIdentifier is a UUID or a Slug
    const isUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        roleIdentifier,
      );

    // 3. Fetch the new role
    const newRole = await this.roleRepo.findOne({
      where: isUuid
        ? { id: roleIdentifier }
        : { role: roleIdentifier.toLowerCase().trim() },
    });

    if (!newRole) {
      throw new NotFoundException(
        `Role assignment failed: '${roleIdentifier}' is not a valid role.`,
      );
    }

    // 4. 🛡️ HIERARCHY GUARD
    // Prevent Bank Admins from assigning a Super Admin role to anyone.
    if (
      newRole.role === UserRole.SUPER_ADMIN &&
      admin.role?.role !== UserRole.SUPER_ADMIN
    ) {
      this.logger.error(
        `[SECURITY_VIOLATION]: ${admin.email} attempted to assign SUPER_ADMIN role.`,
      );
      throw new ForbiddenException(
        'Escalation Denied: You do not have the authority to assign a Global Role.',
      );
    }

    // 5. 🛡️ TENANT ISOLATION
    // Ensure Bank Admins only assign roles that belong to their bank (or Global roles)
    if (admin.role?.role !== UserRole.SUPER_ADMIN) {
      if (newRole.bankId !== null && newRole.bankId !== admin.bankId) {
        throw new ForbiddenException(
          'Access Denied: This role belongs to another institution.',
        );
      }
    }

    // 6. Update and Audit
    targetUser.roleId = newRole.id;
    targetUser.roleType = newRole.role as UserRole; // Keep the enum in sync
    targetUser.updatedBy = admin.id;

    try {
      const saved = await this.userRepo.save(targetUser);
      this.logger.log(
        `[ROLE_CHANGE]: ${saved.staffId} updated to ${newRole.name} by ${admin.email}`,
      );

      return {
        success: true,
        message: `Role '${newRole.name}' assigned successfully to ${saved.firstName}.`,
        data: {
          staffId: saved.staffId,
          role: newRole.name,
          slug: newRole.role,
        },
      };
    } catch (error) {
      this.logger.error(`[ROLE_ASSIGN_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to update user role.');
    }
  }
  /**
   * FIND ALL (Multi-Tenant Scoping)
   */
  async findAll(requester: UserEntity, filters: any = {}) {
    // 🚀 1. Default filters to {}
    try {
      // 🚀 2. THE FAIL-FAST GUARD
      // If the controller fails to pass a user, stop immediately.
      if (!requester) {
        throw new UnauthorizedException(
          'Access Denied: Requester context is missing.',
        );
      }

      const { role, branchId, staffId, isActive, search } = filters;
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      const query = this.userRepo
        .createQueryBuilder('user')
        // 1. Select Core User Fields
        .select([
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.username',
          'user.staffId',
          'user.phoneNumber',
          'user.isActive',
          'user.createdAt',
          'user.roleType',
        ])
        // 2. Standard Relations
        .leftJoin('user.role', 'role')
        .addSelect(['role.name'])
        .leftJoin('user.bank', 'bank')
        .addSelect(['bank.name'])
        .leftJoin('user.branch', 'branch')
        .addSelect(['branch.name'])

        // 3. Self-Joins for Creator and Updater
        .leftJoin('user.creator', 'creator')
        .addSelect(['creator.firstName', 'creator.lastName'])

        .leftJoin('user.updater', 'updater')
        .addSelect(['updater.firstName', 'updater.lastName']);

      // 🛡️ 4. TENANT ISOLATION
      // Now safe because we guaranteed 'requester' exists above
      if (requester.role?.role !== UserRole.SUPER_ADMIN) {
        if (!requester.bankId) {
          throw new ForbiddenException(
            'Access Denied: Your account is not linked to an institution.',
          );
        }
        query.andWhere('user.bankId = :myBankId', {
          myBankId: requester.bankId,
        });
      }

      // 🛡️ 5. UUID VALIDATION
      if (branchId && !uuidRegex.test(branchId)) {
        throw new BadRequestException(
          `Invalid Format: '${branchId}' is not a valid Branch UUID.`,
        );
      }

      // 🔍 6. FILTERS
      if (role) {
        if (uuidRegex.test(role)) {
          query.andWhere('user.roleId = :role', { role });
        } else {
          query.andWhere('role.role = :roleSlug', {
            roleSlug: role.toUpperCase(),
          });
        }
      }

      if (branchId) query.andWhere('user.branchId = :branchId', { branchId });
      if (staffId)
        query.andWhere('user.staffId ILIKE :staffId', {
          staffId: `%${staffId}%`,
        });

      if (isActive !== undefined) {
        query.andWhere('user.isActive = :isActive', {
          isActive: isActive === 'true' || isActive === true,
        });
      }

      if (search) {
        query.andWhere(
          '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      // 7. EXECUTION
      const [users, total] = await query
        .orderBy('user.createdAt', 'DESC')
        .getManyAndCount();

      return {
        success: true,
        message: `Successfully retrieved ${total} user(s).`,
        meta: {
          total,
          filterContext:
            requester.role?.role !== UserRole.SUPER_ADMIN
              ? 'BANK_LEVEL'
              : 'PLATFORM_LEVEL',
        },
        data: users,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if ((error as any)?.code === '22P02') {
        throw new BadRequestException(
          'Database Error: One of the provided identifiers is in an invalid format.',
        );
      }

      this.logger.error(
        `[USER_FIND_ALL_ERROR]: ${getErrorMessage(error) || error}`,
      );
      throw new InternalServerErrorException('Failed to retrieve user list.');
    }
  }

  /**
   * FETCH ONE USER (Hybrid Lookup)
   * Supports: UUID (Database) or Staff ID (HDFC/SBI Standard)
   * Security: Includes Bank-Scope protection to prevent cross-tenant data leaks.
   */
  async findOne(identifier: string, requester: UserEntity) {
    try {
      const isUuid =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          identifier,
        );
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

      const query = this.userRepo
        .createQueryBuilder('user')
        // 1. Core User Selection
        .select([
          'user.id',
          'user.firstName',
          'user.middleName',
          'user.lastName',
          'user.email',
          'user.username',
          'user.staffId',
          'user.phoneNumber',
          'user.isActive',
          'user.bankId',
          'user.branchId',
          'user.roleType',
          'user.createdBy',
          'user.createdAt',
          'user.updatedBy',
          'user.updatedAt',
        ])
        // 2. Joins (Defined ONLY ONCE)
        .leftJoin('user.role', 'role')
        .addSelect(['role.name'])

        .leftJoin('user.bank', 'bank')
        .addSelect(['bank.name'])

        .leftJoin('user.branch', 'branch')
        .addSelect(['branch.name'])
        .leftJoin('user.creator', 'creator')
        .addSelect(['creator.firstName', 'creator.lastName'])

        // Join 'users' table again as 'updater'
        .leftJoin('user.updater', 'updater')
        .addSelect(['updater.firstName', 'updater.lastName']);

      // 🔍 3. Identifier Identification
      if (isUuid) {
        query.where('user.id = :identifier', { identifier });
      } else if (isEmail) {
        query.where('LOWER(user.email) = LOWER(:identifier)', { identifier });
      } else {
        query.where(
          '(user.username ILIKE :identifier OR user.staffId ILIKE :identifier)',
          { identifier: identifier.trim() },
        );
      }

      const user = await query.getOne();

      if (!user) {
        throw new NotFoundException(
          `User profile '${identifier}' could not be located.`,
        );
      }

      // 🛡️ 4. TENANT ISOLATION GUARD
      if (requester && requester.role?.role !== UserRole.SUPER_ADMIN) {
        // Note: user.bankId must be in the .select() list above for this to work
        if (user.bankId !== requester.bankId) {
          this.logger.warn(
            `[SECURITY_VIOLATION]: ${requester.email} tried accessing cross-bank user: ${identifier}`,
          );
          throw new ForbiddenException(
            'Access Denied: This user profile belongs to another institution.',
          );
        }
      }

      return {
        success: true,
        message: 'User profile retrieved successfully.',
        data: user,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[USER_FETCH_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Error retrieving user details.');
    }
  }
  
  /**
   * 🔍 FIND ONE: Fetch specific user profile with strict tenant isolation
   */
  async findBankUser(bankId: string, userId: string, currentUser: UserEntity) {
    try {
      // 🛡️ 1. IAM SECURITY: Cross-Tenant Validation
      // Super Admins bypass this, but Bank Admins must match the target bankId
      if (currentUser.roleType !== UserRole.SUPER_ADMIN && currentUser.bankId !== bankId) {
        this.logger.warn(`[SECURITY_ALERT] User ${currentUser.email} attempted cross-tenant lookup for Bank ID: ${bankId}`);
        throw new ForbiddenException('Access Denied: You do not have permission to view users for this institution.');
      }

      // 🚀 2. DATABASE FETCH: DB-Level Isolation
      // By forcing `bankId` into the where clause, we mathematically guarantee 
      // PostgreSQL will never return a user from another bank, even if the userId is valid.
      const user = await this.userRepo.findOne({
        where: {
          id: userId,
          bankId: bankId, // 👈 Strict Tenant Lock
        },
        relations: ['role'], // Vital for the UI Role Badges
        select: {
          // 🛡️ Explicitly define selection to ensure password hashes are NEVER sent to the UI
          id: true,
          bankId: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          username: true,
          staffId: true,
          phoneNumber: true,
          isActive: true,
          roleType: true,
          createdAt: true,
          updatedAt: true,
          role: {
            id: true,
            name: true,
            role: true,
            isSystemRole: true,
          },
        },
      });

      // 3. EXISTENCE CHECK
      if (!user) {
        throw new NotFoundException(`Administrator profile not found within this institution.`);
      }

      this.logger.log(`[USER_VIEW] ${currentUser.email} accessed profile for ${user.id}`);

      // 4. RETURN STANDARDIZED RESPONSE
      return {
        success: true,
        data: user,
      };

    } catch (error) {
      // Re-throw known NestJS HTTP exceptions (403 Forbidden, 404 NotFound)
      if (error instanceof HttpException) {
        throw error;
      }

      // Catch and obscure database/syntax crashes
      this.logger.error(`[USER_VIEW_ERROR]: ${error instanceof Error ? error.message : 'Unknown Error'}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('An unexpected error occurred while retrieving the user profile.');
    }
  }

  async findBankUsers(
    bankId: string,
    filters: { limit: number; offset: number; search?: string },
  ) {
    const { limit, offset, search } = filters;

    this.logger.log(`[FETCH_BANK_USERS] Filters: ${JSON.stringify(filters)}`);

    try {
      // 1. Build the query
      const query = this.userRepo
        .createQueryBuilder('user')
        // 🚀 FIX 1: Trim the Role Object
        // Use leftJoin (not AndSelect) and manually specify the fields we want to pull
        .leftJoin('user.role', 'role')
        .select([
          'user.id', 'user.firstName', 'user.middleName', 'user.lastName', 'user.email',
          'user.username', 'user.staffId', 'user.phoneNumber',
          'user.bankId', 'user.branchId', 'user.isActive',
          'user.createdAt', 'user.updatedAt',
          'user.createdBy', 'user.updatedBy', 'user.roleId', 'user.roleType',
          'role.id', 'role.name', 'role.role' // Only these 3 fields! No permissions JSON.
        ])
        .where('user.bankId = :bankId', { bankId });

      // 🔍 Hacker-Free Search
      if (search) {
        query.andWhere(
          '(user.firstName ILIKE :s OR user.lastName ILIKE :s OR user.email ILIKE :s OR user.staffId ILIKE :s)',
          { s: `%${search}%` },
        );
      }

      // 📊 Pagination & Sorting
      query.orderBy('user.createdAt', 'DESC').take(limit).skip(offset);

      // Fetch the raw data
      const [rawUsers, total] = await query.getManyAndCount();

      // 🚀 FIX 2: Resolve Creator/Updater UUIDs into Human-Readable Names
      // Step A: Extract all unique UUIDs safely
      const adminIdsToFetch = [
        ...new Set([
          ...rawUsers.map((u) => u.createdBy),
          ...rawUsers.map((u) => u.updatedBy),
        ]),
      ].filter(Boolean); // Filters out nulls/undefined

      let adminDictionary = new Map<string, string>();

      // Step B: Fetch names in one efficient batch query
      if (adminIdsToFetch.length > 0) {
        const admins = await this.userRepo.find({
          where: { id: In(adminIdsToFetch) },
          select: ['id', 'firstName', 'middleName', 'lastName'],
        });

        // Step C: Build a fast lookup dictionary
        admins.forEach((admin) => {
          adminDictionary.set(admin.id, `${admin.firstName} ${admin.middleName} ${admin.lastName}`);
        });
      }

      // 🚀 FIX 3: Map the final data payload
      const formattedData = rawUsers.map((user) => {
        return {
          ...user,
          // Swap the UUID for the Name string (or fallback to 'System'/'Unknown' if missing)
          createdBy: adminDictionary.get(user.createdBy) || 'System',
          updatedBy: adminDictionary.get(user.updatedBy) || 'System',
        };
      });

      return {
        success: true,
        data: formattedData,
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + rawUsers.length < total,
        },
      };
    } catch (error) {
      this.logger.error(`[FETCH_BANK_USERS_ERROR]: ${getErrorMessage(error) || error}`);
      throw new InternalServerErrorException('Failed to retrieve bank administrators.');
    }
  }
  /**
   * UPDATE USER PROFILE
   * Path: PATCH /users/:id
   * logic: Updates metadata like firstName, lastName, or phoneNumber.
   * Security: Blocks modification of Email, BankId, and Username to preserve audit integrity.
   */

  async update(id: string, dto: any, requester: UserEntity) {

    // 1. Fetch & Verify (Triggers Tenant Isolation Guard automatically)
    const result = await this.findOne(id, requester);
    const user = result.data;

    // 2. Strip fields that must never be set via this endpoint
    const restrictedFields = ['password', 'staffId', 'bankId'];
    restrictedFields.forEach((field) => delete dto[field]);

    // 3. IMMUTABILITY GUARD — username is the permanent identifier; email IS now changeable
    const illegalChanges = ['username'].filter(
      (field) => dto[field] && dto[field] !== (user as any)[field],
    );

    if (illegalChanges.length > 0) {
      throw new BadRequestException(`Security Violation: Immutable fields: ${illegalChanges.join(', ')}`);
    }

    // 4. ROLE RESOLUTION — support both roleId (UUID for custom roles) and roleType (slug)
    if (dto.roleId && dto.roleId !== user.roleId) {
      // Direct UUID assignment — find by id
      const targetRole = await this.roleRepo.findOne({
        where: [
          { id: dto.roleId, bankId: user.bankId === null ? IsNull() : user.bankId },
          { id: dto.roleId, bankId: IsNull() },
        ],
      });

      if (!targetRole) {
        throw new BadRequestException(`The role with ID '${dto.roleId}' is invalid or not available for this institution.`);
      }
      if (targetRole.role === UserRole.SUPER_ADMIN && requester.roleType !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Security Policy: You do not have clearance to assign Platform Owner roles.');
      }

      user.roleId   = targetRole.id;
      user.roleType = targetRole.role;
      user.role     = targetRole;
      delete dto.roleId;
      delete dto.roleType;

    } else if (dto.roleType && dto.roleType !== user.roleType) {
      const sanitizedSlug = dto.roleType.toUpperCase().trim();

      // Look up the role (Global or Tenant-Specific)
      const targetRole = await this.roleRepo.findOne({
        where: [
          { role: sanitizedSlug , bankId: user.bankId === null ? IsNull() : user.bankId },
          { role: sanitizedSlug, bankId: IsNull() }
        ]
      });

      if (!targetRole) {
        throw new BadRequestException(`The role '${sanitizedSlug}' is invalid or not available for this institution.`);
      }

      // Prevent Bank Admins from turning themselves or others into Super Admins
      if (targetRole.role === UserRole.SUPER_ADMIN && requester.roleType !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Security Policy: You do not have clearance to assign Platform Owner roles.');
      }

      // ✅ Safely apply the Foreign Key and String Identifier
      user.roleId = targetRole.id;
      user.roleType = targetRole.role;
      user.role = targetRole; // Attach object so the response mapper below grabs the new name!
      
      delete dto.roleType; // Remove from DTO so the blind .merge() below doesn't mess with it
    }

    // 5. 🚀 SAFE JSON PREFERENCES MERGE
    if (dto.preferences) {
      dto.preferences = {
        ...(user.preferences || {}),
        ...dto.preferences,
      };
    } else {
      delete dto.preferences; // Don't let null/undefined overwrite existing
    }

    // 6. Update Audit Metadata
    user.updatedBy = requester.id;
    user.updatedAt = new Date();

    // 7. Merge & Save
    const updatedUser = this.userRepo.merge(user, dto);

    try {
      const saved = await this.userRepo.save(updatedUser);

      this.logger.log(`[USER_UPDATE]: Profile ${saved.email} updated by ${requester.email}`);

      // 8. 🎯 EFFICIENT RESPONSE MAPPING
      const publicProfile = {
        id: saved.id,
        firstName: saved.firstName,
        middleName: saved.middleName,
        lastName: saved.lastName,
        email: saved.email,
        username: saved.username,
        phoneNumber: saved.phoneNumber,
        staffId: saved.staffId,
        isActive: saved.isActive,
        role: saved.role?.name || saved.roleType, // Dynamically maps the new role name!
        // bankId: saved.bankId,
        // branchId: saved.branchId,
        preferences: saved.preferences,
        updatedAt: saved.updatedAt,
      };

      return {
        success: true,
        message: 'User profile updated successfully.',
        data: publicProfile,
      };
    } catch (error) {
      // NOTE: use your getErrorMessage utility if you have it imported!
      this.logger.error(`[UPDATE_ERROR]: ${getErrorMessage(error) || error}`); 
      throw new InternalServerErrorException('Failed to update user profile.');
    }
  }

  // ==========================================================================
  // 🚨 DELETE USER
  // ==========================================================================
  async remove(id: string, requester: UserEntity) {
    // 1. Fetch the user to ensure they exist
    const targetUser = await this.userRepo.findOne({
      where: { id },
      relations: ['role'], // Pull the role so we can check permissions
    });

    if (!targetUser) {
      throw new NotFoundException('User not found in the system.');
    }

    // 2. 🛡️ Tenant Isolation Security Check
    // If the requester is not a Super Admin, they can ONLY delete users in their own bank
    if (requester.roleType !== UserRole.SUPER_ADMIN && targetUser.bankId !== requester.bankId) {
      throw new ForbiddenException('Security Policy: You can only delete users within your own institution.');
    }

    // 3. 🛡️ Prevent Self-Deletion
    if (targetUser.id === requester.id) {
      throw new BadRequestException('You cannot delete your own active session. Ask another administrator to remove your account.');
    }

    // 4. 🛡️ Privilege Guard
    // Prevent Bank Admins from deleting Super Admins
    if (targetUser.roleType === UserRole.SUPER_ADMIN && requester.roleType !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Security Policy: You do not have clearance to delete Platform Owners.');
    }

    // 5. Execute Deletion
    try {
      // NOTE: For financial apps, you might prefer this.userRepo.softRemove(targetUser) 
      // if you have @DeleteDateColumn() configured on your entity for audit trails!
      await this.userRepo.remove(targetUser); 

      this.logger.log(`[USER_DELETED]: User ${targetUser.email} was deleted by ${requester.email}`);

      return {
        success: true,
        message: 'User successfully deleted.',
      };
    } catch (error) {
      this.logger.error(`[DELETE_USER_ERROR]: ${getErrorMessage(error) || error}`);
      throw new InternalServerErrorException('Failed to delete user due to a system error.');
    }
  }

  async updatePassword(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
    ip: string,
    ua: string,
  ) {
    const { currentPassword, newPassword } = updatePasswordDto;

    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'password'],
    });

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      // 🛡️ SECURITY: Log the FAILED attempt too!
      await this.auditService.createLog(
        id,
        'Password Change Failed: Incorrect Current Password',
        ip,
        ua,
      );
      throw new BadRequestException('Incorrect current password.');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await this.userRepo.save(user);

    // ✅ SUCCESS: Capture the audit log
    await this.auditService.createLog(
      id,
      'Password Updated Successfully',
      ip,
      ua,
    );

    return { message: 'Password updated successfully.' };
  }


  /**
   * AUTH LOOKUP: Used by JwtStrategy
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      // 1. INPUT VALIDATION: Prevent .toLowerCase() on undefined/null
      if (!email || typeof email !== 'string') {
        this.logger.warn(
          `[USER_SEARCH_INVALID]: Attempted to find user with empty or non-string email.`,
        );
        return null;
      }

      // 2. SANITIZATION: Clean the input
      const sanitizedEmail = email.toLowerCase().trim();

      // 3. EXECUTION: DB Query
      const user = await this.userRepo.findOne({
        where: { email: sanitizedEmail },
        select: ['id', 'email', 'password', 'roleId', 'bankId', 'isActive'],
        relations: ['role'],
      });

      if (!user) {
        this.logger.verbose(
          `[USER_NOT_FOUND]: No account exists for ${sanitizedEmail}`,
        );
        return null;
      }

      return user;
    } catch (error) {
      // 4. ERROR WRAPPING: Log the specific database error
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[USER_FETCH_ERROR]: Failed to retrieve user by email. Details: ${getErrorMessage(error)}`,
        errorStack,
      );

      // In production, we throw a generic error to the controller to avoid leaking DB details
      throw new InternalServerErrorException(
        'An error occurred while processing your login. Please try again later.',
      );
    }
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    try {
      if (!username || typeof username !== 'string') {
        this.logger.warn(`[USER_SEARCH_INVALID]: Empty or invalid username.`);
        return null;
      }

      // If your usernames are case-insensitive (like SBI), keep toLowerCase()
      const sanitizedUsername = username.toUpperCase().trim();

      const user = await this.userRepo.findOne({
        where: { username: sanitizedUsername }, // 👈 Query the username column
        select: [
          'id',
          'username',
          'email',
          'password',
          'roleId',
          'bankId',
          'isActive',
          'firstName',
          'lastName',
        ],
        relations: ['role'],
      });

      return user;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? getErrorMessage(error) : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[USER_FETCH_ERROR]: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('An error occurred during login.');
    }
  }

  /**
   * TOGGLE USER STATUS (Activate/Deactivate)
   * Path: PATCH /users/:id/status
   * Use Case: Immediate suspension of staff access for security or resignation.
   */
  async toggleStatus(id: string, isActive: boolean, requester: UserEntity) {
    // 1. Fetch the user and verify the requester has tenant authority
    const result = await this.findOne(id, requester);
    const user = result.data;

    // 2. 🛡️ SELF-DEACTIVATION GUARD
    // Prevents an Admin from accidentally disabling their own access.
    if (user.id === requester.id && !isActive) {
      throw new BadRequestException(
        'Security Policy: You cannot deactivate your own account. Please contact another administrator.',
      );
    }

    // 3. 🛡️ SUPER ADMIN PROTECTION
    // Prevent Bank Admins from deactivating a Super Admin.
    if (
      user.roleType === UserRole.SUPER_ADMIN &&
      requester.role?.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Access Denied: You do not have authority to suspend a Platform Owner.',
      );
    }

    // 4. Update status and audit trail
    user.isActive = isActive;
    user.updatedBy = requester.id;

    try {
      const saved = await this.userRepo.save(user);

      this.logger.warn(
        `[STATUS_CHANGE]: User ${user.staffId} (${user.email}) set to ${isActive ? 'ACTIVE' : 'INACTIVE'} by ${requester.email}`,
      );

      return {
        success: true,
        message: `User account has been ${isActive ? 'activated' : 'suspended'} successfully.`,
        data: {
          id: saved.id,
          staffId: saved.staffId,
          isActive: saved.isActive,
        },
      };
    } catch (error) {
      this.logger.error(`[STATUS_TOGGLE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to update user status.');
    }
  }
  // ==========================================================================
  // PRIVATE UTILITIES: Banking ID Generation
  // ==========================================================================

  /**
   * GENERATE STAFF ID: HDFC/SBI Standard
   * Returns a 10-digit numeric string.
   */
  private generateStaffId(): string {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  }

  /**
   * GENERATE UNIQUE USERNAME
   * Format: PREFIX_RANDOM (e.g., HDFC_48291)
   */
  private async generateUniqueUsername(prefix: string): Promise<string> {
    // 🛡️ Guard: Ensure prefix is exactly 2 characters
    const safePrefix = (prefix || 'BU').substring(0, 2).toUpperCase();

    // 🎯 Generate exactly 8 digits
    // We use padStart to ensure leading zeros don't make the string shorter than 8
    const randomPart = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, '0');

    const username = `${safePrefix}${randomPart}`;

    // 🔍 Safety: Collision Check
    const exists = await this.userRepo.findOne({ where: { username } });

    if (exists) {
      this.logger.warn(`ID Collision: ${username}. Regenerating...`);
      return this.generateUniqueUsername(safePrefix);
    }

    return username;
  }

  // Omni-Login: matches email, username (2 letters + 8 digits), or staffId (10 digits)
  async findByIdentifier(identifier: string) {
    try {
      return await this.userRepo
        .createQueryBuilder('user')
        .addSelect('user.password')
        .leftJoinAndSelect('user.role', 'role')
        .where(
          'user.email = :id OR user.username = :id OR user.staffId = :id',
          { id: identifier.trim() },
        )
        .getOne();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(
        `[FIND_USER_ERROR]: Failed to query user by identifier '${identifier}'. Details: ${errorMessage}`,
      );
      throw new InternalServerErrorException(
        'A database error occurred while verifying user credentials.',
      );
    }
  }
  // src/modules/users/users.service.ts

/**
 * 👥 FETCH LOCAL BRANCH STAFF
 * Scoped strictly to the provided Tenant (bankId) AND Branch (branchId)
 */
async findBranchUsers(bankId: string, branchId: string, query: { limit: number; offset: number; search?: string }) {
  try {
    let whereClause: any = { 
      bankId: bankId,
      branchId: branchId // 🚀 The critical branch isolation filter
    };

    // Apply text search if provided
    if (query.search) {
      const searchTerm = `%${query.search.trim()}%`;
      whereClause = [
        { bankId, branchId, firstName: ILike(searchTerm) },
        { bankId, branchId, lastName: ILike(searchTerm) },
        { bankId, branchId, email: ILike(searchTerm) },
        { bankId, branchId, phoneNumber: ILike(searchTerm) }
      ];
    }

    const [users, total] = await this.userRepo.findAndCount({
      where: whereClause,
      take: query.limit,
      skip: query.offset,
      order: { createdAt: 'DESC' }, // Newest staff first
      relations: ['role'] // Fetch the role entity to get the name
    });

    // Strip passwords before sending to frontend
    const sanitizedUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    return {
      success: true,
      total,
      data: sanitizedUsers,
    };

  } catch (error) {
    this.logger.error(`[FETCH_BRANCH_STAFF_ERROR]: ${getErrorMessage(error) || error}`);
    throw new InternalServerErrorException('Failed to retrieve branch personnel.');
  }
}
}
