import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const resource = route.data['resource'] as string;
  const action   = (route.data['action'] || 'read') as string;

  if (resource && authService.hasPermission(resource, action)) {
    return true; // ✅ Authorized
  }

  // ❌ Not authorized — navigate to the dedicated access-denied page
  // Pass resource + action as query params so the page can show a helpful message
  return router.createUrlTree(['/unauthorized'], {
    queryParams: { resource, action },
  });
};
