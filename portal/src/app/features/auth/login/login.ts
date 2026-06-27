import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

// 🚀 Core Utilities & Services
import { AppValidators } from '../../../core/utils/validators.util';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, ToastModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  // --- Injections ---
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService);

  // --- UI State ---
  public showPassword = false;
  public isProcessing = false;              // Controls main login button
  public isForgotPasswordProcessing = false; // Controls forgot password link spinner

  // --- Form Model ---
  public loginData = {
    identifier: '', // Can be Email or Username
    password: '',
  };

  /**
   * 🛡️ Standard Login Logic
   * Handles multi-format identifier validation and session storage.
   */
  public onLogin(): void {
    const rawIdentifier = this.loginData.identifier.trim();
    const rawPassword = this.loginData.password;

    // 1. Basic Null Check
    if (!rawIdentifier || !rawPassword) {
      this.showToast('warn', 'Missing Fields', 'Please enter both your identifier and password.');
      return;
    }

    // 2. Multi-Format Validation (Omni-Validation)
    // We allow users to login via Email OR a strictly formatted Username
    const isEmail = AppValidators.isValidEmail(rawIdentifier);
    const isUsername = AppValidators.isValidUsername(rawIdentifier);

    if (!isEmail && !isUsername) {
      this.showToast('error', 'Invalid Format', 'Please enter a valid email address or username.');
      return;
    }

    // 3. Security: Password Complexity (Basic frontend gatekeeper)
    if (rawPassword.length < 6) {
      this.showToast('error', 'Weak Password', 'Passwords must be at least 6 characters.');
      return;
    }

    // ✅ Validation Passed - Begin Authentication
    this.isProcessing = true;

    this.authService.login(rawIdentifier, rawPassword).subscribe({
      next: (response) => {
        // Store Session (Token + Stringified User Data)
        this.authService.setSession(response.access_token, JSON.stringify(response.user));

        this.showToast('success', 'Access Granted', `Welcome back, ${response.user.fullName}!`);
        
        // Brief delay for the toast to be seen before redirect
        setTimeout(() => {
          this.isProcessing = false;
          this.router.navigate(['/dashboard']);
        }, 1000);
      },
      error: (err) => {
        this.isProcessing = false;
        const backendMsg = err.error?.message || 'Authentication failed. Please check your credentials.';
        this.showToast('error', 'Login Failed', backendMsg);
      },
    });
  }

  /**
   * 🔑 Forgot Password Logic
   * Uses the 'identifier' field as the target email for the reset link.
   */
  public onForgotPassword(): void {
    const email = this.loginData.identifier.trim();

    // 1. Validate Target Email
    if (!email || !AppValidators.isValidEmail(email)) {
      this.showToast('warn', 'Email Required', 'Please enter a valid email address in the identifier field.');
      return;
    }

    this.isForgotPasswordProcessing = true;

    // 2. Call Backend Reset Trigger
    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isForgotPasswordProcessing = false;
        this.showToast('success', 'Email Sent', res.message || 'If an account exists, a reset link has been sent.');
      },
      error: (err) => {
        this.isForgotPasswordProcessing = false;
        const errMsg = err.error?.message || 'Could not process reset request.';
        this.showToast('error', 'Request Failed', errMsg);
      }
    });
  }

  /**
   * 🛠️ Helper: Toast Centralization
   */
  private showToast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail });
  }
}