import { 
  Controller, Post, Patch, Body, Param, Get, Query, 
  UseGuards, SetMetadata, Logger, 
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { DocumentTypeService } from './document-types.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { UserRole } from '../access-control/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';

// 🚀 IMPORT DTOs
import { 
  CreateDocumentTypeDto, 
  UpdateDocumentTypeDto, 
  UpdateDocumentStatusDto 
} from './dto/document-type.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) 
@Controller('master-data/document-types')
export class DocumentTypeController {
  private readonly logger = new Logger(DocumentTypeController.name);

  constructor(private readonly docService: DocumentTypeService) {}

  /**
   * CREATE: Global Document Type
   * Restricted: Platform Owners only.
   */
  @Post()
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDocumentTypeDto, // 🚀 Fully validated
    @CurrentUser() user: UserEntity 
  ) {
    // Manual validation removed; class-validator handles this now!
    this.logger.log(`[MASTER_DATA_CREATE] New document '${dto.id}' initiated by SuperAdmin: ${user.email}`);
    
    return await this.docService.create(dto, user);
  }

  /**
   * UPDATE: Modify Global Document Logic
   * Restricted: SUPER_ADMIN only.
   */
  @Patch(':id')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  async update(
    @Param('id') id: string, 
    @Body() dto: UpdateDocumentTypeDto, // 🚀 Fully validated (ID modification blocked)
    @CurrentUser() user: UserEntity 
  ) {
    // Primary Key modification check removed; the DTO strictly omits the 'id' field!
    this.logger.warn(`[MASTER_DATA_UPDATE] SuperAdmin ${user.email} is modifying global document: ${id}`);
    
    return await this.docService.update(id, dto, user);
  }

  /**
   * TOGGLE STATUS
   * logic: Deactivating a document type (e.g., stopping 'VOTER_ID' support platform-wide).
   */
  @Patch(':id/status')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  async toggleStatus(
    @Param('id') id: string, 
    @Body() dto: UpdateDocumentStatusDto, // 🚀 Validated boolean payload
    @CurrentUser() user: UserEntity 
  ) {
    this.logger.warn(`[MASTER_DATA_STATUS] Global Document ${id} set to ${dto.isActive} by ${user.email}`);
    
    return await this.docService.toggleStatus(id, dto.isActive, user);
  }

  /**
   * MANUAL CACHE SYNC
   * logic: Forces the in-memory Document Registry to reload from the Database.
   */
  @Post('sync')
  @SetMetadata('roles', [UserRole.SUPER_ADMIN])
  async syncCache(@CurrentUser() user: UserEntity) {
    this.logger.log(`[CACHE_SYNC] Document Registry refresh triggered by ${user.email}`);
    await this.docService.refreshCache();
    
    return { 
      success: true, 
      message: "Global document registry synchronized with Database." 
    };
  }

  /**
   * LIST ALL: Public for all authenticated users
   * logic: Bank staff need this for KYC dropdowns.
   */
  @Get()
  async getAll(@Query('active') active?: string) {
    const onlyActive = active !== 'false'; // Defaults to true
    return await this.docService.findAll(onlyActive);
  }

  /**
   * GET ONE: Public for all authenticated users
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return await this.docService.findOne(id);
  }
}