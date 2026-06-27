import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router'; 
import { environment } from '../../../environments/environment';
import { AuthService } from '../../features/auth/auth.service';
import { NetworkService } from '../services/network.service'; 

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router); 
  const networkService = inject(NetworkService);

  // 🚀 1. ALLOW LOCAL ASSETS FIRST (Translations, Images, Fonts)
  // This MUST be at the very top so cached assets can load even when offline!
  if (req.url.includes('/i18n/') || req.url.includes('/assets/')) {
    return next(req);
  }

  // 🚀 2. THE OFFLINE GATEKEEPER
  // If the user has no internet, block outgoing external API calls immediately
  if (!networkService.isOnline) {
    console.warn('API Interceptor: Request blocked due to offline status.');
    // Throwing an empty error prevents the browser from hanging and timing out
    return throwError(() => new Error('Offline')); 
  }

  let modifiedReq = req;

  // 🚀 3. Prepend Base API URL
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    modifiedReq = req.clone({
      url: `${environment.apiUrl}${req.url}`
    });
  }

  // 🚀 4. Attach Security Headers
  const token = authService.getToken();
  
  if (token) {
    modifiedReq = modifiedReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 🚀 5. Global Error Handling
  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      
      // 🛑 401 UNAUTHORIZED: Token is dead or invalid. Kick them out.
      if (error.status === 401) {
        const isAuthRequest = req.url.includes('/login') || req.url.includes('/users/super-admin');
        
        if (!isAuthRequest) {
          authService.logout(); 
        }
      } 
      // 🛑 403 FORBIDDEN: User is logged in, but tried to do something they aren't allowed to.
      else if (error.status === 403) {
        // Do NOT log the user out. 
        // Just log it for debugging and let the error pass down to the component!
        console.warn('403 Forbidden: Blocked by backend security guard.');
      }
      
      // Pass the error down to the component so PrimeNG can show the Toast message
      return throwError(() => error);
    })
  );
};