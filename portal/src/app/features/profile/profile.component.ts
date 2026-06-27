// src/app/features/profile/profile.component.ts

import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService, UserSession } from '../../features/auth/auth.service';
import { AppValidators } from '../../core/utils/validators.util';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { GlobalSettingsService } from '../../core/services/global-settings.service';

/**
 * 🏛️ Production Interface for User Profile
 */
export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  role: string;
  tenantName: string;
  isDarkMode: boolean;
  isSidebarCollapsed: boolean;
  language: string;
  dashboardLayout: string;
  emailAlerts: boolean;
  smsAlerts: boolean;
}

type ProfileTab = 'profile' | 'security' | 'logs' | 'sessions' | 'about' | 'help';

@Component({
  selector: 'app-profile', 
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ToastModule],
  providers: [MessageService],
  templateUrl: './profile.component.html',
  // 🚀 PERFORMANCE: OnPush prevents UI lag when scrolling through hundreds of access logs
  changeDetection: ChangeDetectionStrategy.OnPush 
})
export class ProfileComponent implements OnInit, OnDestroy {
  
  /* =========================================================================
   * 1. DEPENDENCY INJECTION
   * ========================================================================= */
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly settingsService = inject(GlobalSettingsService);
  private readonly destroy$ = new Subject<void>();

  /* =========================================================================
   * 2. STATE MANAGEMENT
   * ========================================================================= */
  
  // -- UI & Form State --
  public activeTab: ProfileTab = 'profile';
  public userInitials = '??';
  public isSaving = false;
  public errors: Record<string, string> = {};

  // -- Security State --
  public isSavingPassword = false;
  public securityErrors: Record<string, string> = {};
  public showCurrentPassword = false;
  public showNewPassword = false;
  public showConfirmPassword = false;
  public securityForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  // -- Lists & Data State --
  public accessLogs: any[] = [];
  public filteredLogs: any[] = [];
  public sessions: UserSession[] = [];
  public globalSettings: Record<string, any> = {};

  // -- Pagination & Filtering State --
  public searchTerm: string = '';
  public isLoadingLogs = false;
  public isLoadingSessions = false;
  public logLimit = 10;
  public logOffset = 0;
  public hasMoreLogs = true;
  public logsNeedRefresh = false;

  // -- Core Model --
  public user: UserProfile = {
    id: '', username: '', firstName: '', lastName: '', email: '',
    phoneNumber: '', countryCode: '+91', role: '', tenantName: '',
    isDarkMode: false, isSidebarCollapsed: false, language: 'en',
    dashboardLayout: 'compact', emailAlerts: false, smsAlerts: false,
  };

