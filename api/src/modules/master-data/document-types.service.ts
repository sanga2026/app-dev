// src/modules/master-data/document-types.service.ts

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  HttpException,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTypeEntity } from './entities/document-type.entity';
import { UserEntity } from '../users/entities/user.entity';
import { getErrorMessage } from '../../common/utils/error-handler.util';

// 🚀 IMPORT DTOs
import { 
  CreateDocumentTypeDto, 
  UpdateDocumentTypeDto 
} from './dto/document-type.dto';

@Injectable()
export class DocumentTypeService implements OnModuleInit {
  private readonly logger = new Logger(DocumentTypeService.name);

  /**
   * GLOBAL REGISTRY CACHE
   * Stores active documents in RAM for O(1) lookup speed during KYC.
   */
  private documentRegistry = new Map<string, DocumentTypeEntity>();

  constructor(
    @InjectRepository(DocumentTypeEntity)
    private readonly docRepo: Repository<DocumentTypeEntity>,
  ) {}

  /**
   * BOOTSTRAP: Synchronize cache on server startup.
   */
  async onModuleInit() {
    this.logger.log('[INIT] Initializing Global Document Registry...');
    await this.refreshCache();
  }

  /**
   * REFRESH CACHE: Loads active definitions into the Map.
   */
  async refreshCache() {
    try {
      const activeDocs = await this.docRepo.find({ where: { isActive: true } });

      // Atomic-like update: Clear and repopulate
      this.documentRegistry.clear();
      activeDocs.forEach((doc) => {
        if (doc.id) {
          this.documentRegistry.set(doc.id.toUpperCase(), doc);
        }
      });

      this.logger.log(
        `[CACHE_SYNC] Registry refreshed. ${this.documentRegistry.size} active definitions loaded.`,
      );
    } catch (error) {
      this.logger.error(
        `[CACHE_SYNC_ERROR] Critical failure: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * CREATE: Registers a new global document type.
   */
  async create(dto: CreateDocumentTypeDto, user: UserEntity) {
    // 🛡️ Manual validation removed. NestJS ValidationPipe handles it before it gets here!
    
    const docId = dto.id.toUpperCase().trim();

    // 🛡️ 1. REGEX COMPILE CHECK (Safety net to prevent bad regex strings from crashing the app later)
    if (dto.validationRegex) {
      try {
        new RegExp(dto.validationRegex);
      } catch (e) {
        throw new BadRequestException(
          `Pattern Error: The provided regex '${dto.validationRegex}' is not a valid regular expression.`,
        );
      }
    }

    try {
      // 🛡️ 2. DEDUPLICATION
      const existing = await this.docRepo.findOne({ where: { id: docId } });
      if (existing) {
        throw new ConflictException(
          `Duplicate Error: Document code '${docId}' is already registered in the master data.`,
        );
      }

      // 🛡️ 3. ENTITY CONSTRUCTION
      const newDoc = this.docRepo.create({
        ...dto,
        id: docId, // Force uppercase
        name: dto.name.trim(),
        isActive: dto.isActive ?? true,
        createdBy: user?.id,
        updatedBy: user?.id,
      });

      const saved = await this.docRepo.save(newDoc);

      const creatorInfo = {
        firstName: user.firstName,
        lastName: user.lastName,
        role: {
          name: user.role?.name || 'Authorized User',
        },
      };
      
      // 🛡️ 4. REFRESH REGISTRY
      await this.refreshCache();

      return {
        success: true,
        statusCode: 201,
        message: `Global Document '${docId}' established successfully by ${user?.email || 'System'}.`,
        data: saved,
        creator: creatorInfo,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `[DOC_CREATE_FAIL] ID: ${docId} | Error: ${getErrorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Technical failure during Master Data registration.',
      );
    }
  }

  /**
   * UPDATE: Modify Metadata with Immutability Guards.
   */
  async update(id: string, dto: UpdateDocumentTypeDto, user: UserEntity) {
    if (!id)
      throw new BadRequestException('Identifier Error: Document ID is required for update.');

    const docId = id.toUpperCase().trim();

    try {
      const doc = await this.docRepo.findOne({ where: { id: docId } });
      if (!doc) {
        throw new NotFoundException(`Lookup Error: Document type '${docId}' does not exist.`);
      }

      // 🛡️ 1. REGEX VALIDITY CHECK
      if (dto.validationRegex) {
        try {
          new RegExp(dto.validationRegex);
        } catch (e) {
          throw new BadRequestException(
            `Pattern Error: The updated regex '${dto.validationRegex}' is invalid.`,
          );
        }
      }

      // 🛡️ 2. MERGE & AUDIT
      const updated = this.docRepo.merge(doc, {
        ...dto,
        updatedBy: user?.id,
        updatedAt: new Date(),
      });

      const saved = await this.docRepo.save(updated);
      await this.refreshCache();

      const updaterInfo = {
        firstName: user.firstName,
        lastName: user.lastName,
        role: {
          name: user.role?.name || 'Authorized User',
        },
      };

      return {
        success: true,
        statusCode: 200,
        message: `Master Data updated for '${docId}'.`,
        updater: updaterInfo,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `[DOC_UPDATE_FAIL] ID: ${docId} | Error: ${getErrorMessage(error)}`,
      );
      throw new InternalServerErrorException('Failed to update Master Data metadata.');
    }
  }

  /**
   * STATUS TOGGLE: Activate/Deactivate platform-wide document support.
   */
  async toggleStatus(id: string, status: boolean, user: UserEntity) {
    if (!id) throw new BadRequestException('Identifier Error: ID is required.');

    const docId = id.toUpperCase().trim();

    try {
      const doc = await this.docRepo.findOne({ where: { id: docId } });
      if (!doc) throw new NotFoundException(`Lookup Error: Document '${docId}' not found.`);

      // 🛡️ NO-OP CHECK
      if (doc.isActive === status) {
        return {
          success: true,
          message: `Document '${docId}' is already ${status ? 'ENABLED' : 'DISABLED'}.`,
          data: doc,
        };
      }

      doc.isActive = status;
      doc.updatedBy = user?.id;
      doc.updatedAt = new Date();

      const saved = await this.docRepo.save(doc);
      await this.refreshCache();

      this.logger.warn(`[STATUS_TRANSITION] Document ${docId} changed to ${status} by ${user?.email}`);

      return {
        success: true,
        statusCode: 200,
        message: `Support for '${docId}' has been ${status ? 'ENABLED' : 'DISABLED'}.`,
        data: { id: docId, isActive: saved.isActive },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Critical error during status transition.');
    }
  }

  /**
   * VALIDATE VALUE: Regulatory helper to check value against stored Regex.
   */
  validate(
    docTypeId: string,
    value: string,
  ): { isValid: boolean; message?: string } {
    if (!docTypeId || !value) {
      return {
        isValid: false,
        message: 'Missing document type or value to validate.',
      };
    }

    const doc = this.documentRegistry.get(docTypeId.toUpperCase());

    if (!doc) {
      return {
        isValid: false,
        message: `Document type '${docTypeId}' is not supported or active.`,
      };
    }

    if (!doc.validationRegex) {
      return { isValid: true };
    }

    try {
      const regex = new RegExp(doc.validationRegex);
      const isValid = regex.test(value);
      return {
        isValid,
        message: isValid
          ? undefined
          : `The value does not match the required format for ${doc.name}.`,
      };
    } catch (e) {
      this.logger.error(`[REGEX_EXEC_ERROR] Type: ${docTypeId} | Pattern: ${doc.validationRegex}`);
      return {
        isValid: false,
        message: 'Internal validation logic error.',
      };
    }
  }

  /**
   * REGISTRY LOOKUP: Returns full entity from RAM.
   */
  getDocumentDetails(id: string): DocumentTypeEntity | undefined {
    if (!id) return undefined;
    return this.documentRegistry.get(id.toUpperCase());
  }

  /**
   * FIND ALL
   */
  async findAll(onlyActive: boolean = true) {
    try {
      const docs = await this.docRepo.find({
        where: onlyActive ? { isActive: true } : {},
        select: {
          id: true, 
          name: true, 
          category: true, // 🚀 ADDED Category
          isActive: true,
          isMandatory: true,
          validationRegex: true, 
          placeholder: true, 
          country: true,
          creator: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
          updater: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
        },
        relations: ['creator', 'creator.role', 'updater', 'updater.role'],
        order: { name: 'ASC' },
      });

      if (docs.length === 0 && onlyActive) {
        this.logger.warn('[DOCUMENT_TYPE_EMPTY]: No active document types found.');
      }

      return {
        success: true,
        statusCode: 200,
        message: `Successfully retrieved ${docs.length} document types.`,
        total: docs.length,
        data: docs,
      };
    } catch (error) {
      this.logger.error(`[DOCUMENT_TYPE_FETCH_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Unable to load document requirements.');
    }
  }

  /**
   * FIND ONE
   */
  async findOne(id: string) {
    try {
      if (!id) throw new BadRequestException('Identifier Error: Document ID is required.');

      const docId = id.toUpperCase().trim();

      const doc = await this.docRepo.findOne({
        where: { id: docId },
        select: {
          id: true,
          name: true,
          category: true, // 🚀 ADDED Category
          isActive: true,
          isMandatory: true,
          validationRegex: true,
          placeholder: true,
          country: true,
          createdAt: true,
          updatedAt: true,
          creator: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
          updater: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
        },
        relations: ['creator', 'creator.role', 'updater', 'updater.role'],
      });

      if (!doc) {
        throw new NotFoundException(`Lookup Error: Document Type '${docId}' not found.`);
      }

      return {
        success: true,
        statusCode: 200,
        data: doc,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[DOCUMENT_TYPE_FETCH_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException(`Could not retrieve details for '${id}'.`);
    }
  }
}