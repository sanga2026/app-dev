import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryEntity } from './entities/country.entity';
import { StateEntity } from './entities/state.entity';
import { TownEntity } from './entities/town.entity';
import { VillageEntity } from './entities/village.entity';
import { GeographyService } from './geography.service';
import { GeographyController } from './geography.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CountryEntity, StateEntity, TownEntity, VillageEntity]),
  ],
  controllers: [GeographyController],
  providers: [GeographyService],
  exports: [GeographyService],
})
export class GeographyModule {}
