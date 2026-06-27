// src/modules/branches/branches.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchEntity } from './entities/branch.entity';
import { BranchService } from './branches.service'; // Import the service
import { BranchesController } from './branches.controller';
import { BanksModule } from '../banks/banks.module';
import { UsersModule } from '../users/users.module';

@Module({
imports: [TypeOrmModule.forFeature([BranchEntity]),forwardRef(() => UsersModule),BanksModule],
  providers: [BranchService], // Register it here as a provider
  controllers: [BranchesController],
  exports: [BranchService], // Export it if other modules need branch logic
})
export class BranchesModule {}