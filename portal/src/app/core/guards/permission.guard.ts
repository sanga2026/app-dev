import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';
import { MessageService } from 'primeng/api';

export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const messageService = inject(MessageService);

  const resource = route.data['resource'];
  
  // 🚀 FIXED: Allow the route to specify an action, but default to 'read'
  const action = route.data['action'] || 'read';

  if (resource && authService.hasPermission(resource, action)) {
    return true; // 🟢 Authorized
  }

  // 🔴 Unauthorized
  messageService.add({ 
    severity: 'error', 
    summary: 'Access Denied', 
    detail: `You do not have ${action} permission for the ${resource} module.` 
  });
  
  // 🚀 FIXED: Redirect to '/dashboard' instead of '/banks'. 
  // Why? A Branch Manager might not have access to '/banks', causing an infinite redirect loop!
  return router.createUrlTree(['/dashboard']); 
};