import {
  Controller, Post, Body, Param, Get, Patch, Delete, Query,
  ParseBoolPipe, DefaultValuePipe, ParseIntPipe, ParseUUIDPipe,
  Logger, HttpStatus, HttpCode, UseGuards, ForbiddenException,
  Inject, forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchService } from './branches.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';

@ApiTags('Branch Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banks/:bankId/branches')
export class BranchesController {
  private readonly logger = new Logger(BranchesController.name);

  constructor(
    private readonly branchService: BranchService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @RequirePermissions('branches', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new physical or digital branch' })
  async create(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: UserEntity,
  ) {
    this.logger.log(`[BRANCH_ONBOARDING] ${user.email} for Bank: ${bankId}`);
    return await this.branchService.create(bankId, dto, user);
  }

  @Get()
  @RequirePermissions('branches', 'read')
  @ApiOperation({ summary: 'List all branches under a specific tenant bank' })
  async findAllByBank(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search: string,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.branchService.findAllByBank(bankId, user, { limit, offset, search });
  }

  @Get(':branchId')
  @RequirePermissions('branches', 'read')
  @ApiOperation({ summary: 'Fetch specific branch metadata' })
  async findOne(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.branchService.findOne(bankId, branchId, user);
  }

  @Patch(':branchId')
  @RequirePermissions('branches', 'update')
  @ApiOperation({ summary: 'Update branch address or contact details' })
  async update(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity,
  ) {
    (['ifsc', 'branchCode', 'bankId'] as string[]).forEach(f => delete dto[f]);
    return await this.branchService.update(bankId, branchId, dto, user);
  }

  @Patch(':branchId/status')
  @RequirePermissions('branches', 'update')
  @ApiOperation({ summary: 'Suspend or activate branch operations' })
  async toggleStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.branchService.updateStatus(bankId, branchId, isActive, user);
  }

  @Delete(':branchId')
  @RequirePermissions('branches', 'delete')
  @ApiOperation({ summary: 'Permanently delete a branch' })
  async delete(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.branchService.delete(bankId, branchId, user);
  }

  @Get(':branchId/staff')
  @RequirePermissions('users', 'read')
  @ApiOperation({ summary: 'Fetch personnel assigned to this branch' })
  async getBranchStaff(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
  ) {
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? bankId : user.bankId;
    if (!targetBankId || targetBankId !== bankId) {
      throw new ForbiddenException('Access Denied: Tenant mismatch.');
    }
    return await this.usersService.findBranchUsers(targetBankId, branchId, { limit, offset, search });
  }

  @Post(':branchId/staff')
  @RequirePermissions('users', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new staff member at the branch level' })
  async provisionBranchStaff(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateUserDto,
    @CurrentUser() requester: UserEntity,
  ) {
    dto.bankId = bankId;
    (dto as any).branchId = branchId;
    return await this.usersService.createUser(dto, requester);
  }
}
