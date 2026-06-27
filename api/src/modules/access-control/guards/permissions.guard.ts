// src/modules/access-control/guards/permissions.guard.ts

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/user-role.enum'; // 🛡️ Source of truth

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 1. 🛑 IDENTITY CHECK: Ensure the JwtAuthGuard has attached a user
    if (!user) {
      this.logger.error(`Security Alert: Attempted access to ${request.url} without authentication.`);
      throw new UnauthorizedException('Authentication required to verify permissions.');
    }

    // 2. 🛡️ JWT & NESTED ROLE EXTRACTION
    const roleSlug = user.roleType || user.role?.slug;

    // 3. 🛡️ THE SUPER_ADMIN BYPASS
    // Platform Owners ignore granular checks to prevent accidental system lockout.
    // if (roleSlug === UserRole.SUPER_ADMIN) {
    //   return true;
    // }

    // 🛑 PERMISSIONS CHECK: Ensure the user actually has a hydrated permissions object
    if (!user.role || !user.role.permissions) {
      this.logger.warn(`Permission Denied: User ${user.email} lacks a populated permissions object.`);
      throw new ForbiddenException('Access Denied: Your account profile is missing assigned permissions.');
    }

    // 4. 🎯 IDENTIFY THE RESOURCE (Smart URL Extraction)
    const pathSegments = request.url.split('?')[0].split('/').filter(Boolean);
    let resource = '';

    // Safely skip global prefixes to find the actual module (e.g., 'users', 'banks')
    if (pathSegments[0] === 'api' && pathSegments[1] === 'v1') {
      resource = pathSegments[2]; 
    } else if (pathSegments[0] === 'v1' || pathSegments[0] === 'api') {
      resource = pathSegments[1]; 
    } else {
      resource = pathSegments[0]; 
    }

    // If the role doesn't have a defined permission block for this specific resource, fail safe.
    const resourcePerms = user.role.permissions[resource];
    
    if (!resourcePerms) {
      this.logger.warn(`[SECURITY] ${user.email} attempted to access restricted/undefined resource: ${resource}`);
      throw new ForbiddenException(`Access Violation: Your role does not grant access to the '${resource}' module.`);
    }

    // 5. 🛡️ DYNAMIC PERMISSION MAPPING (Action -> JSON Flag)
    const method = request.method;

    switch (method) {
      case 'GET':
        if (!resourcePerms.read) {
          throw new ForbiddenException(`Access Violation: You do not have permission to view ${resource}.`);
        }
        break;

      case 'POST':
        if (!resourcePerms.create) {
          throw new ForbiddenException(`Operation Blocked: Your role cannot create new ${resource}.`);
        }
        break;

      case 'PATCH':
      case 'PUT':
        if (!resourcePerms.update) {
          throw new ForbiddenException(`Update Denied: Insufficient privileges to modify ${resource}.`);
        }
        break;

      case 'DELETE':
        if (!resourcePerms.delete) {
          throw new ForbiddenException(`Critical Violation: Your role is not authorized to delete ${resource}.`);
        }
        break;

      default:
        // Safe default: Allow safe pre-flight requests like OPTIONS to pass
        return true;
    }

    // 6. 🟢 LOG SUCCESSFUL AUTH
    this.logger.verbose(`Permission Granted: ${user.email} (${roleSlug}) -> ${method} /${resource}`);
    return true;
  }
}