import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getToken()) {
    return true; // ✅ Token exists, proceed to Dashboard
  } else {
    router.navigate(['/login']); // ❌ No token, go back to Login
    return false;
  }
};