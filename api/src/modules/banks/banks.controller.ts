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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { OnboardBankDto } from './dto/onboard-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

@ApiTags('Tenant Banks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('banks')
export class BanksController {
  private readonly logger = new Logger(BanksController.name);

  constructor(
    private readonly bankService: BankService,
    @Inject(forwardRef(() => UsersService)) // 👈 Prevents Circular Dependency
    private readonly usersService: UsersService,
  ) {}

  @Post('onboard')
  @RequirePermissions('banks', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Onboard a new institutional tenant' })
  async onboardBank(@Body() dto: OnboardBankDto, @CurrentUser() user: UserEntity) {
    this.logger.log(`[REGULATORY]: ${user.email} onboarding new Bank: ${dto.name}`);
    return await this.bankService.onboardTenant(dto, user);
  }

  @Post()
  @RequirePermissions('banks', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create raw bank record without automated provisioning' })
  async createBank(@Body() dto: CreateBankDto, @CurrentUser() user: UserEntity) {
    this.logger.log(`[REGULATORY]: ${user.email} creating raw Bank: ${dto.name}`);
    return await this.bankService.create(dto, user);
  }

  @Get()
  @RequirePermissions('banks', 'read')
  @ApiOperation({ summary: 'List all tenant banks' })
  async findAll(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.bankService.findAll(limit, offset);
  }

  @Get(':id')
  @RequirePermissions('banks', 'read')
  @ApiOperation({ summary: 'Fetch specific bank profile' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? id : user.bankId;
    if (!targetBankId) throw new ForbiddenException('Access Denied: No institutional link found.');
    return await this.bankService.findOne(targetBankId, user);
  }

  @Patch(':id/update')
  @RequirePermissions('banks', 'update')
  @ApiOperation({ summary: 'Update bank profile metadata' })
  async updateBank(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankDto,
    @CurrentUser() user: UserEntity,
  ) {
    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;
    const targetBankId = isSuperAdmin ? id : user.bankId;
    if (!targetBankId) throw new BadRequestException('Bank identification failed.');
    if (!isSuperAdmin) {
      (['ifscPrefix', 'taxIdentifier'] as (keyof UpdateBankDto)[]).forEach(f => delete dto[f]);
    }
    return await this.bankService.update(targetBankId, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('banks', 'update')
  @ApiOperation({ summary: 'Suspend or activate a tenant bank' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.bankService.updateStatus(id, isActive, user);
  }

  @Post(':bankId/users/onboard')
  @RequirePermissions('users', 'create')
  async onboardTenantAdmin(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() requester: UserEntity,
  ) {
    dto.bankId = bankId;
    return await this.usersService.createUser(dto, requester);
  }

  @Patch(':bankId/users/:userId/status')
  @RequirePermissions('users', 'update')
  async toggleUserStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() requester: UserEntity,
  ) {
    if (requester.roleType !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      throw new ForbiddenException('Security Policy: Cross-bank access denied.');
    }
    return await this.usersService.toggleStatus(userId, isActive, requester);
  }

  @Patch(':bankId/users/:userId/update')
  @RequirePermissions('users', 'update')
  async updateUserProfile(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() requester: UserEntity,
  ) {
    if (requester.roleType !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      throw new ForbiddenException('Security Policy: Cross-bank access denied.');
    }
    return await this.usersService.update(userId, dto, requester);
  }

  @Delete(':bankId/users/:userId/delete')
  @RequirePermissions('users', 'delete')
  async removeTenantAdmin(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() requester: UserEntity,
  ) {
    if (requester.roleType !== UserRole.SUPER_ADMIN && requester.bankId !== bankId) {
      throw new ForbiddenException('Security Policy: Cross-bank access denied.');
    }
    return await this.usersService.remove(userId, requester);
  }

  @Get(':bankId/admins')
  @RequirePermissions('users', 'read')
  @ApiOperation({ summary: 'Fetch administrators for a specific bank' })
  async getBankAdmins(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @CurrentUser() user: UserEntity,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
  ) {
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? bankId : user.bankId;
    if (!targetBankId) throw new ForbiddenException('No institutional link found.');
    return await this.usersService.findBankUsers(targetBankId, { limit, offset, search });
  }

  @Get('/:bankId/users/:userId')
  @RequirePermissions('users', 'read')
  @ApiOperation({ summary: 'Fetch specific user profile' })
  async fetchAdminDetails(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: UserEntity,
  ) {
    return await this.usersService.findBankUser(bankId, userId, currentUser);
  }
}