// src/app/features/auth/signup/signup.component.ts

import { Component, inject, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { switchMap, catchError, throwError, EMPTY, Subject } from 'rxjs';
import { takeUntil, finalize, map } from 'rxjs/operators';

// PrimeNG UI
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog'; 
import { ButtonModule } from 'primeng/button'; 

import { AuthService } from '../auth.service';
import { AppValidators } from '../../../core/utils/validators.util';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    ToastModule,
    DialogModule, 
    ButtonModule, 
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
  // 🚀 PERFORMANCE: OnPush prevents UI lag and unnecessary re-renders
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupComponent implements OnDestroy {
  /* =========================================================================
   * 1. DEPENDENCY INJECTION
   * ========================================================================= */
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService); // 🚀 Added for i18n
  private cdr = inject(ChangeDetectorRef); // 🚀 Added for OnPush
  private destroy$ = new Subject<void>(); // 🚀 Added for Memory Leak protection

  /* =========================================================================
   * 2. STATE MANAGEMENT
   * ========================================================================= */
  public showPassword = false;
  public showConfirmPassword = false;
  public showTermsModal = false;
  public hasReadTerms = false;
  public isProcessing = false;

  public countryCodes = ['+91', '+1', '+44', '+61', '+971'];

  public signupData = {
    firstName: '',
    lastName: '',
    email: '',
    countryCode: '+91', 
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  };

  /* =========================================================================
   * 3. LIFECYCLE HOOKS
   * ========================================================================= */
  
  /**
   * 🛡️ PERF: Destroys all active RxJS streams when component unmounts
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* =========================================================================
   * 4. UI MODAL FUNCTIONS
   * ========================================================================= */
  
  /**
   * Opens the Terms of Service Modal
   */
  public openTerms(): void {
    this.showTermsModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Accepts the terms, auto-checks the checkbox, and closes the modal
   */
  public acceptTerms(): void {
    this.hasReadTerms = true;
    this.signupData.agreeTerms = true; 
    this.showTermsModal = false;
    this.cdr.markForCheck();
  }

  /* =========================================================================
   * 5. CORE ACTIONS
   * ========================================================================= */
  
  /**
   * 🛡️ Validates data, initiates creation, and triggers auto-login
   */
  public onSignup(): void {
    if (!this.validateForm()) return;

    this.isProcessing = true;

    // 🚀 Clean and combine phone payload
    const fullPhoneNumber = `${this.signupData.countryCode}${this.signupData.phoneNumber.trim()}`;

    // 🛡️ Hacker-Free: Extract the values we need before wiping the class state
    const payload = {
      firstName: this.signupData.firstName.trim(),
      lastName: this.signupData.lastName.trim(),
      email: this.signupData.email.trim(),
      phoneNumber: fullPhoneNumber,
      password: this.signupData.password, 
      roleType: 'SUPER_ADMIN',
    };

    // 🛡️ ZERO-TRACE: Wipe credentials from browser RAM immediately after payload creation
    this.signupData.password = '';
    this.signupData.confirmPassword = '';

    // Add type definition to capture the backend's message
  this.http.post<{ message: string }>(`/users/super-admin`, payload)
    .pipe(
      takeUntil(this.destroy$),
      switchMap((signupRes) => {
        // 🚀 Step 2: Auto-Login via Omni-Login
        return this.http.post<{ success: boolean; access_token: string; user: any; message?: string }>(`/auth/login`, {
          identifier: payload.email, 
          password: payload.password,
        }).pipe(
          // Combine the login token with the backend message from the Signup API
          map((loginRes) => ({
            ...loginRes,
            backendMessage: signupRes.message || loginRes.message // Prioritize the signup message
          })),
          catchError(() => throwError(() => new Error('AUTO_LOGIN_FAILED')))
        );
      }),
      finalize(() => {
        // 🚀 Step 3: Always halt the loader and trigger UI refresh
        this.isProcessing = false;
        payload.password = ''; // Security Wipe
        this.cdr.markForCheck();
      }),
      catchError((error) => {
        if (error.message === 'AUTO_LOGIN_FAILED') {
          // This is a UI flow warning, so we keep the translated message
          this.showToast('warn', 'MESSAGES.PARTIAL_SUCCESS_TITLE', 'MESSAGES.AUTO_LOGIN_FAILED_DETAIL');
          setTimeout(() => this.router.navigate(['/login']), 2500);
        } else {
          // 🛡️ EXACT BACKEND ERROR MAPPING
          let backendMsg = 'An unexpected error occurred.'; // Safe fallback for 500 errors

          if (error.error?.message) {
            if (Array.isArray(error.error.message)) {
              // NestJS DTO Errors: ["Email is invalid", "Password too short"] -> Join them nicely
              backendMsg = error.error.message.join(' • '); 
            } else if (typeof error.error.message === 'string') {
              // NestJS Standard Exceptions: "Email already exists in the system"
              backendMsg = error.error.message;
            }
          }

          // Pass the exact string from the DB/Backend to the user
          this.showDirectToast('error', 'MESSAGES.REGISTRATION_FAILED_TITLE', backendMsg);
        }
        return EMPTY; // Safely kill the stream
      })
    )
    .subscribe({
      next: (finalRes) => {
        // 🚀 Ultimate Success
        this.authService.setSession(finalRes.access_token, finalRes.user);
        
        // Use the exact message provided by the NestJS backend
        this.showDirectToast(
          'success', 
          'MESSAGES.WELCOME_TITLE', 
          finalRes.backendMessage || 'Account successfully created.'
        );
        
        setTimeout(() => this.router.navigate(['/dashboard']), 1000);
      },
    });
  }

  /* =========================================================================
   * 6. VALIDATION & HELPERS
   * ========================================================================= */
  
  /**
   * 🛡️ Validates all fields using Central AppValidators and translates messages
   */
  private validateForm(): boolean {
    if (
      !this.signupData.firstName ||
      !this.signupData.lastName ||
      !this.signupData.email ||
      !this.signupData.phoneNumber ||
      !this.signupData.password
    ) {
      this.showToast('warn', 'MESSAGES.MISSING_FIELDS', 'MESSAGES.MISSING_FIELDS_DETAIL');
      return false;
    }

    if (!AppValidators.isValidFirstName(this.signupData.firstName)) {
      this.showToast('error', 'MESSAGES.INVALID_FIRSTNAME', 'MESSAGES.INVALID_FIRSTNAME_DETAIL');
      return false;
    }

    if (!AppValidators.isValidLastName(this.signupData.lastName)) {
      this.showToast('error', 'MESSAGES.INVALID_LASTNAME', 'MESSAGES.INVALID_LASTNAME_DETAIL');
      return false;
    }

    if (!AppValidators.isValidEmail(this.signupData.email)) {
      this.showToast('error', 'MESSAGES.INVALID_EMAIL', 'MESSAGES.INVALID_EMAIL_DETAIL');
      return false;
    }

    if (!AppValidators.isValidMobile(this.signupData.phoneNumber)) {
      this.showToast('error', 'MESSAGES.INVALID_PHONE', 'MESSAGES.INVALID_PHONE_DETAIL');
      return false;
    }

    if (!AppValidators.isStrongPassword(this.signupData.password)) {
      this.showToast('error', 'MESSAGES.WEAK_PASSWORD', 'MESSAGES.WEAK_PASSWORD_DETAIL');
      return false;
    }

    if (this.signupData.password !== this.signupData.confirmPassword) {
      this.showToast('error', 'MESSAGES.PWD_MISMATCH', 'MESSAGES.PWD_MISMATCH_DETAIL');
      return false;
    }

    if (!this.signupData.agreeTerms) {
      this.showToast('warn', 'MESSAGES.TERMS_REQUIRED', 'MESSAGES.TERMS_REQUIRED_DETAIL');
      return false;
    }

    return true;
  }

  /**
   * Helper to display translated toast messages
   */
  private showToast(severity: string, summaryKey: string, detailKey: string): void {
    this.messageService.add({
      severity,
      summary: this.translate.instant(summaryKey),
      detail: this.translate.instant(detailKey),
    });
  }

  /**
   * Helper to display toasts where the detail is a dynamic backend string
   */
  private showDirectToast(severity: string, summaryKey: string, directDetail: string): void {
    this.messageService.add({
      severity,
      summary: this.translate.instant(summaryKey),
      detail: directDetail,
    });
  }
}