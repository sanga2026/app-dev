import {
  Controller, Post, Body, Param, Get, Patch,
  Query, Logger, HttpStatus, HttpCode,
  UseGuards, BadRequestException, ForbiddenException,
  ParseBoolPipe, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';

@ApiTags('Customer Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banks/:bankId/branches/:branchId/customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customerService: CustomersService) {}

  private validateTenantAccess(user: UserEntity, pathBankId: string, pathBranchId: string) {
    const role = user.role?.role || user.roleType;
    if (role === UserRole.SUPER_ADMIN) return;
    if (user.bankId !== pathBankId) {
      throw new ForbiddenException('Security Policy: Cross-bank access denied.');
    }
    if (role === UserRole.STAFF || role === UserRole.BRANCH_MANAGER) {
      if (user.branchId !== pathBranchId) {
        throw new ForbiddenException('You can only access records for your assigned branch.');
      }
    }
  }

  @Post()
  @RequirePermissions('customers', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: UserEntity,
  ) {
    this.validateTenantAccess(user, bankId, branchId);
    dto.bankId = bankId;
    dto.branchId = branchId;
    const requiredKyc = ['governmentId', 'governmentIdType', 'firstName', 'lastName', 'phoneNumber'];
    const missing = requiredKyc.filter(field => !dto[field as keyof CreateCustomerDto]);
    if (missing.length > 0) {
      throw new BadRequestException(`KYC Violation: Missing mandatory fields: ${missing.join(', ')}`);
    }
    return await this.customerService.create(dto, user);
  }

  @Get()
  @RequirePermissions('customers', 'read')
  async findAll(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
    @Query('search') search?: string,
  ) {
    this.validateTenantAccess(user, bankId, branchId);
    return await this.customerService.findAll(user, branchId, isActive, search);
  }

  @Get(':identifier')
  @RequirePermissions('customers', 'read')
  async findOne(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('identifier') identifier: string,
    @CurrentUser() user: UserEntity,
  ) {
    this.validateTenantAccess(user, bankId, branchId);
    return await this.customerService.findOne(identifier, user);
  }

  @Patch(':id')
  @RequirePermissions('customers', 'update')
  async update(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: UserEntity,
  ) {
    this.validateTenantAccess(user, bankId, branchId);
    const securityFlags = ['isActive', 'isBlacklisted', 'isLocked', 'kycStatus', 'customerNumber', 'governmentId', 'governmentIdType'];
    const violations = securityFlags.filter(f => dto[f as keyof UpdateCustomerDto] !== undefined);
    if (violations.length > 0) {
      throw new ForbiddenException(`Security Violation: [${violations.join(', ')}] cannot be altered via profile update.`);
    }
    return await this.customerService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('customers', 'update')
  async updateStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusDto: UpdateCustomerStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    this.validateTenantAccess(user, bankId, branchId);
    if (Object.keys(statusDto).length === 0) {
      throw new BadRequestException('Provide at least one status flag.');
    }
    return await this.customerService.updateStatus(id, statusDto, user);
  }
}
