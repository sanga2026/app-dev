import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';

export const rolesGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Get the allowed roles from the route's data object
  const requiredRoles = route.data['roles'] as Array<string>;
  
  if (!requiredRoles || requiredRoles.length === 0) {
    return true; // No specific roles required for this route
  }

  // 2. Get the current user's role from the session
  const userProfile = authService.getUserProfile();
  const userRole = userProfile?.roleType || userProfile?.role || 'CUSTOMER';

  // 3. Check if their role is in the allowed list
  if (requiredRoles.includes(userRole)) {
    return true; // 🟢 Access Granted
  }

  // 🛑 Access Denied: Hacker/Unauthorized attempt. Kick them to dashboard.
  console.warn(`[SECURITY] Unauthorized access attempt to ${state.url} by role: ${userRole}`);
  router.navigate(['/dashboard']);
  return false;
};