import { DataSource } from 'typeorm';
import { config } from 'dotenv';

import { UserEntity } from '../modules/users/entities/user.entity';
import { RoleEntity } from '../modules/access-control/entities/role.entity';
import { BankEntity } from '../modules/banks/entities/bank.entity';
import { BranchEntity } from '../modules/branches/entities/branch.entity';
import { CustomerEntity } from '../modules/customers/entities/customer.entity';
import { AccountEntity }        from '../modules/accounting/entities/account.entity';
import { AccountProductEntity }  from '../modules/account-products/entities/account-product.entity';
import { TransactionEntity } from '../modules/accounting/entities/transaction.entity';
import { LoanApplicationEntity } from '../modules/loans/entities/application.entity';
import { LoanAuditLogEntity } from '../modules/loans/entities/loan-audit-log.entity';
import { LoanProductEntity } from '../modules/loan-products/entities/loan-product.entity';
import { DocumentTypeEntity } from '../modules/master-data/entities/document-type.entity';
import { NumberRangeEntity } from '../modules/number-ranges/entities/number-range.entity';
import { AccessLogEntity } from '../modules/audit/entities/access-log.entity';
import { SessionEntity } from '../modules/auth/session/entities/session.entity';
import { GlobalSettingEntity } from '../modules/global/entities/global-setting.entity';
import { CountryEntity } from '../modules/geography/entities/country.entity';
import { StateEntity } from '../modules/geography/entities/state.entity';
import { TownEntity } from '../modules/geography/entities/town.entity';
import { VillageEntity } from '../modules/geography/entities/village.entity';
import { CurrencyEntity } from '../modules/currencies/entities/currency.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'banking_os_core',
  entities: [
    UserEntity,
    RoleEntity,
    BankEntity,
    BranchEntity,
    CustomerEntity,
    AccountEntity,
    AccountProductEntity,
    TransactionEntity,
    LoanApplicationEntity,
    LoanAuditLogEntity,
    LoanProductEntity,
    DocumentTypeEntity,
    NumberRangeEntity,
    AccessLogEntity,
    SessionEntity,
    GlobalSettingEntity,
    CountryEntity,
    StateEntity,
    TownEntity,
    VillageEntity,
    CurrencyEntity,
  ],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});
