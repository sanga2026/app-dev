import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';

export interface AccessLog {
  id: string;
  event: string;
  ipAddress: string;
  device: string;
  createdAt: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
  };
}

export interface UserSession {
  id: string;
  device: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  // Refresh token stored in sessionStorage — not persisted across browser close, reduces XSS risk
  private readonly REFRESH_KEY = 'auth_refresh_token';

  public sidebarState$ = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = new BehaviorSubject<boolean>(false);
  public language$ = new BehaviorSubject<string>('en-US');
  public dashboardLayout$ = new BehaviorSubject<string>('compact');
  public emailAlerts$ = new BehaviorSubject<boolean>(false);
  public smsAlerts$ = new BehaviorSubject<boolean>(false);

  // Tracks whether a silent token refresh is in progress (prevents duplicate refresh calls)
  private _refreshing = false;

  constructor() {
    setTimeout(() => this.initializeStates(), 0);
  }

  /* ── Authentication ─────────────────────────────────────────────────── */

  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { identifier, password });
  }

  setSession(token: string, userProfile: any, refreshToken?: string) {
    this.clearAllStorage();
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(userProfile));
    if (refreshToken) {
      sessionStorage.setItem(this.REFRESH_KEY, refreshToken);
    }
    this.initializeStates();
  }

  logout() {
    this.clearAllStorage();
    this.router.navigate(['/login']);
  }

  private clearAllStorage() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.REFRESH_KEY);
  }

  /* ── Token Management ───────────────────────────────────────────────── */

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      const payload = JSON.parse(jsonPayload);
      const clockSkewBuffer = 60;
      const isExpired = (Date.now() / 1000) >= (payload.exp - clockSkewBuffer);
      if (isExpired) {
        this.clearAllStorage();
        return false;
      }
      return true;
    } catch {
      this.clearAllStorage();
      return false;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem(this.REFRESH_KEY);
  }

  isRefreshing(): boolean {
    return this._refreshing;
  }

  /** Silently exchange refresh token for new access + refresh tokens */
  refreshToken(): Observable<{ access_token: string; refresh_token: string }> {
    this._refreshing = true;
    const refreshToken = this.getRefreshToken();
    return this.http.post<{ access_token: string; refresh_token: string }>(
      `${environment.apiUrl}/auth/refresh`,
      { refreshToken },
    ).pipe(
      tap(response => {
        this._refreshing = false;
        const profile = this.getUserProfile();
        this.setSession(response.access_token, profile, response.refresh_token);
      }),
    );
  }

  getUserProfile(): any | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      let user = JSON.parse(userStr);
      if (typeof user === 'string') user = JSON.parse(user);
      return user;
    } catch {
      this.logout();
      return null;
    }
  }

  /* ── Permission Checks ──────────────────────────────────────────────── */

  /** True when the current user's roleType is SUPER_ADMIN — informational only, does NOT bypass PBAC */
  public isSuperAdmin(): boolean {
    const profile = this.getUserProfile();
    const role = profile?.roleType || profile?.role || '';
    return typeof role === 'string' && role.toUpperCase() === 'SUPER_ADMIN';
  }

  /**
   * PBAC check — always respects the permissions matrix for ALL users including SUPER_ADMIN.
   *
   * Navigation visibility rule:
   *   - If navigation sub-key exists and is explicitly `false` → hidden
   *   - If navigation sub-key is `true` → visible
   *   - If navigation object is null/absent → show all (not yet configured)
   *
   * Data access rule:
   *   - Checked strictly against resource.action in the matrix
   *   - Empty matrix (no keys at all) → SUPER_ADMIN gets full access as bootstrap fallback
   */
  public hasPermission(resource: string, action: string): boolean {
    const userProfile = this.getUserProfile();
    if (!userProfile) return false;

    let userPermissions = userProfile.permissions || userProfile.role?.permissions;
    if (typeof userPermissions === 'string') {
      try { userPermissions = JSON.parse(userPermissions); }
      catch { userPermissions = {}; }
    }

    // If the permissions matrix has been configured (any keys present), use it strictly
    if (userPermissions && Object.keys(userPermissions).length > 0) {
      if (resource === 'navigation') {
        const navConfig = userPermissions['navigation'];
        // null / undefined navigation = not configured yet → show everything
        if (navConfig === null || navConfig === undefined) return true;
        // Configured: respect explicit true/false; undefined key = not listed = show
        return navConfig[action] !== false;
      }
      return userPermissions[resource]?.[action] === true;
    }

    // Empty matrix fallback: only SUPER_ADMIN gets access (bootstrap / first-run)
    return this.isSuperAdmin();
  }

  /* ── Password Management ────────────────────────────────────────────── */

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email });
  }

  confirmResetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/reset-password`, { token, password });
  }

  updatePassword(userId: string, payload: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.put(`${environment.apiUrl}/users/${userId}/password`, payload);
  }

  updateAdmin(id: string, payload: any): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/users/${id}`, payload);
  }

  toggleStatus(id: string, payload: any): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/users/${id}/status`, payload);
  }

  deleteAdmin(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/users/${id}`);
  }

  /* ── Account & Audit ────────────────────────────────────────────────── */

  updateUserProfile(userId: string, payload: any): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/users/${userId}`, payload).pipe(
      tap((response: any) => {
        if (response?.data) {
          const updatedProfile = { ...this.getUserProfile(), ...response.data };
          this.setSession(this.getToken() || '', updatedProfile, this.getRefreshToken() || undefined);
        }
      }),
    );
  }

  getAccessLogs(userId: string, limit = 10, offset = 0): Observable<AccessLog[]> {
    return this.http.get<AccessLog[]>(`${environment.apiUrl}/audit/logs/${userId}`, {
      params: { limit: limit.toString(), offset: offset.toString() },
    });
  }

  /**
   * Re-fetches the current user's profile from the API and refreshes the stored permissions.
   * Call this after a role's permissions are updated so the UI reflects the new access immediately
   * without requiring a full logout/login.
   */
  refreshPermissions(): Observable<any> {
    const profile = this.getUserProfile();
    if (!profile?.id) return new Observable(s => s.complete());
    return this.http.get<any>(`${environment.apiUrl}/users/${profile.id}`).pipe(
      tap((res: any) => {
        const user = res.data ?? res;
        if (user?.role?.permissions) {
          const updated = { ...profile, permissions: user.role.permissions };
          localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
        }
      })
    );
  }

  getSessions(): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(`${environment.apiUrl}/sessions`);
  }

  revokeSession(sessionId: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/sessions/${sessionId}`);
  }

  /* ── UI State ───────────────────────────────────────────────────────── */

  private initializeStates() {
    const user = this.getUserProfile();
    if (user?.preferences) {
      this.sidebarState$.next(user.preferences.is_sidebar_collapsed ?? false);
      const isDark = user.preferences.theme === 'dark';
      this.isDarkMode$.next(isDark);
      this.applyThemeToDocument(isDark);
      this.setLanguageState(user.preferences.language || 'en-US');
      this.dashboardLayout$.next(user.preferences.dashboard_layout || 'compact');
      this.emailAlerts$.next(user.preferences.notification_toggles?.email_alerts ?? true);
      this.smsAlerts$.next(user.preferences.notification_toggles?.sms_alerts ?? false);
    }
  }

  setThemeState(isDark: boolean) {
    this.isDarkMode$.next(isDark);
    this.applyThemeToDocument(isDark);
  }

  private applyThemeToDocument(isDark: boolean) {
    if (isDark) { document.documentElement.classList.add('dark'); }
    else { document.documentElement.classList.remove('dark'); }
  }

  setSidebarState(isCollapsed: boolean) { this.sidebarState$.next(isCollapsed); }
  setLanguageState(lang: string) { this.language$.next(lang); this.translate.use(lang); }
  setDashboardLayoutState(layout: string) { this.dashboardLayout$.next(layout); }
  setEmailAlertsState(enabled: boolean) { this.emailAlerts$.next(enabled); }
  setSmsAlertsState(enabled: boolean) { this.smsAlerts$.next(enabled); }
}
