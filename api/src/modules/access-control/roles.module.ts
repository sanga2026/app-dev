// src/modules/access-control/roles.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { RoleEntity } from './entities/role.entity';
import { UserEntity } from '../users/entities/user.entity'; // 👈 Needed for the clone-on-write user migration

@Module({
  imports: [
    // 🚀 Register both entities so the RolesService can use them
    TypeOrmModule.forFeature([RoleEntity, UserEntity]) 
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService] // Export in case UsersModule needs to check role details later
})
export class RolesModule {}