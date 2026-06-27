import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // 👈 Added Config
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BanksModule } from './modules/banks/banks.module';
import { BranchesModule } from './modules/branches/branches.module';
import { CustomersModule } from './modules/customers/customers.module';
import { MakerCheckerModule } from './modules/maker-checker/maker-checker.module';
import { NumberRangeModule } from './modules/number-ranges/number-range.module';
import { DocumentTypeModule } from './modules/master-data/document-types.module';
import { LoanProductModule } from './modules/loan-products/loan-product.module';

// Controllers and Entities
import { LoanOnboardingController } from './modules/loans/controllers/loan-onboarding.controller';
import { UserEntity } from './modules/users/entities/user.entity';
import { LoanApplicationEntity } from './modules/loans/entities/application.entity';
import { BankEntity } from './modules/banks/entities/bank.entity';
import { BranchEntity } from './modules/branches/entities/branch.entity';
import { CustomerEntity } from './modules/customers/entities/customer.entity';
import { LoanAuditLogEntity } from './modules/loans/entities/loan-audit-log.entity';
import { AccountEntity } from './modules/accounting/entities/account.entity';
import { RolesModule } from './modules/access-control/roles.module';
import { RoleEntity } from './modules/access-control/entities/role.entity';
import { AuditModule } from './modules/audit/audit.module';
import { SessionModule } from './modules/auth/session/session.module';
import { GlobalSettingsModule } from './modules/global/global-settings.module';
import { GlobalSettingEntity } from './modules/global/entities/global-setting.entity';
import { AccessLogEntity } from './modules/audit/entities/access-log.entity';
import { SessionEntity } from './modules/auth/session/entities/session.entity';

@Module({
  imports: [
    // 1. Initialize Configuration globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Production-Ready Database Connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD'), // Pulls $Teddy@bank from .env
        database: config.get<string>('DB_DATABASE', 'banking_os_core'),
        entities: [
          UserEntity,
          RoleEntity,
          LoanApplicationEntity,
          LoanAuditLogEntity,
          BankEntity,
          BranchEntity,
          CustomerEntity,
          AccountEntity,
          // AuditModule,
          // SessionModule,
          AccessLogEntity,
          SessionEntity,
          GlobalSettingEntity
        ],
        autoLoadEntities: true,
        // Safety: Auto-sync only in development
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // 3. Feature Modules
    AuthModule,
    RolesModule,
    UsersModule,
    BanksModule,
    BranchesModule,
    CustomersModule,
    MakerCheckerModule,
    NumberRangeModule,
    DocumentTypeModule,
    LoanProductModule,
    GlobalSettingsModule
  ],
  controllers: [LoanOnboardingController],
})
export class AppModule {}