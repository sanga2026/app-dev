// src/common/decorators/require-permissions.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (resource: string, action: 'read' | 'create' | 'update' | 'delete') => 
  SetMetadata(PERMISSIONS_KEY, { resource, action });