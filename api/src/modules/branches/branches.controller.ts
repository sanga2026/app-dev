import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  Delete,
  Query,
  ParseBoolPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Logger,
  HttpStatus,
  HttpCode,
  UseGuards,
  SetMetadata,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { BranchService } from './branches.service';
import { UsersService } from '../users/users.service'; // 🚀 Added UsersService
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';

import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateUserDto } from '../users/dto/create-user.dto'; // 🚀 Added User DTO
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Branch Management')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) 
@Controller('banks/:bankId/branches') 
export class BranchesController {
  private readonly logger = new Logger(BranchesController.name);

  constructor(
    private readonly branchService: BranchService,
    // 🚀 Injected UsersService to handle the staff creation/fetching
    @Inject(forwardRef(() => UsersService)) 
    private readonly usersService: UsersService,
  ) {}

  /**
   * 🚀 CREATE BRANCH
   * POST /banks/:bankId/branches
   */
  @Post()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @SetMetadata('action', 'CREATE_BRANCH') 
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new physical or digital branch' })
  async create(
    @Param('bankId', ParseUUIDPipe) bankId: string, 
    @Body() dto: CreateBranchDto, 
    @CurrentUser() user: UserEntity
  ) {
    this.logger.log(`[BRANCH_ONBOARDING] Initiated by ${user.email} for Bank: ${bankId}`);
    return await this.branchService.create(bankId, dto, user);
  }

  /**
   * 📊 LIST ALL BRANCHES BY BANK (Paginated)
   * GET /banks/:bankId/branches
   */
  @Get() 
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @SetMetadata('action', 'READ_BRANCH')
  @ApiOperation({ summary: 'List all branches under a specific tenant bank' })
  async findAllByBank(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search: string,
    @CurrentUser() user: UserEntity,
  ) {
    this.logger.log(`[BRANCH_LIST] Fetching branches for bank ${bankId}`);
    return await this.branchService.findAllByBank(bankId, user, { limit, offset, search });
  }

  /**
   * 🔍 GET BRANCH DETAILS
   * GET /banks/:bankId/branches/:branchId
   */
  @Get(':branchId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.BRANCH_MANAGER])
  @SetMetadata('action', 'READ_BRANCH')
  @ApiOperation({ summary: 'Fetch specific branch metadata' })
  async findOne(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string, 
    @CurrentUser() user: UserEntity,
  ) {
    this.logger.log(`[BRANCH_QUERY] ${user.email} looking up branch: ${branchId}`);
    return await this.branchService.findOne(bankId, branchId, user);
  }

  /**
   * 📝 UPDATE BRANCH METADATA
   * PATCH /banks/:bankId/branches/:branchId
   */
  @Patch(':branchId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @SetMetadata('action', 'UPDATE_BRANCH')
  @ApiOperation({ summary: 'Update branch address or contact details' })
  async update(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: any, 
    @CurrentUser() user: UserEntity,
  ) {
    // 🛡️ IMMUTABILITY GUARD
    const immutable = ['ifsc', 'branchCode', 'bankId'];
    immutable.forEach((field) => delete dto[field]);

    this.logger.log(`[BRANCH_UPDATE] Modifying branch ${branchId} by ${user.email}`);
    return await this.branchService.update(bankId, branchId, dto, user);
  }

  /**
   * 🛑 TOGGLE BRANCH STATUS
   * PATCH /banks/:bankId/branches/:branchId/status
   */
  @Patch(':branchId/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @SetMetadata('action', 'UPDATE_BRANCH_STATUS')
  @ApiOperation({ summary: 'Suspend or activate branch operations' })
  async toggleStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    this.logger.warn(`[BRANCH_STATUS_TOGGLE] Branch ${branchId} set to ${isActive} by ${user.email}`);
    return await this.branchService.updateStatus(bankId, branchId, isActive, user);
  }

  /**
   * 🗑️ DELETE BRANCH
   * DELETE /banks/:bankId/branches/:branchId
   */
  @Delete(':branchId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN]) 
  @SetMetadata('action', 'DELETE_BRANCH')
  @ApiOperation({ summary: 'Permanently delete a branch' })
  async delete(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
  ) {
    this.logger.warn(`[BRANCH_DELETION] Branch ${branchId} deleted by ${user.email}`);
    return await this.branchService.delete(bankId, branchId, user);
  }

  // ==========================================================================
  // 👥 FETCH LOCAL BRANCH STAFF
  // GET /banks/:bankId/branches/:branchId/staff
  // ==========================================================================
  @Get(':branchId/staff')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, 'BRANCH_MANAGER'])
  @ApiOperation({ summary: 'Fetch personnel assigned strictly to this branch' })
  async getBranchStaff(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: UserEntity,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('search') search?: string,
  ) {
    
    // 🛡️ SECURITY: Tenant Isolation Check
    const targetBankId = user.roleType === UserRole.SUPER_ADMIN ? bankId : user.bankId;
    if (!targetBankId || targetBankId !== bankId) {
      throw new ForbiddenException('Access Denied: Tenant mismatch.');
    }

    // Call the specific branch user fetcher in UsersService
    return await this.usersService.findBranchUsers(targetBankId, branchId, {
      limit,
      offset,
      search,
    });
  }

  // ==========================================================================
  // ➕ PROVISION BRANCH STAFF
  // POST /banks/:bankId/branches/:branchId/staff
  // ==========================================================================
  @Post(':branchId/staff')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision a new staff member at the branch level' })
  async provisionBranchStaff(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateUserDto, 
    @CurrentUser() requester: UserEntity
  ) {
    
    // 🛡️ SECURITY OVERRIDE (Anti-Spoofing)
    // Forcefully inject the Bank and Branch IDs from the URL params into the payload.
    dto.bankId = bankId;
    (dto as any).branchId = branchId; 

    this.logger.log(`[PROVISION]: User ${requester.email} creating staff for Branch ${branchId}`);

    // Call existing user creation logic. 
    return await this.usersService.createUser(dto, requester);
  }
}