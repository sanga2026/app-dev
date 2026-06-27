import { 
  Controller, Post, Body, Get, Patch, Delete, Param, 
  Query, UseGuards, SetMetadata, Logger, ParseBoolPipe, ParseUUIDPipe,
  HttpCode, HttpStatus, BadRequestException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from '../users/entities/user.entity';
import { LoanProductService } from './loan-product.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) // 🛡️ Triple-Lock Security
@Controller('banks/:bankId/loans')
export class LoanProductController {
  private readonly logger = new Logger(LoanProductController.name);

  constructor(private readonly loanProductService: LoanProductService) {}

  /**
   * 📝 CREATE LOAN PRODUCT
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async createLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity
  ) {
    this.logger.log(`[LOAN_CREATE] Initiated for Bank UUID: ${bankId} by ${user.email}`);
    
    // Pass the URL bankId to guarantee tenant isolation
    return await this.loanProductService.createProduct(bankId, dto, user);
  }

  /**
   * 📊 LIST PAGINATED LOANS
   */
  @Get()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.STAFF])
  async getLoans(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @CurrentUser() user: UserEntity,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
    @Query('search') search?: string,
    @Query('onlyActive') onlyActive?: string
  ) {
    // Note: If you want ONLY loans to show up, you should update the service 
    // to filter by `productType: IN ['PERSONAL', 'HOME', 'AUTO', ...]`
    const isActive = onlyActive === 'true' ? true : false;
    return await this.loanProductService.getProductsByBank(bankId, isActive, user); 
  }

  /**
   * 🔍 GET SINGLE LOAN
   */
  @Get(':loanId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.STAFF])
  async getLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @CurrentUser() user: UserEntity
  ) {
    return await this.loanProductService.getProduct(loanId, user);
  }

  /**
   * ✏️ UPDATE LOAN CONFIGURATIONS
   */
  @Patch(':loanId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async updateLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity
  ) {
    if (Object.keys(dto).length === 0) throw new BadRequestException('Request body empty.');

    // 🛡️ Security Guard: Prevent modification of core identifiers
    const restricted = ['slug', 'productCode', 'bankId', 'id'];
    restricted.forEach(key => delete dto[key]);

    return await this.loanProductService.updateProduct(loanId, dto, user);
  }

  /**
   * 🛑 TOGGLE STATUS
   */
  @Patch(':loanId/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async toggleStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity
  ) {
    return await this.loanProductService.toggleProductStatus(loanId, isActive, user);
  }

  /**
   * 🗑️ DELETE LOAN PRODUCT
   */
  @Delete(':loanId')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async deleteLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @CurrentUser() user: UserEntity
  ) {
    return await this.loanProductService.deleteProduct(loanId, user);
  }
}