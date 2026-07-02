import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '../../modules/access-control/entities/role.entity';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

export const RequirePermissions = (resource: string, action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, { resource, action });
