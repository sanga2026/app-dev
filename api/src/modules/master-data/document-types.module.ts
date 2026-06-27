import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTypeEntity } from './entities/document-type.entity';
import { DocumentTypeService } from './document-types.service'; // Ensure this path is correct
import { DocumentTypeController } from './document-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentTypeEntity])],
  controllers: [DocumentTypeController],
  providers: [DocumentTypeService],
  // RENAME TO SINGULAR TO MATCH YOUR APP.MODULE IMPORT
  exports: [DocumentTypeService], 
})
export class DocumentTypeModule {} // <--- REMOVED the 's'