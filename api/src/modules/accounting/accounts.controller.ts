import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard }      from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard }  from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { UserEntity }        from '../users/entities/user.entity';
import { AccountsService }   from './accounts.service';
import {
  CreateAccountDto, UpdateAccountDto, UpdateAccountStatusDto, CreateTransactionDto,
} from './dto/account.dto';

@ApiTags('Customer Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banks/:bankId/branches/:branchId/customers/:customerId/accounts')
export class AccountsController {
  constructor(private readonly svc: AccountsService) {}

  @Get()
  @RequirePermissions('accounting', 'read')
  @ApiOperation({ summary: 'List all accounts for a customer' })
  findAll(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.findAll(bankId, branchId, customerId, user);
  }

  @Get(':accountId')
  @RequirePermissions('accounting', 'read')
  @ApiOperation({ summary: 'Get a single account' })
  findOne(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('accountId',  ParseUUIDPipe) accountId:  string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.findOne(bankId, branchId, customerId, accountId, user);
  }

  @Post()
  @RequirePermissions('accounting', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a new account for a customer' })
  create(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.create(bankId, branchId, customerId, dto, user);
  }

  @Post(':accountId/transactions')
  @RequirePermissions('accounting', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Post a CREDIT or DEBIT transaction on an account' })
  postTransaction(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('accountId',  ParseUUIDPipe) accountId:  string,
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.postTransaction(bankId, branchId, customerId, accountId, dto, user);
  }

  @Patch(':accountId')
  @RequirePermissions('accounting', 'update')
  @ApiOperation({ summary: 'Update account details (limits, interest, metadata)' })
  update(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('accountId',  ParseUUIDPipe) accountId:  string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.update(bankId, branchId, customerId, accountId, dto, user);
  }

  @Patch(':accountId/status')
  @RequirePermissions('accounting', 'update')
  @ApiOperation({ summary: 'Update account status (Freeze, Close, Activate, etc.)' })
  updateStatus(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('accountId',  ParseUUIDPipe) accountId:  string,
    @Body() dto: UpdateAccountStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.updateStatus(bankId, branchId, customerId, accountId, dto, user);
  }

  @Delete(':accountId')
  @RequirePermissions('accounting', 'delete')
  @ApiOperation({ summary: 'Delete a CLOSED zero-balance account' })
  remove(
    @Param('bankId',     ParseUUIDPipe) bankId:     string,
    @Param('branchId',   ParseUUIDPipe) branchId:   string,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('accountId',  ParseUUIDPipe) accountId:  string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.remove(bankId, branchId, customerId, accountId, user);
  }
}