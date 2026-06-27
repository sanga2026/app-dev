// src/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AccessLogEntity } from './entities/access-log.entity';
import { UserEntity } from '../users/entities/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([AccessLogEntity, UserEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService], // Export so AuthService can use it during login
})
export class AuditModule {}