import { 
  Body, Controller, Post, Get, Query, BadRequestException, 
  Patch, Param, ParseBoolPipe, UseGuards, SetMetadata, Logger, 
  HttpStatus,
  HttpCode,
  ForbiddenException
} from "@nestjs/common";
import { NumberRangeService } from "./number-range.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { UserRole } from '../access-control/enums/user-role.enum';
import { UserEntity } from "../users/entities/user.entity";

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('number-ranges')
export class NumberRangeController {
  private readonly logger = new Logger(NumberRangeController.name);

  constructor(private readonly nrService: NumberRangeService) {}

  /**
   * GENERATE NEXT ID
   * Use Case: Called internally by Customer/Account services during onboarding.
   * Security: Automatically scopes to the authenticated user's Bank ID.
   */
  @Get('next')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN, UserRole.STAFF])
@Get('next')
async getNext(
  @Query('type') type: string, 
  @Query('bankId') queryBankId: string, // 👈 New: Accept bankId from URL
  @CurrentUser() user: UserEntity
) {
  // 1. Basic Type Validation
  if (!type) {
    throw new BadRequestException('Sequence Error: The type (e.g., CUSTOMER, LOAN) is mandatory.');
  }

  // 2. Logic to determine the Target Bank ID
  let targetBankId: string | null = user.bankId;

  // 🛡️ If the user is a Super Admin, prioritize the ID from the URL
  if (user.role?.role === UserRole.SUPER_ADMIN) {
    targetBankId = queryBankId || user.bankId;
  }

  // 3. Final Guard: If still no bankId, explain why
  if (!targetBankId || targetBankId === 'null') {
    const message = user.role?.role === UserRole.SUPER_ADMIN
      ? 'Super Admin Action Required: Please provide a ?bankId=... in the URL to target a specific institution.'
      : 'Operational Error: Your account is not linked to a Bank context.';
    
    throw new BadRequestException(message);
  }

  // 4. At this point, targetBankId is guaranteed to be a string
  const nextId = await this.nrService.getNextNumber(targetBankId, type);

  return { 
    success: true,
    data: {
      type: type.toUpperCase(),
      bankId: targetBankId, // Return this so the UI knows which bank was used
      nextId 
    }
  };
}

  /**
   * LIST ALL SEQUENCES
   * logic: Bank Admins see their own ranges; Super Admins see all.
   */
  @Get()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async findAll(@CurrentUser() user: UserEntity) {
    this.logger.log(`[SEQUENCE_LIST] Fetching ranges for Bank UUID: ${user.bankId ?? 'ALL'}`);
    return await this.nrService.findAllByBank(user);
  }

  /**
   * GET SPECIFIC SEQUENCE
   * logic: Fetches details like currentNumber, prefix, and padding.
   */
  @Get(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async findOne(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return await this.nrService.findOne(id, user);
  }

  /**
   * CREATE SEQUENCE
   * logic: Initializes a new number range (e.g., setting up 'INVOICE' sequence for HDFC).
   */
  @Post()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: any, @CurrentUser() user: UserEntity) {
    // 🛡️ TENANT ENFORCEMENT
    if (user.role?.role !== UserRole.SUPER_ADMIN) {
      dto.bankId = user.bankId; 
    }

    if (!dto.bankId) throw new BadRequestException('Target Bank ID is required.');
    if (!dto.type ) throw new BadRequestException('Sequence type is mandatory.');

    this.logger.log(`[SEQUENCE_INIT] ${user.email} creating range: ${dto.type} for Bank: ${dto.bankId}`);
    
    return await this.nrService.create(dto, user);
  }

  /**
   * UPDATE RANGE METADATA
   * logic: Modify padding, separator, or metadata. 
   * Security: Service must prevent changing 'type' once numbers are issued.
   */
  @Patch(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async update(
    @Param('id') id: string, 
    @Body() dto: any,
    @CurrentUser() user: UserEntity
  ) {
    this.logger.log(`[SEQUENCE_UPDATE] ${user.email} modifying range: ${id}`);
    return await this.nrService.update(id, dto, user);
  }

  /**
   * TOGGLE STATUS
   * logic: Suspending a range prevents further ID generation.
   */
  @Patch(':id/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN, UserRole.BANK_ADMIN])
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @CurrentUser() user: UserEntity
  ) {
    this.logger.warn(`[SEQUENCE_STATUS] Range ${id} visibility set to ${isActive} by ${user.email}`);
    return await this.nrService.toggleStatus(id, isActive, user);
  }
}