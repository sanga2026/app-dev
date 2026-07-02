import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BanksModule } from './modules/banks/banks.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CustomersModule } from './modules/customers/customers.module';
import { MakerCheckerModule } from './modules/maker-checker/maker-checker.module';
import { NumberRangeModule } from './modules/number-ranges/number-range.module';
import { DocumentTypeModule } from './modules/master-data/document-types.module';
import { LoanProductModule } from './modules/loan-products/loan-product.module';
import { RolesModule } from './modules/access-control/roles.module';
import { AuditModule } from './modules/audit/audit.module';
import { GlobalSettingsModule } from './modules/global/global-settings.module';
import { GeographyModule }      from './modules/geography/geography.module';
import { CurrenciesModule }     from './modules/currencies/currencies.module';
import { DashboardModule }      from './modules/dashboard/dashboard.module';
import { AccountingModule }      from './modules/accounting/accounting.module';
import { AccountProductsModule }  from './modules/account-products/account-products.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Controllers
import { LoanOnboardingController } from './modules/loans/controllers/loan-onboarding.controller';

// Entities
import { UserEntity } from './modules/users/entities/user.entity';
import { LoanApplicationEntity } from './modules/loans/entities/application.entity';
import { BankEntity } from './modules/banks/entities/bank.entity';
import { BranchEntity } from './modules/branches/entities/branch.entity';
import { CustomerEntity } from './modules/customers/entities/customer.entity';
import { LoanAuditLogEntity } from './modules/loans/entities/loan-audit-log.entity';
import { AccountEntity }       from './modules/accounting/entities/account.entity';
import { AccountProductEntity } from './modules/account-products/entities/account-product.entity';
import { RoleEntity } from './modules/access-control/entities/role.entity';
import { GlobalSettingEntity } from './modules/global/entities/global-setting.entity';
import { AccessLogEntity } from './modules/audit/entities/access-log.entity';
import { DataAuditLogEntity } from './modules/audit/entities/data-audit-log.entity';
import { SessionEntity } from './modules/auth/session/entities/session.entity';
import { CountryEntity } from './modules/geography/entities/country.entity';
import { StateEntity } from './modules/geography/entities/state.entity';
import { TownEntity } from './modules/geography/entities/town.entity';
import { VillageEntity } from './modules/geography/entities/village.entity';
import { LoanProductEntity } from './modules/loan-products/entities/loan-product.entity';
import { DocumentTypeEntity } from './modules/master-data/entities/document-type.entity';
import { NumberRangeEntity } from './modules/number-ranges/entities/number-range.entity';
import { TransactionEntity } from './modules/accounting/entities/transaction.entity';
import { CurrencyEntity } from './modules/currencies/entities/currency.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Rate limiting: default 120 req/min; auth endpoints override with stricter limits
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 120 }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE', 'banking_os_core'),
        entities: [
          UserEntity, RoleEntity,
          LoanApplicationEntity, LoanAuditLogEntity, LoanProductEntity,
          BankEntity, BranchEntity,
          CustomerEntity,
          AccountEntity, AccountProductEntity, TransactionEntity,
          DocumentTypeEntity, NumberRangeEntity,
          AccessLogEntity, DataAuditLogEntity, SessionEntity,
          GlobalSettingEntity,
          CountryEntity, StateEntity, TownEntity, VillageEntity,
          CurrencyEntity,
        ],
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    AuthModule, RolesModule, UsersModule, BanksModule, BranchesModule,
    CustomersModule, MakerCheckerModule, NumberRangeModule, DocumentTypeModule,
    LoanProductModule, AuditModule, GlobalSettingsModule,
    GeographyModule, CurrenciesModule, DashboardModule,
    AccountingModule, AccountProductsModule,
  ],
  controllers: [LoanOnboardingController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global data-change audit trail — logs all POST/PATCH/DELETE results
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}