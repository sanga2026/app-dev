import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../../../common/decorators/require-permissions.decorator';
import { UserRole } from '../enums/user-role.enum';
import { PermissionAction } from '../entities/role.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required to verify permissions.');
    }

    const roleSlug = user.roleType || user.role?.role;

    if (!user.role || !user.role.permissions) {
      this.logger.warn(`Permission Denied: User ${user.email} lacks a populated permissions object.`);
      throw new ForbiddenException('Access Denied: Your account profile is missing assigned permissions.');
    }

    // Extract resource from decorator metadata (takes priority over URL extraction)
    const decoratorMeta = this.reflector.getAllAndOverride<{ resource: string; action: PermissionAction } | null>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    let resource: string;
    let requiredAction: PermissionAction | null = decoratorMeta?.action ?? null;

    if (decoratorMeta?.resource) {
      resource = decoratorMeta.resource;
    } else {
      // Smart URL extraction: skip /api/v1 prefix
      const pathSegments = request.url.split('?')[0].split('/').filter(Boolean);
      if (pathSegments[0] === 'api' && pathSegments[1] === 'v1') {
        resource = pathSegments[2];
      } else if (pathSegments[0] === 'v1' || pathSegments[0] === 'api') {
        resource = pathSegments[1];
      } else {
        resource = pathSegments[0];
      }
    }

    const resourcePerms = user.role.permissions[resource];

    if (!resourcePerms) {
      this.logger.warn(`[SECURITY] ${user.email} attempted to access restricted resource: ${resource}`);
      throw new ForbiddenException(`Access Violation: Your role does not grant access to the '${resource}' module.`);
    }

    // If decorator specifies a custom action (e.g. approve, disburse), check it directly
    if (requiredAction) {
      if (!resourcePerms[requiredAction]) {
        throw new ForbiddenException(
          `Operation Blocked: Your role cannot perform '${requiredAction}' on ${resource}.`,
        );
      }
      this.logger.verbose(`Permission Granted: ${user.email} (${roleSlug}) -> ${requiredAction} /${resource}`);
      return true;
    }

    // Default HTTP method → action mapping
    const method = request.method;
    const action = this.mapMethodToAction(method);

    if (action && resourcePerms[action] === false) {
      throw new ForbiddenException(this.buildDenialMessage(action, resource));
    }

    this.logger.verbose(`Permission Granted: ${user.email} (${roleSlug}) -> ${method} /${resource}`);
    return true;
  }

  private mapMethodToAction(method: string): PermissionAction | null {
    switch (method) {
      case 'GET':    return 'read';
      case 'POST':   return 'create';
      case 'PATCH':
      case 'PUT':    return 'update';
      case 'DELETE': return 'delete';
      default:       return null;
    }
  }

  private buildDenialMessage(action: PermissionAction, resource: string): string {
    const messages: Record<string, string> = {
      read:     `Access Violation: You do not have permission to view ${resource}.`,
      create:   `Operation Blocked: Your role cannot create new ${resource}.`,
      update:   `Update Denied: Insufficient privileges to modify ${resource}.`,
      delete:   `Critical Violation: Your role is not authorized to delete ${resource}.`,
      approve:  `Approval Blocked: Your role cannot approve ${resource}.`,
      disburse: `Disbursement Blocked: Your role cannot disburse ${resource}.`,
      reject:   `Rejection Blocked: Your role cannot reject ${resource}.`,
      export:   `Export Blocked: Your role cannot export ${resource}.`,
    };
    return messages[action] ?? `Permission denied for '${action}' on ${resource}.`;
  }
}
