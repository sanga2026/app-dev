// src/modules/banks/banks.controller.ts

import { 
  Controller, Post, Body, Get, Param, Patch, Query,
  Logger, HttpCode, HttpStatus, UseGuards, SetMetadata, 
  ForbiddenException, BadRequestException,
  ParseUUIDPipe, ParseBoolPipe, DefaultValuePipe, ParseIntPipe,
  UseInterceptors, ClassSerializerInterceptor,
  Inject, forwardRef,
  Delete
} from '@nestjs/common';
import { BankService } from './banks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';

// 🚀 IMPORTING OUR SECURE DTOs
import { CreateBankDto } from './dto/create-bank.dto';
import { OnboardBankDto } from './dto/onboard-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@ApiTags('Tenant Banks')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // 🛡️ Triple-Lock Security Layer
@UseInterceptors(ClassSerializerInterceptor)           // 🛡️ Strips @Exclude() fields
@Controller('banks')
export class BanksController {
  private readonly logger = new Logger(BanksController.name);

  constructor(
    private readonly bankService: BankService,
    @Inject(forwardRef(() => UsersService)) // 👈 Prevents Circular Dependency
    private readonly usersService: UsersService,
  ) {}

  /**
   * 🚀 ONBOARD BANK (Tenant + SaaS Plan)
   */
  @Post('onboard')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Onboard a new institutional tenant' })
  async onboardBank(@Body() dto: OnboardBankDto, @CurrentUser() user: UserEntity) {
    this.logger.log(`[REGULATORY]: Super Admin ${user.email} onboarding new Bank: ${dto.name}`);
    return await this.bankService.onboardTenant(dto, user);
  }

  /**
   * 🏢 CREATE RAW BANK (Tenant Only)
   */
  @Post()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create raw bank record without automated provisioning' })
  async createBank(@Body() dto: CreateBankDto, @CurrentUser() user: UserEntity) {
    this.logger.log(`[REGULATORY]: Super Admin ${user.email} creating raw Bank: ${dto.name}`);
    return await this.bankService.create(dto, user);
  }

  /**
   * 📊 LIST ALL BANKS (With Pagination)
   */
  @Get()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @ApiOperation({ summary: 'List all tenant banks (Platform Owners only)' })
  async findAll(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @CurrentUser() user: UserEntity
  ) {
    this.logger.verbose(`[AUDIT]: Global bank list requested by ${user.email}`);
    return await this.bankService.findAll(limit, offset);
  }

