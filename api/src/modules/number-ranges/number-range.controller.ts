import {
  Body, Controller, Post, Get, Query, BadRequestException,
  Patch, Param, ParseBoolPipe, UseGuards, Logger,
  HttpStatus, HttpCode, ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NumberRangeService } from './number-range.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';

@ApiTags('Number Ranges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('number-ranges')
export class NumberRangeController {
  private readonly logger = new Logger(NumberRangeController.name);

  constructor(private readonly nrService: NumberRangeService) {}

  @Get('next')
  @RequirePermissions('master-data', 'read')
  @ApiOperation({ summary: 'Generate next formatted ID for a given type' })
  async getNext(
    @Query('type') type: string,
    @Query('bankId') queryBankId: string,
    @CurrentUser() user: UserEntity,
  ) {
    if (!type) throw new BadRequestException('Sequence type (CUSTOMER, LOAN, etc.) is required.');

    let targetBankId: string | null = user.bankId;
    if (user.roleType === UserRole.SUPER_ADMIN) {
      targetBankId = queryBankId || user.bankId;
    }
    if (!targetBankId) {
      throw new BadRequestException(
        user.roleType === UserRole.SUPER_ADMIN
          ? 'Super Admin: provide ?bankId=... to target a specific bank.'
          : 'Your account is not linked to a bank.',
      );
    }

    const nextId = await this.nrService.getNextNumber(targetBankId, type);
    return { success: true, data: { type: type.toUpperCase(), bankId: targetBankId, nextId } };
  }

  @Get()
  @RequirePermissions('master-data', 'read')
  @ApiOperation({ summary: 'List number ranges (scoped to bank)' })
  async findAll(
    @Query('bankId') bankId: string,
    @CurrentUser() user: UserEntity,
  ) {
    // Allow super admin to query a specific bank's ranges
    const effectiveUser = bankId && user.roleType === UserRole.SUPER_ADMIN
      ? { ...user, bankId } as UserEntity
      : user;
    return await this.nrService.findAllByBank(effectiveUser);
  }

  @Get(':id')
  @RequirePermissions('master-data', 'read')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return await this.nrService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('master-data', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new number range sequence for a bank' })
  async create(@Body() dto: any, @CurrentUser() user: UserEntity) {
    if (user.roleType !== UserRole.SUPER_ADMIN) {
      dto.bankId = user.bankId;
    }
    if (!dto.bankId) throw new BadRequestException('bankId is required.');
    if (!dto.type)   throw new BadRequestException('type is required.');
    return await this.nrService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('master-data', 'update')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.nrService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('master-data', 'update')
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.nrService.toggleStatus(id, isActive, user);
  }
}
