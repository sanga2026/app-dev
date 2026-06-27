import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanProductEntity } from './entities/loan-product.entity';
import { LoanProductService } from './loan-product.service';
import { LoanProductController } from './loan-product.controller';
import { BanksModule } from '../banks/banks.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([LoanProductEntity]), // <--- IMPORTANT
    BanksModule, // <--- TO ACCESS BANK ENTITIES FOR FK RELATION
  ],
  controllers: [LoanProductController],
  providers: [LoanProductService],
  exports: [LoanProductService],
})
export class LoanProductModule {}