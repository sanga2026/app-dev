import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Query,
  ParseBoolPipe,
  Logger,
  HttpStatus,
  HttpCode,
  UseGuards,
  SetMetadata,
  BadRequestException,
  ForbiddenException,
  Put,
  Req,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '../access-control/enums/user-role.enum';
import { ApiOperation } from '@nestjs/swagger/dist/decorators/api-operation.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CreateUserDto } from './dto/create-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  // ==========================================================================
  // SECTION 1: SYSTEM ADMINISTRATION (Platform Level)
  // These routes are strictly for Global Admins (Sangappa/Sagar)
  // ==========================================================================

  /**
   * INITIAL SYSTEM SETUP (Bootstrap)
   * Path: POST /users/super-admin
   * Purpose: To create a Platform Owner. This user has no bankId (Global).
   */
  @Post('super-admin')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  async createSuperAdmin(@Body() dto: CreateUserDto) {

    // Validation: Ensure we aren't passing a bankId for a Super Admin
    if (dto.bankId) {
      throw new BadRequestException(
        'Super Admins cannot be linked to a specific bankId.',
      );
    }

    return await this.usersService.createSuperAdmin(dto);
  }

  // ==========================================================================
  // SECTION 2: TENANT ONBOARDING (Bank & Branch Level)
  // These routes are used by Sagar/Nisarga for institution-level management
  // ==========================================================================

  /**
   * ONBOARD BANK USER (HDFC/SBI Style)
   * Path: POST /users/onboard
   * logic: Platform Owner creates Bank Admins. Bank Admins create Branch Staff.
   */
  @Post('onboard')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto, @CurrentUser() admin: UserEntity) {
    // 🛡️ Use ?. to prevent crashes if admin.role is undefined
    const adminRole = admin?.role?.role;

    if (adminRole === UserRole.BANK_ADMIN) {
      dto.bankId = admin.bankId;
    }

    if (
      adminRole !== UserRole.SUPER_ADMIN &&
      dto.roleType === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Escalation Denied: Insufficient authority.',
      );
    }

    // 🛡️ 1. TENANT ENFORCEMENT: A Bank Admin can ONLY onboard users for their own bank.
    if (admin.role?.role === UserRole.BANK_ADMIN) {
      dto.bankId = admin.bankId; // Force the bankId to match the admin's bank context
    }

    // 🛡️ 2. PRIVILEGE ESCALATION GUARD:
    // Prevent non-SuperAdmins from onboarding other high-level admins.
    if (
      admin.role?.role !== UserRole.SUPER_ADMIN &&
      dto.roleType === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Escalation Denied: Insufficient authority to create a Super Admin.',
      );
    }

    // 🛡️ 3. DATA INTEGRITY: Ensure bankId exists for institutional users
    if (
      !dto.bankId &&
      admin.role?.role === UserRole.SUPER_ADMIN &&
      dto.roleType !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'A bankId is mandatory for institutional users.',
      );
    }

    this.logger.log(
      `[ONBOARDING] ${admin.email} is registering a new ${dto.roleType} for Bank: ${dto.bankId}`,
    );

    return await this.usersService.createUser(dto, admin);
  }

  /**
   * ASSIGN ROLE
   * Path: PATCH /users/:id/assign-role
   * Use Case: Changing a Staff member to a Branch Manager.
   */
  /**
   * ASSIGN ROLE
   * Path: PATCH /users/:id/assign-role
   * * @param id - The UUID or StaffID of the target user.
   * @Body('roleIdentifier') - Can be a UUID (GUID) or a readable Slug ('BRANCH_MANAGER').
   */
  @Patch(':id/assign-role')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @Param('id') userId: string,
    @Body('roleIdentifier') roleIdentifier: string, // 👈 Changed from roleId to Identifier
    @CurrentUser() admin: UserEntity,
  ) {
    // 1. Basic Validation
    if (!roleIdentifier) {
      throw new BadRequestException(
        'roleIdentifier (UUID or Slug) is required in the request body.',
      );
    }

    this.logger.log(
      `[ROLE_ASSIGNMENT_INIT]: ${admin.email} is updating role for User: ${userId} to: ${roleIdentifier}`,
    );

    // 2. Delegate to the Hybrid Service method
    return await this.usersService.assignRoleToUser(
      userId,
      roleIdentifier,
      admin,
    );
  }

  // ==========================================================================
  // SECTION 3: DATA RETRIEVAL (Audit & Management)
  // ==========================================================================

  /**
   * LIST USERS
   * Filters: Role, Branch, and the HDFC-standard Staff ID.
   */
  @Get()
  // 🚀 1. THE FIX: Hire the bouncers! This forces NestJS to validate the token and extract the user.
  @SetMetadata('roles', [
    UserRole.SUPER_ADMIN,
    UserRole.BANK_ADMIN,
    UserRole.BRANCH_MANAGER,
  ])
  async findAll(
    @CurrentUser() requester: UserEntity,

    // 🚀 2. THE ALIGNMENT: Changed 'roleId' to 'role' to perfectly match your Service logic
    @Query('role') role?: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    // Note: If you want to use the isActive and search filters from your service, add them here too!
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    // The requester object will now 100% exist!
    return await this.usersService.findAll(requester, {
      role,
      branchId,
      staffId,
      isActive,
      search,
    });
  }

  /**
   * FETCH USER DETAILS
   * Path: GET /users/:identifier (Accepts UUID or Staff ID)
   */
  @Get(':identifier')
  @SetMetadata('roles', [
    UserRole.SUPER_ADMIN,
    UserRole.BANK_ADMIN,
    UserRole.BRANCH_MANAGER,
  ])
  // 📁 users.controller.ts
  @ApiOperation({ summary: 'Fetch user by UUID, Email, Username, or Staff ID' })
  async findOne(
    @Param('identifier') identifier: string,
    @CurrentUser() requester: UserEntity,
  ) {
    // 🛡️ Pre-validation: Ensure identifier isn't just whitespace
    if (!identifier || identifier.trim().length === 0) {
      throw new BadRequestException(
        'A valid user identifier must be provided.',
      );
    }

    return await this.usersService.findOne(identifier.trim(), requester);
  }

  // ==========================================================================
  // SECTION 4: SECURITY & STATUS (Operational)
  // ==========================================================================

  /**
   * UPDATE USER PROFILE
   */
  @Patch(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto, // 🚀 Changed from 'any' to UpdateProfileDto
    @CurrentUser() requester: UserEntity,
  ) {
    return await this.usersService.update(id, dto, requester);
  }

  @Delete(':id')
    @SetMetadata('roles', [
    UserRole.SUPER_ADMIN,
    UserRole.BANK_ADMIN,
    UserRole.BRANCH_MANAGER,
  ])
  async remove(
    @Param('id', ParseUUIDPipe) id: string, // Forces the ID to be a valid UUID before hitting the service
    @CurrentUser() requester: UserEntity    // Grabs the user making the request from the JWT token
  ) {
    return await this.usersService.remove(id, requester);
  }

  @Put(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Req() req: any, // 🚀 Access the raw request
  ) {
    // Extracting IP (handling proxy headers) and User-Agent
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    return this.usersService.updatePassword(id, updatePasswordDto, ip, ua);
  }
  /**
   * TOGGLE ACCOUNT STATUS
   * Path: PATCH /users/:id/status
   * Security: Used for immediate suspension of compromised or resigned staff.
   */
  @Patch(':id/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() requester: UserEntity,
  ) {
    this.logger.warn(
      `[SECURITY] User ${id} status toggled to ${isActive} by ${requester.email}`,
    );
    return await this.usersService.toggleStatus(id, isActive, requester);
  }
}
