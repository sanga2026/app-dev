import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberRangeEntity } from './entities/number-range.entity';
import { NumberRangeService } from './number-range.service';
import { NumberRangeController } from './number-range.controller';
import { BanksModule } from '../banks/banks.module';

@Module({
  imports: [TypeOrmModule.forFeature([NumberRangeEntity]),BanksModule],
  controllers: [NumberRangeController], // <--- MUST be here
  providers: [NumberRangeService],
  exports: [NumberRangeService], // Export so Banks/Loans can use it later
})
export class NumberRangeModule {}