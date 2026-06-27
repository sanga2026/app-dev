import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CustomerEntity } from './entities/customer.entity';
// 1. Import the actual Modules
import { BanksModule } from '../banks/banks.module';
import { NumberRangeModule } from '../number-ranges/number-range.module';
import { DocumentTypeModule } from '../master-data/document-types.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerEntity]),
    // 2. Add them to the imports array so their services are available
    BanksModule,
    BranchesModule,
    NumberRangeModule,
    DocumentTypeModule
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService], // Export if other modules need to use customer logic
})
export class CustomersModule {}