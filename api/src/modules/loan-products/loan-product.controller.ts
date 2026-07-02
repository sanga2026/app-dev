import {
  Controller, Post, Body, Get, Patch, Delete, Param,
  Query, UseGuards, Logger, ParseBoolPipe, ParseUUIDPipe,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { LoanProductService } from './loan-product.service';

@ApiTags('Loan Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('banks/:bankId/loans')
export class LoanProductController {
  private readonly logger = new Logger(LoanProductController.name);

  constructor(private readonly loanProductService: LoanProductService) {}

  @Post()
  @RequirePermissions('loan-products', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.loanProductService.createProduct(bankId, dto, user);
  }

  @Get()
  @RequirePermissions('loan-products', 'read')
  async getLoans(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @CurrentUser() user: UserEntity,
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
    @Query('search') search?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    const isActive = onlyActive === 'true';
    return await this.loanProductService.getProductsByBank(bankId, isActive, user);
  }

  @Get(':loanId')
  @RequirePermissions('loan-products', 'read')
  async getLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.loanProductService.getProduct(loanId, user);
  }

  @Patch(':loanId')
  @RequirePermissions('loan-products', 'update')
  async updateLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: any,
    @CurrentUser() user: UserEntity,
  ) {
    if (Object.keys(dto).length === 0) throw new BadRequestException('Request body empty.');
    (['slug', 'productCode', 'bankId', 'id'] as string[]).forEach(k => delete dto[k]);
    return await this.loanProductService.updateProduct(loanId, dto, user);
  }

  @Patch(':loanId/status')
  @RequirePermissions('loan-products', 'update')
  async toggleStatus(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.loanProductService.toggleProductStatus(loanId, isActive, user);
  }

  @Delete(':loanId')
  @RequirePermissions('loan-products', 'delete')
  async deleteLoan(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.loanProductService.deleteProduct(loanId, user);
  }
}