  /**
   * 🔍 FETCH BANK DETAILS
   */
  @Get(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @ApiOperation({ summary: 'Fetch specific bank profile' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string, // 🛡️ Block SQL Injection
    @CurrentUser() user: UserEntity
  ) {
    // 🛡️ SECURITY: Strict Tenant Isolation
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? id : user.bankId;

    if (!targetBankId) {
      throw new ForbiddenException('Access Denied: No institutional link found for your account.');
    }

    return await this.bankService.findOne(targetBankId, user);
  }

  /**
   * 📝 UPDATE BANK PROFILE
   */
  @Patch(':id/update')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @ApiOperation({ summary: 'Update bank profile metadata' })
  async updateBank(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankDto,             
    @CurrentUser() user: UserEntity
  ) {
    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;
    // 🛡️ SECURITY: Enforce tenant boundary
    const targetBankId = isSuperAdmin ? id : user.bankId;

    if (!targetBankId) {
      throw new BadRequestException('Bank identification failed. Please provide a valid Bank ID.');
    }

    // 🛡️ IMMUTABILITY CHECK
    if (!isSuperAdmin) {
      const restricted: (keyof UpdateBankDto)[] = ['ifscPrefix', 'taxIdentifier']; // Added typesafety
      restricted.forEach((field) => {
        delete dto[field];
      });
    }

    this.logger.log(`[UPDATE]: Bank ${targetBankId} modification attempt by ${user.email}`);
    return await this.bankService.update(targetBankId, dto, user); 
  }

  /**
   * 🛑 TOGGLE BANK STATUS
   */
  @Patch(':id/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @ApiOperation({ summary: 'Suspend or activate a tenant bank' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean, 
    @CurrentUser() user: UserEntity
  ) {
    this.logger.warn(`[REGULATORY_ACTION]: Bank ${id} status toggled to ${isActive} by ${user.email}`);
    return await this.bankService.updateStatus(id, isActive, user); 
  }

// 🚀 Add this inside your BanksController (or UsersController)
  @Post(':bankId/users/onboard')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async onboardTenantAdmin(
    @Param('bankId', ParseUUIDPipe) bankId: string, // 🛡️ Validates it's a real UUID
    @Body() dto: CreateUserDto, 
    @CurrentUser() requester: UserEntity
  ) {
    
    // 🛡️ SECURITY OVERRIDE (Anti-Spoofing)
    // A malicious user might send a POST to Bank A's URL, but put Bank B's ID in the JSON body.
    // We forcefully overwrite the DTO's bankId with the one from the URL to prevent cross-tenant injection.
    dto.bankId = bankId;

    // Call your existing users service logic
    return await this.usersService.createUser(dto, requester);
  }

// ==========================================================================
  // 🚨 TOGGLE TENANT USER STATUS
  // PATCH /api/v1/banks/:bankId/users/:userId/status
  // ==========================================================================
  @Patch(':bankId/users/:userId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async toggleUserStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string, 
    @Param('userId', ParseUUIDPipe) userId: string, 
    @Body('isActive') isActive: boolean,            
    @CurrentUser() requester: UserEntity
  ) {
    
    // 1. 🛡️ URL SPOOFING & TENANT GUARD
    // Extract the role from either the flat JWT or hydrated DB object
    const roleSlug = requester.roleType || requester.role?.role;

    // Prevent a Bank Admin from manipulating the URL bankId to snoop on other banks.
    // Super Admins bypass this because they can operate on any bankId.
    if (roleSlug !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      this.logger.warn(`[SECURITY] ${requester.email} attempted to route through a restricted Bank ID: ${bankId}`);
      throw new ForbiddenException(
        'Security Policy: You are not authorized to route requests through this banking institution.'
      );
    }

    // 2. 🚀 Call your existing service method exactly as it is defined
    // We don't need to pass bankId to the service, because this.findOne() inside 
    // the service already enforces the final tenant database check!
    return await this.usersService.toggleStatus(userId, isActive, requester);
  }

// ==========================================================================
  // 🚨 UPDATE TENANT USER PROFILE
  // PATCH /api/v1/banks/:bankId/users/:userId/update
  // ==========================================================================
  @Patch(':bankId/users/:userId/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async updateUserProfile(
    @Param('bankId', ParseUUIDPipe) bankId: string, 
    @Param('userId', ParseUUIDPipe) userId: string, 
    @Body() dto: UpdateProfileDto, // Or UpdateProfileDto depending on your setup
    @CurrentUser() requester: UserEntity
  ) {
    
    // 1. 🛡️ URL SPOOFING & TENANT GUARD
    const roleSlug = requester.roleType || requester.role?.role;

    if (roleSlug !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      this.logger.warn(`[SECURITY] ${requester.email} attempted to route update through Bank ID: ${bankId}`);
      throw new ForbiddenException(
        'Security Policy: You are not authorized to update profiles in this banking institution.'
      );
    }

    // 2. Execute Update (The service will handle the rest!)
    // Note: Make sure your usersService.update method is prepared to accept these parameters.
    return await this.usersService.update(userId, dto, requester);
  }

  // ==========================================================================
  // 🚨 DELETE TENANT USER 
  // DELETE /api/v1/banks/:bankId/users/:userId/delete
  // ==========================================================================
  @Delete(':bankId/users/:userId/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async removeTenantAdmin(
    @Param('bankId', ParseUUIDPipe) bankId: string, 
    @Param('userId', ParseUUIDPipe) userId: string, 
    @CurrentUser() requester: UserEntity
  ) {
    
    // 1. 🛡️ URL SPOOFING & TENANT GUARD
    const roleSlug = requester.roleType || requester.role?.role;

    if (roleSlug !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      this.logger.warn(`[SECURITY] ${requester.email} attempted to route delete through Bank ID: ${bankId}`);
      throw new ForbiddenException(
        'Security Policy: You are not authorized to delete profiles in this banking institution.'
      );
    }

    // 2. Execute Deletion
    // Your existing UsersService.remove() method already fetches the user and double-checks 
    // the tenant logic (like preventing self-deletion), so we just pass the ID and requester!
    return await this.usersService.remove(userId, requester);
  }
  /**
   * 👥 FETCH BANK ADMINS
   */
  @Get(':bankId/admins')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @ApiOperation({ summary: 'Fetch administrators for a specific bank' })
  async getBankAdmins(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @CurrentUser() user: UserEntity, // 🚀 INJECTED USER FOR SECURITY
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, // 🚀 FIXED TYPE SAFETY
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number, // 🚀 FIXED TYPE SAFETY
    @Query('search') search?: string,
  ) {
    
    // 🛡️ CRITICAL SECURITY CHECK (BOLA/IDOR PREVENTION)
    // Ensure a Bank Admin cannot fetch admins of a different bank by manipulating the URL
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? bankId : user.bankId;

    if (!targetBankId) {
      throw new ForbiddenException('Access Denied: Your account is not linked to a valid institution.');
    }

    return await this.usersService.findBankUsers(targetBankId, {
      limit,
      offset,
      search,
    });
  }

  /**
   * 🔍 GET SINGLE USER DETAILS
   * GET /banks/:bankId/users/:userId
   */
  @Get('/:bankId/users/:userId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @ApiOperation({ summary: 'Fetch specific user profile' })
  async fetchAdminDetails(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: UserEntity,
  ) {
    // 1. You should have a method in your UserService to find a user by ID
    // 2. Ensure your service verifies that the user actually belongs to the bankId provided!
    return await this.usersService.findBankUser(bankId, userId, currentUser);
  }
}