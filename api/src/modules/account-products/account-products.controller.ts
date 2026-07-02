import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus, ParseBoolPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard }   from '../access-control/guards/permissions.guard';
import { RequirePermissions }  from '../../common/decorators/require-permissions.decorator';
import { CurrentUser }         from '../../common/decorators/current-user.decorator';
import { UserEntity }          from '../users/entities/user.entity';
import { AccountProductsService } from './account-products.service';
import {
  CreateAccountProductDto, UpdateAccountProductDto,
} from './dto/account-product.dto';

@ApiTags('Account Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banks/:bankId/account-products')
export class AccountProductsController {
  constructor(private readonly svc: AccountProductsService) {}

  @Get()
  @RequirePermissions('banks', 'read')
  @ApiOperation({ summary: 'List account products for a bank' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAll(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) activeOnly: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.findAll(bankId, activeOnly);
  }

  @Get(':id')
  @RequirePermissions('banks', 'read')
  findOne(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('id',     ParseUUIDPipe) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.findOne(bankId, id);
  }

  @Post()
  @RequirePermissions('banks', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an account product (Bank Admin / Super Admin)' })
  create(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: CreateAccountProductDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.create(bankId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions('banks', 'update')
  @ApiOperation({ summary: 'Update account product' })
  update(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('id',     ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountProductDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.update(bankId, id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('banks', 'update')
  @ApiOperation({ summary: 'Activate or deactivate an account product' })
  toggleStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('id',     ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.toggleStatus(bankId, id, isActive, user);
  }

  @Delete(':id')
  @RequirePermissions('banks', 'delete')
  @ApiOperation({ summary: 'Delete an account product' })
  remove(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('id',     ParseUUIDPipe) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    return this.svc.remove(bankId, id, user);
  }
}
