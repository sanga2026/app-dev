import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserEntity } from './entities/user.entity';
import { BanksModule } from '../banks/banks.module';
import { BranchesModule } from '../branches/branches.module';
import { RoleEntity } from '../access-control/entities/role.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  // 1. Register the User Entity for TypeORM
  imports: [
    TypeOrmModule.forFeature([UserEntity, RoleEntity]), // 👈 Also register RoleEntity for user-role relationships
      BanksModule,
      BranchesModule,
      AuditModule
    
  ],
  
  // 2. Register the Controller to handle HTTP requests
  controllers: [UsersController],
  
  // 3. Register the Service to handle business logic
  providers: [UsersService],
  
  // 4. Export the Service so other modules can use it
  exports: [UsersService],
})
export class UsersModule {}