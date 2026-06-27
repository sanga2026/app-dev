import { Controller, Post, Body, Logger, Get, Query, UsePipes, ValidationPipe, InternalServerErrorException } from '@nestjs/common';
import { MakerCheckerService } from '../../maker-checker/maker-checker.service';
import { LoanApplicationEntity } from '../entities/application.entity';
import { SearchLoanDto } from '../dto/search-loan.dto';
import { getErrorMessage } from '../../../common/utils/error-handler.util';

@Controller('loans/onboarding')
export class LoanOnboardingController {
  private readonly logger = new Logger(LoanOnboardingController.name);

  constructor(private readonly makerCheckerService: MakerCheckerService) {}

  @Post('initiate')
  @UsePipes(new ValidationPipe({ transform: true }))
  async initiateLoan(@Body() loanApplicationDto: any) {
    try {
      this.logger.log(`Initiating loan for Customer: ${loanApplicationDto.governmentId} at Branch: ${loanApplicationDto.branchId}`);
      
      const payload = {
        ...loanApplicationDto,
        notes: loanApplicationDto.notes || `Initiated: ${loanApplicationDto.loanType} for ${loanApplicationDto.requestedAmount}`,
      };

      return await this.makerCheckerService.createRequest(
        LoanApplicationEntity,
        payload,
      );
    } catch (error) {
      this.logger.error(`Failed to initiate loan: ${getErrorMessage(error)}`);
      throw new InternalServerErrorException(getErrorMessage(error));
    }
  }

  @Get('search')
  async searchLoans(@Query() filters: SearchLoanDto) {
    return await this.makerCheckerService.searchRequests(LoanApplicationEntity, filters);
  }

  @Get('stats')
  async getLoanStats() {
    return await this.makerCheckerService.getVaultStats(LoanApplicationEntity);
  }
}