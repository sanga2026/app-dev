import {
  Controller, Post, Patch, Delete, Body, Param, Get, Query,
  UseGuards, Logger, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocumentTypeService } from './document-types.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../access-control/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
  UpdateDocumentStatusDto,
} from './dto/document-type.dto';

@ApiTags('Master Data — Document Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('master-data/document-types')
export class DocumentTypeController {
  private readonly logger = new Logger(DocumentTypeController.name);

  constructor(private readonly docService: DocumentTypeService) {}

  @Post()
  @RequirePermissions('master-data', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a global document type (Super Admin only)' })
  async create(@Body() dto: CreateDocumentTypeDto, @CurrentUser() user: UserEntity) {
    this.logger.log(`[MASTER_DATA_CREATE] '${dto.id}' by ${user.email}`);
    return await this.docService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('master-data', 'update')
  @ApiOperation({ summary: 'Update a document type' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTypeDto,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.docService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('master-data', 'update')
  @ApiOperation({ summary: 'Toggle document type active status' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentStatusDto,
    @CurrentUser() user: UserEntity,
  ) {
    return await this.docService.toggleStatus(id, dto.isActive, user);
  }

  @Post('sync')
  @RequirePermissions('master-data', 'update')
  @ApiOperation({ summary: 'Force refresh of in-memory document registry' })
  async syncCache(@CurrentUser() user: UserEntity) {
    await this.docService.refreshCache();
    return { success: true, message: 'Document registry synchronised.' };
  }

  @Get()
  @RequirePermissions('master-data', 'read')
  @ApiOperation({ summary: 'List all document types' })
  async getAll(@Query('active') active?: string) {
    const onlyActive = active !== 'false';
    return await this.docService.findAll(onlyActive);
  }

  @Get(':id')
  @RequirePermissions('master-data', 'read')
  @ApiOperation({ summary: 'Get a single document type' })
  async getOne(@Param('id') id: string) {
    return await this.docService.findOne(id);
  }

  @Delete(':id')
  @RequirePermissions('master-data', 'delete')
  @ApiOperation({ summary: 'Delete a document type' })
  async remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    return await this.docService.remove(id, user);
  }
}
