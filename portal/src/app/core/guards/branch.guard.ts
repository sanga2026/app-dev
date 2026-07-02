import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';

/**
 * Guard that allows access when the user has at least one branch-level permission.
 * Uses PBAC only — no hardcoded role checks.
 */
export const branchGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const hasBranchAccess =
    authService.hasPermission('customers', 'read') ||
    authService.hasPermission('accounting', 'read') ||
    authService.hasPermission('users', 'read');

  if (hasBranchAccess) return true;

  return router.createUrlTree(['/unauthorized'], {
    queryParams: { resource: 'branch-operations', action: 'read' },
  });
};
