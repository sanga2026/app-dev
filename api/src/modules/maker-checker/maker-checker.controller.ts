import {
  Controller, Post, Body, Param, Get, Patch, Delete,
  UseGuards, ParseUUIDPipe, Req, BadRequestException,
  InternalServerErrorException, NotFoundException, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { MakerCheckerService } from './maker-checker.service';
import { LoanApplicationEntity } from '../loans/entities/application.entity';

@ApiTags('Maker-Checker Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('maker-checker')
export class MakerCheckerController {
  private readonly logger = new Logger(MakerCheckerController.name);

  constructor(private readonly makerCheckerService: MakerCheckerService) {}

  @Post('create')
  @RequirePermissions('loans', 'create')
  @ApiOperation({ summary: 'Create a new loan application (Maker)' })
  async create(@Body() createDto: any, @CurrentUser() user: UserEntity) {
    try {
      return await this.makerCheckerService.createRequest(createDto.entityName, {
        ...createDto.data,
        notes: createDto.notes,
        makerId: user.id,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Patch('approve/:id')
  @RequirePermissions('loans', 'approve')
  @ApiOperation({ summary: 'Approve a pending loan application (Checker)' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.makerCheckerService.approveRequest(id, { ...body, checkerId: user.id });
  }

  @Patch('reject/:id')
  @RequirePermissions('loans', 'reject')
  @ApiOperation({ summary: 'Reject a pending loan application (Checker)' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: UserEntity,
  ) {
    return await this.makerCheckerService.rejectRequest(id, body.reason, user.id);
  }

  @Patch('disburse/:id')
  @RequirePermissions('loans', 'disburse')
  @ApiOperation({ summary: 'Disburse an approved loan (Finance)' })
  async disburse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.makerCheckerService.disburseRequest(id, { ...body, disbursedBy: user.id });
  }

  @Get('pending')
  @RequirePermissions('loans', 'read')
  @ApiOperation({ summary: 'List pending loan applications for checker review' })
  async getPendingRequests(@CurrentUser() user: UserEntity) {
    try {
      return await this.makerCheckerService.searchRequests(LoanApplicationEntity, {
        status: 'PENDING',
        bankId: user.bankId ?? '',
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch pending requests.');
    }
  }

  @Get(':id')
  @RequirePermissions('loans', 'read')
  @ApiOperation({ summary: 'Get loan application detail' })
  async getRequestById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserEntity,
  ) {
    const request = await this.makerCheckerService.getLoanDetail(id, user.bankId ?? '');
    if (!request) throw new NotFoundException(`Request ${id} not found.`);
    return request;
  }
}
