// src/data-source.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/access-control/entities/role.entity';
import { LoanApplicationEntity } from '../modules/loans/entities/application.entity';
import { LoanAuditLogEntity } from '../modules/loans/entities/loan-audit-log.entity';
import { BankEntity } from '../modules/banks/entities/bank.entity';
import { BranchEntity } from '../modules/branches/entities/branch.entity';
import { CustomerEntity } from '../modules/customers/entities/customer.entity';
import { AccountEntity } from '../modules/accounting/entities/account.entity';
import { BaseBankingEntity } from '../common/entities/base-banking.entity';

// 1. Manually load .env (since NestJS ConfigModule isn't running here)
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'), // 👈 Convert string to number safely
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '', // 👈 Ensures it's never undefined
  database: process.env.DB_DATABASE || 'banking_os_core',
 entities: [
  BaseBankingEntity,
           UserEntity,
           RoleEntity,
           LoanApplicationEntity,
           LoanAuditLogEntity,
           BankEntity,
           BranchEntity,
           CustomerEntity,
           AccountEntity,
         ],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});