import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';

// --- Interfaces ---
export interface AccessLog {
  id: string;
  event: string;
  ipAddress: string;
  device: string;
  createdAt: string;
}

export interface LoginResponse {
  access_token: string;
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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // --- Injections ---
  private router = inject(Router);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  // --- Security Constants ---
  private readonly TOKEN_KEY = 'auth_token'; 
  private readonly USER_KEY = 'auth_user';

  // --- Live State Trackers ---
  public sidebarState$ = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = new BehaviorSubject<boolean>(false);
  public language$ = new BehaviorSubject<string>('en-US');
  public dashboardLayout$ = new BehaviorSubject<string>('compact');
  public emailAlerts$ = new BehaviorSubject<boolean>(false);
  public smsAlerts$ = new BehaviorSubject<boolean>(false);

  constructor() {
    // Defers state initialization slightly to prevent Angular change-detection errors
    setTimeout(() => this.initializeStates(), 0);
  }

  /* =========================================================================
   * 1. CORE AUTHENTICATION FLOW
   * ========================================================================= */

  /**
   * 🔐 Standard Login Request
   */
  login(identifier: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
      identifier,
      password
    });
  }

  /**
   * 🛡️ Establish Secure Session
   */
  setSession(token: string, userProfile: any) {
    this.clearAllStorage();

    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(userProfile));
    
    this.initializeStates();
    console.log('✅ Token securely saved to LocalStorage');
  }

  /**
   * 🚪 Secure Logout & Cleanup
   */
  logout() {
    this.clearAllStorage();
    this.router.navigate(['/login']);
  }

  /**
   * 🧹 Obliterates all sensitive data across storage mediums
   */
  private clearAllStorage() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.clear(); // Catch any ghost data
  }

  /* =========================================================================
   * 2. SECURITY & GUARD HELPERS
   * ========================================================================= */

  /**
   * 🛡️ Hardened Auth Check for Route Guards
   */
  isLoggedIn(): boolean {
    const token = this.getToken(); 
    
    if (!token) return false;

    try {
      // 1. Structural Validation
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // 2. Safe Base64URL Decoding (Prevents malformed string crashes)
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      
      const payload = JSON.parse(jsonPayload);
      
      // 3. Expiration check with 60-second network latency buffer
      const clockSkewBuffer = 60; 
      const isExpired = (Date.now() / 1000) >= (payload.exp - clockSkewBuffer);

      if (isExpired) {
        console.warn('Session expired. Performing secure cleanup.');
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      // Silent failure: do not leak parsing errors to the console
      this.clearAllStorage();
      return false;
    }
  }

  /**
   * 🔑 Retrieves the raw JWT
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY); // FIXED: Was incorrectly using sessionStorage
  }

  /**
   * 👤 Retrieves and parses the active user profile safely
   */
  getUserProfile(): any | null {
    const userStr = localStorage.getItem(this.USER_KEY); // FIXED: Was incorrectly using sessionStorage
    if (!userStr) return null;

    try {
      let user = JSON.parse(userStr);
      // Double parse catch in case data was stringified twice accidentally
      if (typeof user === 'string') {
        user = JSON.parse(user);
      }
      return user;
    } catch (e) {
      console.error('Security Alert: User profile data corrupted or tampered with.', e);
      this.logout();
      return null;
    }
  }

  /* =========================================================================
   * 2. SECURITY & GUARD HELPERS
   * ========================================================================= */

  // ... your existing isLoggedIn(), getToken(), and getUserProfile() methods ...

/**
   * 🛡️ PBAC Granular UI Access Control (Hardened)
   * Handles both standard CRUD matrices and Flat Navigation matrices.
   */
  public hasPermission(resource: string, action: string): boolean {
    const userProfile = this.getUserProfile();
    if (!userProfile) return false;

    // 1. Locate the permissions data
    let userPermissions = userProfile.permissions || userProfile.role?.permissions;

    // Parse if it came as a stringified JSON
    if (typeof userPermissions === 'string') {
      try {
        userPermissions = JSON.parse(userPermissions);
      } catch (e) {
        console.error('Failed to parse permissions string', e);
        userPermissions = {};
      }
    }

    // 2. STRICT CHECK: Enforce the permissions matrix
    if (userPermissions && Object.keys(userPermissions).length > 0) {
      
      // 🚀 NEW: Flat Check for Navigation UI Flags
      if (resource === 'navigation') {
        const navPerms = userPermissions['navigation'];
        if (!navPerms) return false;
        return navPerms[action] === true; // Directly checks the boolean (e.g., navPerms['banks'])
      }

      // Standard Deep Check for CRUD resources
      const resourcePerms = userPermissions[resource];
      if (!resourcePerms) return false; 
      
      return resourcePerms[action] === true;
    }

    // 3. SMART FALLBACK (Only triggers if permissions matrix is completely empty)
    const rawRole = userProfile.roleType || userProfile.role || 'CUSTOMER';
    if (typeof rawRole === 'string' && rawRole.toUpperCase() === 'SUPER_ADMIN') {
      // If they are super admin and have no matrix, allow everything. 
      // (Note: If they DO have a matrix, it skips this and respects their explicit 'false' settings).
      return true;
    }

    return false;
  }
  /* =========================================================================
   * 3. PASSWORD MANAGEMENT
   * ========================================================================= */

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

  // 🗑️ Delete Admin
  deleteAdmin(id: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/users/${id}`);
  }

  /* =========================================================================
   * 4. ACCOUNT & AUDIT MANAGEMENT
   * ========================================================================= */

  updateUserProfile(userId: string, payload: any): Observable<any> {
    const url = `${environment.apiUrl}/users/${userId}`;

    return this.http.patch(url, payload).pipe(
      tap((response: any) => {
        if (response && response.data) {
          const currentToken = this.getToken() || '';
          const existingProfile = this.getUserProfile() || {};
          const updatedProfile = { ...existingProfile, ...response.data };

          // Automatically sync the new profile data into local storage
          this.setSession(currentToken, updatedProfile);
        }
      })
    );
  }

getAccessLogs(userId: string, limit: number = 10, offset: number = 0): Observable<AccessLog[]> {
  console.log(userId,limit,offset)
  return this.http.get<AccessLog[]>(`${environment.apiUrl}/audit/logs/${userId}`, {
    params: { 
      limit: (limit || 10).toString(), 
      offset: (offset || 0).toString() 
    }
  });
}

getSessions(): Observable<UserSession[]> {
  // Simple GET request. The Interceptor will automatically 
  // attach the Bearer token to this call.
  return this.http.get<UserSession[]>(`${environment.apiUrl}/sessions`);
}

revokeSession(sessionId: string): Observable<any> {
  return this.http.delete(`${environment.apiUrl}/sessions/${sessionId}`);
}

  /* =========================================================================
   * 5. UI STATE MANAGEMENT
   * ========================================================================= */

  private initializeStates() {
    const user = this.getUserProfile();
    if (user && user.preferences) {
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
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setSidebarState(isCollapsed: boolean) {
    this.sidebarState$.next(isCollapsed);
  }

  setLanguageState(lang: string) {
    this.language$.next(lang);
    this.translate.use(lang);
  }

  setDashboardLayoutState(layout: string) {
    this.dashboardLayout$.next(layout);
  }

  setEmailAlertsState(enabled: boolean) {
    this.emailAlerts$.next(enabled);
  }

  setSmsAlertsState(enabled: boolean) {
    this.smsAlerts$.next(enabled);
  }
}