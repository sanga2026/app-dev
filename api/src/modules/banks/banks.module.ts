import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankEntity } from './entities/bank.entity';
import { BankService } from './banks.service';
import { BanksController } from './banks.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([BankEntity]),forwardRef(() => UsersModule),],
  controllers: [BanksController], // <--- Ensure this is here
  providers: [BankService],
  exports: [BankService],
})
export class BanksModule {}