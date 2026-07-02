import {
  Controller, Post, Body, Get, Query,
  UseGuards, Logger, InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserEntity } from '../../users/entities/user.entity';
import { MakerCheckerService } from '../../maker-checker/maker-checker.service';
import { LoanApplicationEntity } from '../entities/application.entity';
import { SearchLoanDto } from '../dto/search-loan.dto';
import { getErrorMessage } from '../../../common/utils/error-handler.util';

@ApiTags('Loan Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('loans/onboarding')
export class LoanOnboardingController {
  private readonly logger = new Logger(LoanOnboardingController.name);

  constructor(private readonly makerCheckerService: MakerCheckerService) {}

  @Post('initiate')
  @RequirePermissions('loans', 'create')
  @ApiOperation({ summary: 'Initiate a new loan application' })
  async initiateLoan(@Body() loanApplicationDto: any, @CurrentUser() user: UserEntity) {
    try {
      this.logger.log(`Initiating loan by ${user.email} at Branch: ${loanApplicationDto.branchId}`);
      return await this.makerCheckerService.createRequest(LoanApplicationEntity, {
        ...loanApplicationDto,
        makerId: user.id,
        bankId: loanApplicationDto.bankId ?? user.bankId,
        notes: loanApplicationDto.notes ?? `Initiated: ${loanApplicationDto.loanType}`,
      });
    } catch (error) {
      this.logger.error(`Failed to initiate loan: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException(getErrorMessage(error));
    }
  }

  @Get('search')
  @RequirePermissions('loans', 'read')
  @ApiOperation({ summary: 'Search loan applications' })
  async searchLoans(@Query() filters: SearchLoanDto, @CurrentUser() user: UserEntity) {
    // Scope search to user's bank automatically
    const scopedFilters = {
      ...filters,
      ...(user.bankId ? { bankId: user.bankId } : {}),
    };
    return await this.makerCheckerService.searchRequests(LoanApplicationEntity, scopedFilters);
  }

  @Get('stats')
  @RequirePermissions('loans', 'read')
  @ApiOperation({ summary: 'Get loan portfolio statistics' })
  async getLoanStats(@CurrentUser() user: UserEntity) {
    return await this.makerCheckerService.getVaultStats(LoanApplicationEntity);
  }
}
