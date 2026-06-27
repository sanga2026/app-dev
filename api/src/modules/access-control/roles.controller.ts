// src/modules/access-control/roles.controller.ts

import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// Guards & Decorators
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';

@ApiTags('Role-Based Access Control')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions('roles', 'create')
  @ApiOperation({ summary: 'Create a new role (Global or Custom)' })
  async create(@Body() createRoleDto: CreateRoleDto, @CurrentUser() user: UserEntity) {
    return await this.rolesService.create(createRoleDto, user);
  }

  @Get()
  @RequirePermissions('roles', 'read')
  @ApiOperation({ summary: 'List all available roles for the tenant' })
  async findAll(@CurrentUser() user: UserEntity) {
    return await this.rolesService.findAll(user);
  }

  // 🚀 NEW: The missing endpoint for your detail page!
  @Get(':id')
  @RequirePermissions('roles', 'read') 
  @ApiOperation({ summary: 'Get details of a specific role' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    return await this.rolesService.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermissions('roles', 'update')
  @ApiOperation({ summary: 'Update or Customize a role' })
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: UserEntity
  ) {
    return await this.rolesService.update(id, updateRoleDto, user);
  }

  @Delete(':id')
  @RequirePermissions('roles', 'delete')
  @ApiOperation({ summary: 'Delete a custom role' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserEntity) {
    return await this.rolesService.remove(id, user);
  }

  @Patch(':id/status')
  @RequirePermissions('roles', 'update')
  @ApiOperation({ summary: 'Update the status of a role' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleStatusDto: { isActive: boolean },
    @CurrentUser() user: UserEntity
  ) {
    return await this.rolesService.updateStatus(id, updateRoleStatusDto, user);
  }
}