  /* =========================================================================
   * 3. LIFECYCLE HOOKS
   * ========================================================================= */
  ngOnInit(): void {
    this.initializeProfile();

    // 🚀 Bind global settings and trigger UI update for OnPush
    this.settingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        if (settings) {
          this.globalSettings = settings;
          this.cdr.markForCheck(); // Required for OnPush
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* =========================================================================
   * 4. INITIALIZATION & UI NAVIGATION LOGIC
   * ========================================================================= */
  
  private initializeProfile(): void {
    const sessionUser = this.authService.getUserProfile();
    if (!sessionUser) return;

    const { fName, lName } = this.parseFullName(sessionUser);
    const { code, phone } = this.parsePhoneNumber(sessionUser.phoneNumber);

    this.user = {
      id: sessionUser.id || sessionUser.userId || '',
      username: sessionUser.username || '',
      firstName: fName,
      lastName: lName,
      email: sessionUser.email || '',
      countryCode: code,
      phoneNumber: phone,
      role: sessionUser.roleName || sessionUser.role || 'User',
      tenantName: sessionUser.tenantName || 'Default Bank',
      language: sessionUser.preferences?.language || 'en',
      dashboardLayout: this.authService.dashboardLayout$.value,
      isDarkMode: this.authService.isDarkMode$.value,
      isSidebarCollapsed: this.authService.sidebarState$.value,
      emailAlerts: this.authService.emailAlerts$.value,
      smsAlerts: this.authService.smsAlerts$.value,
    };

    this.updateInitials();
  }

  public updateInitials(): void {
    const f = this.user.firstName?.trim().charAt(0) || '';
    const l = this.user.lastName?.trim().charAt(0) || '';
    this.userInitials = (f + l).toUpperCase() || '??';
  }

  public setTab(tab: ProfileTab): void {
    this.activeTab = tab;
    
    switch (tab) {
      case 'logs':
        if (this.accessLogs.length === 0 || this.logsNeedRefresh) {
          this.loadInitialLogs();
          this.logsNeedRefresh = false;
        }
        break;
      case 'sessions':
        if (this.sessions.length === 0) {
          this.fetchSessions();
        }
        break;
    }
  }

  /* =========================================================================
   * 5. PREFERENCE SYNCHRONIZATION
   * ========================================================================= */
  public onThemeChange(isDark: boolean): void { this.authService.setThemeState(isDark); }
  public onSidebarChange(isCollapsed: boolean): void { this.authService.setSidebarState(isCollapsed); }
  public onLanguageChange(lang: string): void { this.authService.setLanguageState(lang); }
  public onLayoutChange(layout: string): void { this.authService.setDashboardLayoutState(layout); }
  public onEmailAlertsChange(enabled: boolean): void { this.authService.setEmailAlertsState(enabled); }
  public onSmsAlertsChange(enabled: boolean): void { this.authService.setSmsAlertsState(enabled); }

  /* =========================================================================
   * 6. CORE ACTIONS (UPDATE PROFILE & PASSWORD)
   * ========================================================================= */
  
  public onUpdateProfile(): void {
    if (!this.validateProfileForm()) return;
    this.isSaving = true;

    // 🛡️ Hacker-Free: Send only the specific whitelisted payload fields
    const payload = {
      firstName: this.user.firstName.trim(),
      lastName: this.user.lastName.trim(),
      phoneNumber: `${this.user.countryCode}${this.user.phoneNumber.trim()}`,
      preferences: {
        theme: this.user.isDarkMode ? 'dark' : 'light',
        language: this.user.language,
        dashboard_layout: this.user.dashboardLayout,
        is_sidebar_collapsed: this.user.isSidebarCollapsed,
        notification_toggles: { email_alerts: this.user.emailAlerts, sms_alerts: this.user.smsAlerts },
      },
    };

    this.authService.updateUserProfile(this.user.id, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.showDirectToast('success', 'MESSAGES.SUCCESS_TITLE', res.message);
          this.logsNeedRefresh = true;
        },
        error: (err) => {
          const backendErrorMsg = err.error?.message || err.statusText;
          this.showDirectToast('error', 'MESSAGES.ERROR_TITLE', backendErrorMsg);
        },
      });
  }

