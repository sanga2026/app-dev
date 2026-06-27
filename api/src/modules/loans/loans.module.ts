// src/modules/loans/loans.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplicationEntity } from './entities/application.entity';
import { LoanOnboardingController } from './controllers/loan-onboarding.controller';
import { MakerCheckerModule } from '../maker-checker/maker-checker.module';

// --- 1. IMPORT THE MISSING BLUEPRINTS ---
import { BankEntity } from '../banks/entities/bank.entity';
import { BranchEntity } from '../branches/entities/branch.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { LoanAuditLogEntity } from './entities/loan-audit-log.entity';
import { AccountEntity } from '../accounting/entities/account.entity';

@Module({
  imports: [
    // --- 2. REGISTER ALL RELATED ENTITIES ---
    TypeOrmModule.forFeature([
      LoanApplicationEntity, 
      LoanAuditLogEntity, 
      BankEntity, 
      BranchEntity, 
      CustomerEntity,
      AccountEntity,
    ]), 
    MakerCheckerModule
  ],
  controllers: [LoanOnboardingController],
  exports: [TypeOrmModule] 
})
export class LoansModule {}