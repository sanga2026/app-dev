import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MakerCheckerController } from './maker-checker.controller';
import { MakerCheckerService } from './maker-checker.service';

@Module({
  imports: [
    // Logic: This allows the MakerCheckerService to inject the 'DataSource'
    // and access the metadata of entities registered in other modules.
    TypeOrmModule, 
  ],
  controllers: [MakerCheckerController],
  providers: [MakerCheckerService],
  // Logic: Exporting the service so the LoansModule can inject it
  exports: [MakerCheckerService], 
})
export class MakerCheckerModule {}