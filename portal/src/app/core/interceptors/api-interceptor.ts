import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../features/auth/auth.service';
import { NetworkService } from '../services/network.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const networkService = inject(NetworkService);

  // Allow local assets through without modification
  if (req.url.includes('/i18n/') || req.url.includes('/assets/')) {
    return next(req);
  }

  // Block outgoing calls when offline
  if (!networkService.isOnline) {
    return throwError(() => new Error('Offline'));
  }

  // Prepend base API URL for relative paths
  let modifiedReq = req;
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) {
    modifiedReq = req.clone({ url: `${environment.apiUrl}${req.url}` });
  }

  // Attach Bearer token
  const token = authService.getToken();
  if (token) {
    modifiedReq = modifiedReq.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        const isAuthEndpoint = req.url.includes('/auth/login')
          || req.url.includes('/auth/refresh')
          || req.url.includes('/users/super-admin');

        if (!isAuthEndpoint) {
          // Attempt silent token refresh
          const refreshToken = authService.getRefreshToken();
          if (refreshToken && !authService.isRefreshing()) {
            return authService.refreshToken().pipe(
              switchMap(() => {
                // Retry original request with new token
                const newToken = authService.getToken();
                const retried = modifiedReq.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
                });
                return next(retried);
              }),
              catchError(() => {
                // Refresh failed — session is truly expired
                authService.logout();
                return throwError(() => error);
              }),
            );
          } else {
            authService.logout();
          }
        }
      } else if (error.status === 403) {
        console.warn('403 Forbidden: insufficient permissions.');
      } else if (error.status === 429) {
        console.warn('429 Too Many Requests: rate limit hit.');
      }

      return throwError(() => error);
    }),
  );
};