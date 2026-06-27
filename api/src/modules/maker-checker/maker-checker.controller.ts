// --- 1. EXTERNAL IMPORTS ---
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Logger,
  ParseUUIDPipe,
  Patch,
  BadRequestException,
  Req,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MakerCheckerService } from './maker-checker.service';
import { LoanApplicationEntity } from '../loans/entities/application.entity';

// --- 2. THE MAKER/CHECKER GATEWAY ---
// This controller manages the lifecycle of operational drafts.
// Principle: Security-First, Auditable Workflow.
@Controller('maker-checker')
export class MakerCheckerController {
  // <--- CRITICAL: 'export' keyword fixes TS2305
private readonly logger = new Logger(MakerCheckerController.name);

constructor(private readonly makerCheckerService: MakerCheckerService) {}

  // --- 3. CREATE NEW REQUEST ---
  // Note: While the Onboarding Controller calls the Service directly for speed,
  // this endpoint allows for direct manual creation if needed.
@Post('create')
  async create(@Body() createDto: any) {
    try {
      return await this.makerCheckerService.createRequest(createDto.entityName, {
        ...createDto.data,
        notes: createDto.notes,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

@Patch('approve/:id')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return await this.makerCheckerService.approveRequest(id, body);
  }

  @Patch('reject/:id')
  async reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: { reason: string }) {
    return await this.makerCheckerService.rejectRequest(id, body.reason);
  }

  @Patch('disburse/:id')
  async disburse(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return await this.makerCheckerService.disburseRequest(id, body);
  }

  // --- 4. GET PENDING REQUESTS ---
  // Used by the 'Checker' (Supervisor) to see what needs approval.
// --- 1. GET PENDING REQUESTS ---
  // LOGIC: Filtered by the Supervisor's Bank ID to ensure multi-tenant security.
  @Get('pending')
  async getPendingRequests(@Req() req: any) {
    try {
      const bankId = req.user?.bankId; // Extracted from Auth Middleware
      this.logger.log(`Fetching pending review list for Bank: ${bankId}`);
      
      return await this.makerCheckerService.searchRequests(LoanApplicationEntity, {
        status: 'PENDING',
        bankId: bankId,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch pending requests.');
    }
  }

  // --- 2. GET SPECIFIC REQUEST ---
  // LOGIC: Provides full detail of a loan application for the Checker to review.
  @Get(':id')
  async getRequestById(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const bankId = req.user?.bankId;
    const request = await this.makerCheckerService.getLoanDetail(id, bankId);
    
    if (!request) {
      throw new NotFoundException(`Request with ID ${id} not found.`);
    }
    return request;
  }

  
}
