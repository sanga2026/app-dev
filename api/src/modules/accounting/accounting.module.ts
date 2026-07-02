import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity }    from './entities/account.entity';
import { TransactionEntity } from './entities/transaction.entity';
import { CustomerEntity }   from '../customers/entities/customer.entity';
import { AccountsService }  from './accounts.service';
import { AccountsController } from './accounts.controller';
import { NumberRangeModule } from '../number-ranges/number-range.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TransactionEntity, CustomerEntity]),
    NumberRangeModule,
  ],
  controllers: [AccountsController],
  providers:   [AccountsService],
  exports:     [AccountsService],
})
export class AccountingModule {}