  public onUpdatePassword(): void {
    if (!this.validatePasswordForm()) return;
    this.isSavingPassword = true;

    const payload = {
      currentPassword: this.securityForm.currentPassword,
      newPassword: this.securityForm.newPassword,
    };

    this.authService.updatePassword(this.user.id, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSavingPassword = false;
          
          // 🛡️ Hacker-Free: Wipe credentials from RAM regardless of success/error
          this.securityForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.showDirectToast('success', 'MESSAGES.SUCCESS_TITLE', res.message);
          this.logsNeedRefresh = true;
        },
        error: (err) => {
          const backendErrorMsg = err.error?.message || err.statusText;
          this.showDirectToast('error', 'MESSAGES.ERROR_TITLE', backendErrorMsg);
        },
      });
  }

  public onLogout(): void {
    this.authService.logout();
  }

  /* =========================================================================
   * 7. DATA FETCHING (LOGS & SESSIONS)
   * ========================================================================= */
  
  public fetchSessions(): void {
    if (this.isLoadingSessions) return; 
    this.isLoadingSessions = true;
    
    this.authService.getSessions()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (data) => this.sessions = data,
        error: (err) => this.showDirectToast('error', 'COMMON.ERROR', err.error?.message)
      });
  }

  public onRevokeSession(sessionId: string): void {
    if (this.isLoadingSessions) return;
    this.isLoadingSessions = true;

    this.authService.revokeSession(sessionId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingSessions = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.showDirectToast('success', 'SUCCESS', 'MESSAGES.SESSION_REVOKED');
          this.fetchSessions(); 
        },
        error: (err) => {
          this.showDirectToast('error', 'COMMON.ERROR', err.error?.message);
        }
      });
  }

  public loadInitialLogs(): void {
    this.logOffset = 0;
    this.accessLogs = [];
    this.filteredLogs = [];
    this.hasMoreLogs = true;
    this.fetchLogs();
  }

  public refreshLogs(): void {
    if (this.isLoadingLogs) return;
    this.loadInitialLogs();
    this.logsNeedRefresh = false;
  }

  public fetchLogs(): void {
    if (!this.user.id || this.isLoadingLogs || !this.hasMoreLogs) return;
    this.isLoadingLogs = true;

    this.authService.getAccessLogs(this.user.id, this.logLimit, this.logOffset)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingLogs = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (newLogs: any[]) => {
          if (!newLogs || newLogs.length === 0) {
            this.hasMoreLogs = false;
            return;
          }

          // 🚀 Performance: O(1) duplicate check
          const existingIds = new Set(this.accessLogs.map(log => log.id));
          const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log.id));

          if (uniqueNewLogs.length > 0) {
            this.accessLogs = [...this.accessLogs, ...uniqueNewLogs];
            this.applyLogFilter();
            this.logOffset += this.logLimit;
          }

          if (newLogs.length < this.logLimit) {
            this.hasMoreLogs = false;
          }
        },
        error: (err) => {
          this.hasMoreLogs = false;
          this.showDirectToast('error', 'MESSAGES.ERROR_TITLE', err.error?.message || err.statusText);
        }
      });
  }

  public applyLogFilter(): void {
    if (!this.searchTerm) {
      this.filteredLogs = this.accessLogs;
      return;
    }
    
    const search = this.searchTerm.toLowerCase().trim();
    this.filteredLogs = this.accessLogs.filter(log => 
      (log.event?.toLowerCase().includes(search)) || 
      (log.ipAddress?.toLowerCase().includes(search)) ||
      (log.device?.toLowerCase().includes(search))
    );
  }

  // 🚀 Performance: TrackBy functions for *ngFor loops
  public trackBySessionId(index: number, session: UserSession): string { return session.id; }
  public trackByLogId(index: number, log: any): string { return log.id; }

  /* =========================================================================
   * 8. VALIDATION & HELPERS
   * ========================================================================= */
  
  /**
   * Evaluates ALL fields so user sees complete error state at once
   */
  private validateProfileForm(): boolean {
    this.errors = {};
    let isValid = true;

    if (!AppValidators.isValidFirstName(this.user.firstName)) {
      this.errors['firstName'] = 'MESSAGES.INVALID_FIRSTNAME_DETAIL';
      isValid = false;
    }
    if (!AppValidators.isValidLastName(this.user.lastName)) {
      this.errors['lastName'] = 'MESSAGES.INVALID_LASTNAME_DETAIL';
      isValid = false;
    }
    if (this.user.phoneNumber && !AppValidators.isValidMobile(this.user.phoneNumber)) {
      this.errors['phoneNumber'] = 'MESSAGES.INVALID_PHONE_DETAIL';
      isValid = false;
    }

    if (!isValid) {
      this.showToast('error', 'MESSAGES.VALIDATION_ERROR', 'MESSAGES.CHECK_FORM_ERRORS');
    }
    return isValid;
  }

  private validatePasswordForm(): boolean {
    this.securityErrors = {};
    let isValid = true;

    if (!this.securityForm.currentPassword) {
      this.securityErrors['currentPassword'] = 'MESSAGES.CURRENT_PWD_REQUIRED';
      isValid = false;
    }
    if (!AppValidators.isStrongPassword(this.securityForm.newPassword)) {
      this.securityErrors['newPassword'] = 'MESSAGES.WEAK_PASSWORD_DETAIL';
      isValid = false;
    }
    if (this.securityForm.currentPassword && this.securityForm.currentPassword === this.securityForm.newPassword) {
      this.securityErrors['newPassword'] = 'MESSAGES.PWD_SAME_DETAIL';
      isValid = false;
    }
    if (this.securityForm.newPassword !== this.securityForm.confirmPassword) {
      this.securityErrors['confirmPassword'] = 'MESSAGES.PWD_MISMATCH_DETAIL';
      isValid = false;
    }

    if (!isValid) {
      this.showToast('error', 'MESSAGES.VALIDATION_ERROR', 'MESSAGES.CHECK_FORM_ERRORS');
    }
    return isValid;
  }

  private showToast(severity: string, summaryKey: string, detailKey: string): void {
    this.messageService.add({ severity, summary: this.translate.instant(summaryKey), detail: this.translate.instant(detailKey) });
  }

  private showDirectToast(severity: string, summaryKey: string, directDetail: string): void {
    this.messageService.add({ severity, summary: this.translate.instant(summaryKey), detail: directDetail });
  }

  private parseFullName(user: any): { fName: string; lName: string } {
    let fName = user.firstName || '';
    let lName = user.lastName || '';
    if (!fName && user.fullName) {
      const parts = user.fullName.trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
    }
    return { fName, lName };
  }

  /**
   * 🛡️ Resilient phone parser: Always guarantees the last 10 digits are the phone number
   */
  private parsePhoneNumber(raw: string): { code: string; phone: string } {
    const clean = (raw || '').replace(/\D/g, ''); // Strip all non-digits
    if (clean.length > 10) {
      const phone = clean.slice(-10); // Take exactly the last 10 digits
      const remainingCode = clean.slice(0, -10);
      return { code: `+${remainingCode}`, phone };
    }
    return { code: '+91', phone: clean };
  }
}