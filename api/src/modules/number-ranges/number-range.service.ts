import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  HttpException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NumberRangeEntity } from './entities/number-range.entity';
import { BankService } from '../banks/banks.service';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { get } from 'http';
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class NumberRangeService {
  private readonly logger = new Logger(NumberRangeService.name);

  constructor(
    @InjectRepository(NumberRangeEntity)
    private readonly nrRepo: Repository<NumberRangeEntity>,
    private readonly dataSource: DataSource,
    private readonly banksService: BankService,
  ) {}

  /**
   * CREATE: Initializes a new sequence
   * Logic: Handles optional prefix/metadata gracefully.
   */
  async create(dto: any, user: UserEntity) {
    try {
      const targetBankId =
        user.role?.role === UserRole.SUPER_ADMIN ? dto.bankId : user.bankId;

      if (!targetBankId) {
        throw new BadRequestException(
          'Institutional Error: Target Bank ID is required for sequence initialization.',
        );
      }

      const bankResult = await this.banksService.findOne(targetBankId);
      const bank = bankResult?.data;

      if (!bank || !bank.isActive) {
        throw new BadRequestException(
          `Compliance Block: Target Bank is either missing or inactive.`,
        );
      }

      if (!dto.type)
        throw new BadRequestException(
          'Configuration Error: Sequence "type" is mandatory.',
        );
      const type = dto.type.toUpperCase().trim();

      const existing = await this.nrRepo.findOne({
        where: { bankId: bank.id, type },
      });
      if (existing) {
        throw new ConflictException(
          `Configuration Conflict: Sequence '${type}' already exists for ${bank.name}.`,
        );
      }

      // 🛡️ OPTIONAL FIELD HANDLING
      const range = this.nrRepo.create({
        ...dto,
        bankId: bank.id,
        type,
        currentNumber: dto.startNumber ?? 1000,
        prefix: dto.prefix?.toUpperCase().trim() || null, // Optional
        padding: dto.padding ?? 6,
        isActive: true,
        isExhausted: false,
        metadata: dto.metadata || {}, // Optional
        createdBy: user.id,
        updatedBy: user.id,
      });

      const savedRange = await this.nrRepo.save(range);

      // 3. 🚀 Manual Mapping (In-Memory)
      // We attach only the specific fields required for the Audit Trail
      const auditData = {
        firstName: user.firstName,
        lastName: user.lastName,
        role: {
          name: user.role?.name || 'User',
        },
      };

      // 4. Return the merged object
      return {
        success: true,
        message: `Sequence '${dto.type}' initialized successfully.`,
        data: {
          ...savedRange,
          creator: auditData,
          updater: auditData,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Technical Failure: Unable to setup number range.',
      );
    }
  }

  /**
   * GET NEXT NUMBER: Atomic sequence generator
   * Logic: Gracefully handles missing prefixes and metadata separators.
   */
  async getNextNumber(bankIdentifier: string, type: string): Promise<string> {
    try {
      // 🛡️ 1. Validation: Prevent 'null' from entering the flow
      if (!bankIdentifier || bankIdentifier === 'null') {
        throw new BadRequestException(
          'Sequence Generation Error: Bank identifier is missing or invalid.',
        );
      }

      if (!type) {
        throw new BadRequestException(
          'Sequence Generation Error: Sequence type is required.',
        );
      }

      // 2. Fetch Bank Details (Uses our safe findOne)
      const bankResult = await this.banksService.findOne(bankIdentifier);
      const bank = bankResult.data;

      // 3. Start Transaction
      return await this.dataSource.transaction(async (manager) => {
        const normalizedType = type.toUpperCase().trim();

        // 4. Fetch Range with Pessimistic Lock (Prevents double-counting)
        const range = await manager.findOne(NumberRangeEntity, {
          where: { bankId: bank.id, type: normalizedType, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });

        if (!range) {
          throw new NotFoundException(
            `No active sequence found for type '${normalizedType}' in ${bank.name}.`,
          );
        }

        if (range.isExhausted) {
          throw new BadRequestException(
            `Sequence '${normalizedType}' has been exhausted.`,
          );
        }

        // 5. Increment and Boundary Logic
        const nextVal = (range.currentNumber || 0) + 1;

        if (nextVal > range.endNumber) {
          range.isExhausted = true;
          range.isActive = false;
          await manager.save(range);
          throw new BadRequestException(
            `Limit reached for ${normalizedType}. Please extend the range in settings.`,
          );
        }

        // 6. Persist Update
        range.currentNumber = nextVal;
        await manager.save(range);

        // 7. Format Result
        const paddedNumber = nextVal
          .toString()
          .padStart(range.padding ?? 0, '0');

        if (!range.prefix) return paddedNumber;

        const metadata = (range.metadata || {}) as any;
        const separator = metadata.separator || '';

        return `${range.prefix}${separator}${paddedNumber}`;
      });
    } catch (error) {
      // 🛡️ 8. Exception Handling
      // If it's a NestJS error (400, 404), re-throw it directly
      if (error instanceof HttpException) {
        throw error;
      }

      // 🚨 Log technical failures (e.g., DB Lock Timeout)
      this.logger.error(
        `[SEQUENCE_GENERATION_FAILED]: Type: ${type}, Bank: ${bankIdentifier}. Reason: ${getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Return a clean error to the Banking OS UI
      throw new InternalServerErrorException(
        `Technical Failure: Could not generate the next sequence number for ${type}.`,
      );
    }
  }

  /**
   * FIND ONE: Security-scoped lookup
   */
  async findOne(idOrType: string, user: UserEntity) {
    // 1. Guard against empty input
    if (!idOrType) {
      throw new BadRequestException(
        'Sequence identifier (ID or Type) is required.',
      );
    }

    // 2. Identify if it's a UUID
    const isUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        idOrType,
      );

    // 3. Safe normalization
    const whereClause: any = isUuid
      ? { id: idOrType }
      : {
          type: idOrType?.toUpperCase()?.trim(),
          bankId: user?.bankId,
        };

    try {
      const range = await this.nrRepo.findOne({
        where: whereClause,
        // 🛡️ Explicitly select fields to keep the response light
        select: {
          id: true,
          type: true,
          prefix: true,
          separator: true,
          startNumber: true,
          currentNumber: true,
          endNumber: true,
          padding: true,
          isActive: true,
          isExhausted: true,
          metadata: true,
          bankId: true,
          createdAt: true,
          updatedAt: true,
          // Select specific fields for the updater
          updater: {
            firstName: true,
            lastName: true,
            role: {
              name: true,
            },
          },
          creator: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
        },
        // 🔗 Enable relations for the updater and their nested role
        relations: ['creator', 'creator.role', 'updater', 'updater.role'],
      });

      // 4. Handle Missing Records
      if (!range) {
        throw new NotFoundException(
          `Sequence identifier '${idOrType}' was not found.`,
        );
      }

      // 5. Security Check
      const isSuperAdmin = user.role?.role === UserRole.SUPER_ADMIN;
      if (!isSuperAdmin && range.bankId !== user.bankId) {
        throw new ForbiddenException('Security Violation: Access denied.');
      }

      return { success: true, data: range };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `[NUMBER_RANGE_FETCH_ERROR]: ${getErrorMessage(error)}`,
      );
      throw new InternalServerErrorException('An unexpected error occurred.');
    }
  }

  /**
   * UPDATE: Metadata updates
   */
  async update(id: string, dto: any, user: UserEntity) {
    const result = await this.findOne(id, user);
    const range = result.data;

    if (
      dto.currentNumber !== undefined &&
      dto.currentNumber < range.currentNumber
    ) {
      throw new BadRequestException(
        `Audit Conflict: Counter cannot move backwards.`,
      );
    }

    // Merge metadata safely to prevent overwriting other keys
    const updatedMetadata = dto.metadata
      ? { ...(range.metadata || {}), ...dto.metadata }
      : range.metadata;

    const updated = this.nrRepo.merge(range, {
      ...dto,
      metadata: updatedMetadata,
      updatedBy: user.id,
      updatedAt: new Date(),
    });

    return {
      success: true,
      message: 'Updated.',
      data: await this.nrRepo.save(updated),
    };
  }

  /**
   * TOGGLE STATUS
   */
  async toggleStatus(id: string, isActive: boolean, user: UserEntity) {
    try {
      // 1. Reuse findOne for existence and permission checks
      const result = await this.findOne(id, user);
      const range = result.data;

      // 2. Update state
      range.isActive = isActive;
      range.updatedBy = user.id;
      range.updatedAt = new Date();

      // 3. Logic for exhausted sequences
      if (isActive && range.isExhausted) {
        range.isExhausted = false;
        this.logger.log(
          `[SEQUENCE_REACTIVATED]: ${range.type} manually reset by ${user.email}`,
        );
      }

      // 4. Save changes
      await this.nrRepo.save(range);

      // 5. Minimalist Success Response
      return {
        success: true,
        message: `Sequence '${range.type}' is now ${isActive ? 'Active' : 'Inactive'}.`,
        data: {
          id: range.id,
          isActive: range.isActive,
        },
      };
    } catch (error) {
      // 🛡️ RE-THROW intentional NestJS exceptions (404, 403 from findOne)
      if (error instanceof HttpException) {
        throw error;
      }

      // 🚨 Log technical failures (DB connection, constraint violations)
      this.logger.error(
        `[TOGGLE_STATUS_FAILED]: ID: ${id}, Target: ${isActive}. Reason: ${getErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the sequence status.',
      );
    }
  }

  /**
   * FIND ALL
   */
  async findAllByBank(user: UserEntity) {
    try {
      // 1. Determine Scope: Super Admin sees all, others see only their bank
      const isSuperAdmin = user.role?.role === UserRole.SUPER_ADMIN;
      const targetBankId = isSuperAdmin ? undefined : user.bankId;

      // 2. Fetch with Selective Fields and Relations
      const ranges = await this.nrRepo.find({
        where: targetBankId ? { bankId: targetBankId } : {},
        select: {
          id: true,
          type: true,
          prefix: true,
          separator: true,
          currentNumber: true,
          isActive: true,
          isExhausted: true,
          updatedAt: true,
          bankId: true,
          // Only pull basic bank info to keep the list light
          bank: {
            name: true,
          },
          creator: {
            firstName: true,
            lastName: true,
            role: { name: true },
          },
          // Pull the last person who modified the range
          updater: {
            firstName: true,
            lastName: true,
            role: {
              name: true,
            },
          },
        },
        relations: [
          'bank',
          'updater',
          'updater.role',
          'creator',
          'creator.role',
        ],
        order: {
          bank: { name: 'ASC' }, // Group by bank name first
          type: 'ASC',
        },
      });

      return {
        success: true,
        total: ranges.length,
        data: ranges,
      };
    } catch (error) {
      this.logger.error(`[NUMBER_RANGE_LIST_ERROR]: ${getErrorMessage(error)}`);

      throw new InternalServerErrorException(
        'An unexpected error occurred while retrieving the number ranges.',
      );
    }
  }
}
