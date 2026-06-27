import { 
  Controller, Post, Body, Param, Get, Patch, 
  Query, Logger, HttpStatus, HttpCode, 
  UseGuards, SetMetadata, 
  BadRequestException,
  ForbiddenException,
  ParseBoolPipe,
  ParseUUIDPipe
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
// 🚀 THE FIX: Mount the controller to match the exact physical hierarchy
@Controller('banks/:bankId/branches/:branchId/customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customerService: CustomersService) {}

  /**
   * 🛡️ INTERNAL SECURITY HELPER
   * Verifies the user is allowed to perform operations on this specific URL path.
   */
  private validateTenantAccess(user: UserEntity, pathBankId: string, pathBranchId: string) {
    const role = user.role?.role || user.roleType;
    if (role === UserRole.SUPER_ADMIN) return; // Super Admins can access any path

    // 1. Bank Isolation Check
    if (user.bankId !== pathBankId) {
      this.logger.error(`[SECURITY] ${user.email} attempted cross-tenant routing.`);
      throw new ForbiddenException('Security Policy: You are not authorized for this banking institution.');
    }

    // 2. Branch Isolation Check (Only for localized staff)
    if (role === UserRole.STAFF || role === UserRole.BRANCH_MANAGER) {
      if (user.branchId !== pathBranchId) {
        this.logger.error(`[SECURITY] ${user.email} attempted cross-branch routing.`);
        throw new ForbiddenException('Operational Error: You can only access records for your assigned branch.');
      }
    }
  }

  /**
   * 🚀 ONBOARD CUSTOMER
   * POST /banks/:bankId/branches/:branchId/customers
   */
  @Post()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.BRANCH_MANAGER, UserRole.STAFF])
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateCustomerDto, 
    @CurrentUser() user: UserEntity
  ) {
    // 🛡️ 1. Verify URL Access
    this.validateTenantAccess(user, bankId, branchId);

    // 🛡️ 2. Force payload injection from secure URL parameters
    dto.bankId = bankId;
    dto.branchId = branchId;

    // 🛡️ 3. Regulatory Validations
    const requiredKyc = ['governmentId', 'governmentIdType', 'firstName', 'lastName', 'phoneNumber'];
    const missing = requiredKyc.filter(field => !dto[field]);
    
    if (missing.length > 0) {
      throw new BadRequestException(`KYC Violation: Missing mandatory fields: ${missing.join(', ')}`);
    }

    this.logger.log(`[CUSTOMER_ONBOARD] Request by ${user.email} for Branch: ${branchId}`);
    return await this.customerService.create(dto, user);
  }

  /**
   * 📊 LIST CUSTOMERS
   * GET /banks/:bankId/branches/:branchId/customers
   */
  @Get()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.BRANCH_MANAGER, UserRole.STAFF])
  async findAll(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
    @Query('search') search?: string,
  ) {
    // 🛡️ Verify URL Access
    this.validateTenantAccess(user, bankId, branchId);

    // We pass the branchId directly from the URL, replacing the old @Query parameter
    return await this.customerService.findAll(user, branchId, isActive, search);
  }

  /**
   * 🔍 GET CUSTOMER DETAILS
   * GET /banks/:bankId/branches/:branchId/customers/:identifier
   */
  @Get(':identifier')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.BRANCH_MANAGER, UserRole.STAFF])
  async findOne(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('identifier') identifier: string, 
    @CurrentUser() user: UserEntity
  ) {
    // 🛡️ Verify URL Access
    this.validateTenantAccess(user, bankId, branchId);

    this.logger.verbose(`[CUSTOMER_LOOKUP] Query: ${identifier} by ${user.email}`);
    // Your service will need to ensure the fetched customer actually belongs to this branchId!
    return await this.customerService.findOne(identifier, user); 
  }

  /**
   * 📝 UPDATE CUSTOMER PROFILE
   * PATCH /banks/:bankId/branches/:branchId/customers/:id
   */
  @Patch(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.STAFF])
  async update(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() dto: UpdateCustomerDto, 
    @CurrentUser() user: UserEntity
  ) {
    // 🛡️ Verify URL Access
    this.validateTenantAccess(user, bankId, branchId);
    
    // 🛡️ Security Guard: Block identity swapping and status bypasses
    const securityFlags = [
      'isActive', 
      'isBlacklisted', 
      'isLocked', 
      'kycStatus', 
      'customerNumber',
      'governmentId', 
      'governmentIdType'
    ];
    
    const attemptedViolations = securityFlags.filter(flag => dto[flag] !== undefined);
    
    if (attemptedViolations.length > 0) {
       throw new ForbiddenException(
         `Security Violation: [${attemptedViolations.join(', ')}] cannot be altered via a standard profile update.`
       );
    }

    return await this.customerService.update(id, dto, user);
  }

  /**
   * 🛑 UPDATE STATUS & FRAUD FLAGS
   * PATCH /banks/:bankId/branches/:branchId/customers/:id/status
   */
  @Patch(':id/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async updateStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusDto: UpdateCustomerStatusDto,
    @CurrentUser() user: UserEntity
  ) {
    // 🛡️ Verify URL Access
    this.validateTenantAccess(user, bankId, branchId);

    if (Object.keys(statusDto).length === 0) {
      throw new BadRequestException('Request Error: Provide at least one status flag.');
    }

    this.logger.warn(`[SECURITY_ALERT] Status change for Customer ${id} initiated by ${user.email}`);
    return await this.customerService.updateStatus(id, statusDto, user);
  }
}