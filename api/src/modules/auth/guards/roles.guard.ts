// src/modules/auth/guards/roles.guard.ts

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../access-control/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Extract metadata from @SetMetadata('roles', [...])
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are defined on the route, allow access (Public or handled by PermissionsGuard only)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 2. 🛑 IDENTITY CHECK: Ensure JwtAuthGuard ran first
    if (!user) {
      this.logger.error(`RolesGuard failed: No user found on request for ${request.url}. Ensure JwtAuthGuard is used.`);
      throw new UnauthorizedException('Authentication context missing.');
    }

    // 3. 🛡️ SLUG EXTRACTION
    // We normalize to UpperCase to ensure it matches our Enum 'SUPER_ADMIN', 'BANK_ADMIN', etc.
    const rawRole = user.roleType || user.role?.slug;
    
    const userRoleSlug = rawRole?.toUpperCase();

    // 4. 🛡️ ROLE COMPARISON
    const hasRole = requiredRoles.includes(userRoleSlug as UserRole);

    if (!hasRole) {
      this.logger.warn(
        `[SECURITY] Access Denied for ${user.email}. Role Found: ${userRoleSlug || 'NONE'}, Required: ${requiredRoles.join(', ')}`
      );
      
      throw new ForbiddenException(
        `Access Denied: Your assigned role (${userRoleSlug || 'Unassigned'}) does not have the structural authority to access this resource.`
      );
    }

    // 5. 🟢 SUCCESS LOG
    this.logger.verbose(`Role Verified: ${user.email} as ${userRoleSlug}`);
    return true;
  }
}