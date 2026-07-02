import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';

@ApiTags('Currencies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly service: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all currencies' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAll(activeOnly === 'true');
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get currency by code' })
  findOne(@Param('code') code: string) {
    return this.service.findOne(code);
  }

  @Post()
  @ApiOperation({ summary: 'Create currency (Super Admin only)' })
  create(@Body() dto: CreateCurrencyDto, @CurrentUser() user: UserEntity) {
    return this.service.create(dto, user);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Update currency (Super Admin only)' })
  update(
    @Param('code') code: string,
    @Body() dto: UpdateCurrencyDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.update(code, dto, user);
  }

  @Patch(':code/status')
  @ApiOperation({ summary: 'Toggle currency active status' })
  toggleStatus(@Param('code') code: string, @CurrentUser() user: UserEntity) {
    return this.service.toggleStatus(code, user);
  }

  @Delete(':code')
  @ApiOperation({ summary: 'Delete currency (Super Admin only)' })
  remove(@Param('code') code: string, @CurrentUser() user: UserEntity) {
    return this.service.remove(code, user);
  }
}
