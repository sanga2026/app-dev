import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 🛡️ Check if the user is already logged in
  if (authService.isLoggedIn()) {
    // 🚀 If logged in, don't show login page, go to dashboard
    router.navigate(['/dashboard']);
    return false;
  }

  // ✅ If not logged in, allow access to Login/Signup
  return true;
};