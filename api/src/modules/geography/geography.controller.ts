import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { GeographyService } from './geography.service';
import {
  CreateCountryDto, UpdateCountryDto,
  CreateStateDto, UpdateStateDto,
  CreateTownDto, UpdateTownDto,
  CreateVillageDto, UpdateVillageDto,
} from './dto/geography.dto';

@ApiTags('Geography')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('geography')
export class GeographyController {
  constructor(private readonly service: GeographyService) {}

  // ─── COUNTRIES ───────────────────────────────────────────────────────────────

  @Get('countries')
  @ApiOperation({ summary: 'List all countries' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getCountries(@Query('activeOnly') activeOnly?: string) {
    return this.service.findAllCountries(activeOnly === 'true');
  }

  @Get('countries/:code')
  getCountry(@Param('code') code: string) {
    return this.service.findCountry(code);
  }

  @Post('countries')
  @ApiOperation({ summary: 'Create country (Super Admin only)' })
  createCountry(@Body() dto: CreateCountryDto, @CurrentUser() user: UserEntity) {
    return this.service.createCountry(dto, user);
  }

  @Patch('countries/:code')
  updateCountry(
    @Param('code') code: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.updateCountry(code, dto, user);
  }

  // ─── STATES ──────────────────────────────────────────────────────────────────

  @Get('countries/:countryCode/states')
  @ApiOperation({ summary: 'List states for a country' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getStates(
    @Param('countryCode') countryCode: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findStates(countryCode, activeOnly === 'true');
  }

  @Get('states/:id')
  getState(@Param('id') id: string) {
    return this.service.findState(id);
  }

  @Post('countries/:countryCode/states')
  createState(
    @Param('countryCode') countryCode: string,
    @Body() dto: CreateStateDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.createState(countryCode, dto, user);
  }

  @Patch('states/:id')
  updateState(
    @Param('id') id: string,
    @Body() dto: UpdateStateDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.updateState(id, dto, user);
  }

  // ─── TOWNS ───────────────────────────────────────────────────────────────────

  @Get('states/:stateId/towns')
  @ApiOperation({ summary: 'List towns for a state' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getTowns(
    @Param('stateId') stateId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findTowns(stateId, activeOnly === 'true');
  }

  @Post('states/:stateId/towns')
  createTown(
    @Param('stateId') stateId: string,
    @Body() dto: CreateTownDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.createTown(stateId, dto, user);
  }

  @Patch('towns/:id')
  updateTown(
    @Param('id') id: string,
    @Body() dto: UpdateTownDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.updateTown(id, dto, user);
  }

  // ─── VILLAGES ────────────────────────────────────────────────────────────────

  @Get('towns/:townId/villages')
  @ApiOperation({ summary: 'List villages for a town' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  getVillages(
    @Param('townId') townId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.service.findVillages(townId, activeOnly === 'true');
  }

  @Post('towns/:townId/villages')
  createVillage(
    @Param('townId') townId: string,
    @Body() dto: CreateVillageDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.createVillage(townId, dto, user);
  }

  @Patch('villages/:id')
  updateVillage(
    @Param('id') id: string,
    @Body() dto: UpdateVillageDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.service.updateVillage(id, dto, user);
  }

  @Delete('countries/:code')
  removeCountry(@Param('code') code: string, @CurrentUser() user: UserEntity) {
    return this.service.removeCountry(code, user);
  }

  @Delete('states/:id')
  removeState(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.service.removeState(id, user);
  }

  @Delete('towns/:id')
  removeTown(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.service.removeTown(id, user);
  }

  @Delete('villages/:id')
  removeVillage(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return this.service.removeVillage(id, user);
  }
}
