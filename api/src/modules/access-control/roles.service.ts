// src/modules/access-control/roles.service.ts

import { Injectable, Logger, NotFoundException, ForbiddenException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  // 📝 1. CREATE ROLE
  async create(dto: CreateRoleDto, user: UserEntity) {
    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;
    
    // 🚀 FIXED: Actually invoke the privilege check before proceeding!
    if (dto.permissions) {
      this.validatePrivilegeEscalation(user, dto.permissions);
    }

    const targetBankId = isSuperAdmin ? null : user.bankId;
    const sanitizedSlug = dto.slug.toUpperCase().trim();

    const existingRole = await this.roleRepo.findOne({
      where: { 
        role: sanitizedSlug, 
        bankId: targetBankId === null ? IsNull() : targetBankId
      }
    });

    if (existingRole) {
      throw new BadRequestException(
        isSuperAdmin 
          ? `A Global Template role with the identifier '${sanitizedSlug}' already exists.`
          : `Your institution already has a role identified by '${sanitizedSlug}'. Please choose a unique identifier.`
      );
    }

    const role = this.roleRepo.create({
      ...dto,
      role: sanitizedSlug,
      bankId: isSuperAdmin ? null : user.bankId,
      isSystemRole: isSuperAdmin ? (dto.isSystemRole || false) : false,
      createdBy : user.id
    });

    return await this.roleRepo.save(role);
  }

  // 📊 2. READ ALL (Context Aware)
  async findAll(user: UserEntity) {
    const whereClause = user.roleType === UserRole.SUPER_ADMIN 
      ? {} 
      : [{ bankId: IsNull() }, { bankId: user.bankId }];

    return await this.roleRepo.find({
      where: whereClause,
      order: { isSystemRole: 'DESC', name: 'ASC' }
    });
  }

  // 🔍 2.5 READ ONE (Context Aware) - 🚀 NEW!
async findOne(id: string, user: UserEntity) {
  const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;

  const whereClause: FindOptionsWhere<RoleEntity> | FindOptionsWhere<RoleEntity>[] = isSuperAdmin 
    ? { id } 
    : [
        { id, bankId: IsNull() } as FindOptionsWhere<RoleEntity>, 
        { id, bankId: user.bankId } as FindOptionsWhere<RoleEntity>
      ];

  const role = await this.roleRepo.findOne({ where: whereClause });

  if (!role) {
    throw new NotFoundException('Role not found or access denied.');
  }

  return role;
}

  // 📝 3. UPDATE ROLE (Clone-on-Write)
  async update(id: string, dto: UpdateRoleDto, user: UserEntity) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');

    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;

    // 🛡️ BOLA Guard
    if (role.bankId && role.bankId !== user.bankId && !isSuperAdmin) {
      throw new ForbiddenException('Access Denied: Role belongs to another institution.');
    }

    // 🛡️ System Role Guard
    if (role.isSystemRole && !isSuperAdmin) {
      throw new ForbiddenException('System roles cannot be directly modified. Please duplicate this role instead.');
    }

    // 🚀 FIXED: Actively prevent privilege escalation during updates!
    if (dto.permissions) {
      this.validatePrivilegeEscalation(user, dto.permissions);
    }

    const finalSlug = dto.slug ? dto.slug.toUpperCase().trim() : role.role;
    const targetBankId = isSuperAdmin ? null : user.bankId;

    // 🚀 THE MAGIC: Bank Admin is editing a Global Template
    if (role.bankId === null && !isSuperAdmin) {
      const existingCustom = await this.roleRepo.findOne({
        where: { role: finalSlug, bankId: targetBankId === null ? IsNull() : targetBankId }
      });

      if (existingCustom) {
        throw new BadRequestException(`You already have a customized role identified by '${finalSlug}'. Please edit your custom version instead of the Global Template.`);
      }

      this.logger.log(`[CLONE-ON-WRITE] Bank ${user.bankId} customizing Global Role ${role.role}`);
      
      const customRole = this.roleRepo.create({
        role: finalSlug,
        name: dto.name || role.name,
        description: dto.description || role.description,
        bankId: user.bankId, 
        isSystemRole: false,
        permissions: { ...role.permissions, ...dto.permissions }
      });
      
      const savedCustomRole = await this.roleRepo.save(customRole);

      await this.userRepo.update(
        { bankId: user.bankId as string, roleId: role.id },
        { roleId: savedCustomRole.id }
      );

      return savedCustomRole;
    }

    // 🛡️ RENAME COLLISION PREVENTION
    if (dto.slug && finalSlug !== role.role) {
      const collisionRole = await this.roleRepo.findOne({
        where: { role: finalSlug, bankId: targetBankId === null ? IsNull() : targetBankId }
      });

      if (collisionRole && collisionRole.id !== id) {
        throw new BadRequestException(`Cannot rename. A role identified by '${finalSlug}' already exists in your institution.`);
      }
      dto.slug = finalSlug;
    }

    Object.assign(role, dto);
    return await this.roleRepo.save(role);
  }

  // 🛑 4. DELETE ROLE
  async remove(id: string, user: UserEntity) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');

    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;

    if (role.bankId && role.bankId !== user.bankId && !isSuperAdmin) {
      throw new ForbiddenException('Access Denied.');
    }

    if (role.isSystemRole || (role.bankId === null && !isSuperAdmin)) {
      throw new ForbiddenException('Global and System templates cannot be deleted.');
    }

    const activeUsers = await this.userRepo.count({ where: { roleId: id } });
    if (activeUsers > 0) {
      throw new ForbiddenException(`Cannot delete role. ${activeUsers} users are currently assigned to it.`);
    }

    await this.roleRepo.remove(role);
    return { success: true, message: 'Role deleted successfully.' };
  }

  /**
   * 🛡️ MAXIMUM PRIVILEGE BOUNDARY CHECK
   */
  private validatePrivilegeEscalation(creator: UserEntity, requestedPermissions: any) {
    if (creator.roleType === UserRole.SUPER_ADMIN) return;

    const creatorPermissions = creator.role?.permissions || {};
    const requested = requestedPermissions || {};

    for (const [resource, actions] of Object.entries(requested)) {
      const creatorResourcePerms = creatorPermissions[resource] || {};

      for (const [action, isGranted] of Object.entries(actions as Record<string, boolean>)) {
        if (isGranted === true && creatorResourcePerms[action] !== true) {
          throw new ForbiddenException(
            `Privilege Escalation Detected: You cannot grant '${action}' access to '${resource}'.`
          );
        }
      }
    }
  }

  async updateStatus(id: string, dto: { isActive: boolean }, user: UserEntity) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found.');
    const isSuperAdmin = user.roleType === UserRole.SUPER_ADMIN;

    if (role.bankId && role.bankId !== user.bankId && !isSuperAdmin) {
      throw new ForbiddenException('Access Denied.');
    }
    if (role.isSystemRole && !isSuperAdmin) {
      throw new ForbiddenException('System roles cannot be deactivated. Please duplicate this role and modify the custom version instead.');
    }
    role.isActive = dto.isActive;
    return await this.roleRepo.save(role);
  }
}