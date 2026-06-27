import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LoanProductEntity } from './entities/loan-product.entity'; // Adjust this path if needed
import { UserEntity } from '../users/entities/user.entity';         // Adjust this path if needed
import { UserRole } from '../access-control/enums/user-role.enum';  // Adjust this path if needed
import { getErrorMessage } from '../../common/utils/error-handler.util';

@Injectable()
export class LoanProductService {
  private readonly logger = new Logger(LoanProductService.name);

  constructor(
    @InjectRepository(LoanProductEntity)
    private readonly productRepo: Repository<LoanProductEntity>,
  ) {}

  // ====================================================================
  // 🛡️ INTERNAL UTILITIES
  // ====================================================================

  /**
   * Hybrid Lookup & Tenant Guard
   * Resolves products by either UUID or Slug, and mathematically guarantees
   * that users can only fetch products belonging to their specific tenant.
   */
  private async getProductWithIsolation(identifier: string, user: UserEntity): Promise<LoanProductEntity> {
    const isSuperAdmin = user.role?.role === UserRole.SUPER_ADMIN;
    
    // Determine if the identifier is a UUID or a Slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const whereClause: any = isUuid ? { id: identifier } : { slug: identifier };

    // 🔒 Enforce DB-Level Tenant Isolation
    if (!isSuperAdmin) {
      whereClause.bankId = user.bankId;
    }

    const product = await this.productRepo.findOne({ where: whereClause });

    if (!product) {
      throw new NotFoundException(`Product '${identifier}' not found or access denied.`);
    }

    return product;
  }

  /**
   * Slug Generator
   * Creates URL-friendly slugs from product names.
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/(^-|-$)+/g, '');   // Remove leading/trailing hyphens
  }

  // ====================================================================
  // 🚀 PUBLIC CONTROLLER METHODS
  // ====================================================================

  /**
   * 📝 CREATE PRODUCT
   */
  async createProduct(bankId: string, dto: any, user: UserEntity) {
    try {

      // 2. Uniqueness Check (Per Bank)
      // Using an array of objects acts as an OR statement in TypeORM
      const existing = await this.productRepo.findOne({
        where: [
          { bankId, productCode: dto.productCode },
          { bankId }
        ]
      });
  this.logger.log(`[PRODUCT_CREATED] ${existing ? 'Duplicate found for Code or Slug' : 'No duplicates, proceeding with creation'} for Bank UUID: ${bankId} ${dto.productCode}`);
      if (existing) {
        throw new ConflictException(`A product with this Code or Slug already exists for this bank.`);
      }

      // 3. Create & Save
      const product = this.productRepo.create({
        ...dto,
        bankId,
      });

      const savedProduct = await this.productRepo.save(product) as unknown as LoanProductEntity;
      this.logger.log(`[PRODUCT_CREATED] ${savedProduct.productCode} mapped to Bank: ${bankId}`);
      
      return {
        success: true,
        message: 'Product successfully provisioned.',
        data: savedProduct
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[PRODUCT_CREATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to create the financial product.');
    }
  }

  /**
   * ✏️ UPDATE PRODUCT
   */
  async updateProduct(identifier: string, dto: any, user: UserEntity) {
    try {
      // 1. Fetch with Isolation Guard
      const product = await this.getProductWithIsolation(identifier, user);

      // 2. Merge incoming updates
      Object.assign(product, dto);

      // 3. Save to database
      const updatedProduct = await this.productRepo.save(product);
      
      return {
        success: true,
        message: 'Product configurations updated.',
        data: updatedProduct
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[PRODUCT_UPDATE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to update product details.');
    }
  }

  /**
   * 🛑 TOGGLE PRODUCT STATUS
   */
  async toggleProductStatus(identifier: string, isActive: boolean, user: UserEntity) {
    try {
      const product = await this.getProductWithIsolation(identifier, user);
      
      product.isActive = isActive;
      await this.productRepo.save(product);

      return {
        success: true,
        message: `Product is now ${isActive ? 'Operational' : 'Disabled'}.`,
        data: { id: product.id, isActive: product.isActive }
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[PRODUCT_STATUS_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to toggle product status.');
    }
  }

  /**
   * 📊 GET PRODUCTS BY BANK
   */
  async getProductsByBank(targetBankId: string | null, onlyActive: boolean, user: UserEntity) {
    try {
      const whereClause: any = {};

      // Apply Bank Filter if explicitly required
      if (targetBankId) {
        whereClause.bankId = targetBankId;
      }

      // Apply Status Filter
      if (onlyActive) {
        whereClause.isActive = true;
      }

      const [products, total] = await this.productRepo.findAndCount({
        where: whereClause,
        order: { productName: 'ASC' }
      });

      return {
        success: true,
        total,
        data: products
      };

    } catch (error) {
      this.logger.error(`[PRODUCT_FETCH_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve product directory.');
    }
  }

  /**
   * 🔍 GET SINGLE PRODUCT
   */
  async getProduct(identifier: string, user: UserEntity) {
    try {
      const product = await this.getProductWithIsolation(identifier, user);
      
      return {
        success: true,
        data: product
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[PRODUCT_GET_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to fetch product details.');
    }
  }

  /**
   * 🗑️ DELETE PRODUCT
   */
  async deleteProduct(identifier: string, user: UserEntity) {
    try {
      // 1. Fetch with Isolation Guard (Guarantees they own the product before deleting)
      const product = await this.getProductWithIsolation(identifier, user);

      // 2. Delete the record
      await this.productRepo.remove(product);
      
      return {
        success: true,
        message: 'Financial product permanently deleted.'
      };

    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`[PRODUCT_DELETE_ERROR]: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to delete the product.');
    }
  }
}