import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
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
  private authService    = inject(AuthService);
  private router         = inject(Router);
  private http           = inject(HttpClient);
  private messageService = inject(MessageService);
  private translate      = inject(TranslateService);

  public showPassword               = false;
  public isProcessing               = false;
  public isForgotPasswordProcessing = false;

  public loginData = { identifier: '', password: '' };

  // Who can use this portal — shown on left panel and bottom of form
  public roles = [
    { name: 'Super Admin',     desc: 'Platform management',    icon: 'pi-shield',          iconBg: 'bg-indigo-500/80'  },
    { name: 'Bank Admin',      desc: 'Bank-level operations',  icon: 'pi-building-columns', iconBg: 'bg-blue-500/80'    },
    { name: 'Branch Manager',  desc: 'Branch oversight',       icon: 'pi-sitemap',         iconBg: 'bg-sky-500/80'     },
    { name: 'Branch Staff',    desc: 'Daily transactions',     icon: 'pi-users',           iconBg: 'bg-cyan-500/80'    },
    { name: 'Customer',        desc: 'Account & loans',        icon: 'pi-id-card',         iconBg: 'bg-teal-500/80'    },
    { name: 'Custom Roles',    desc: 'Bank-defined access',    icon: 'pi-lock',            iconBg: 'bg-purple-500/80'  },
  ];

  public onLogin(): void {
    const rawIdentifier = this.loginData.identifier.trim();
    const rawPassword   = this.loginData.password;

    // Basic presence check — identifier can be email, username, staffId, or customer number
    if (!rawIdentifier || !rawPassword) {
      this.showToast('warn', 'Missing Fields', 'Please enter your User ID and password.');
      return;
    }

    if (rawIdentifier.length < 3) {
      this.showToast('error', 'Invalid User ID', 'User ID must be at least 3 characters.');
      return;
    }

    if (rawPassword.length < 6) {
      this.showToast('error', 'Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    this.isProcessing = true;

    this.authService.login(rawIdentifier, rawPassword).subscribe({
      next: (response) => {
        this.authService.setSession(response.access_token, JSON.stringify(response.user), response.refresh_token);
        const name = (response.user as any).fullName ?? (response.user as any).firstName ?? 'there';
        this.showToast('success', 'Access Granted', `Welcome back, ${name}!`);
        setTimeout(() => {
          this.isProcessing = false;
          this.router.navigate([this.resolvePostLoginRoute(response.user)]);
        }, 900);
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
   * Determines post-login landing route based on role type.
   */
  private resolvePostLoginRoute(user: any): string {
    const role = user?.roleType ?? user?.role ?? '';
    switch (role.toUpperCase()) {
      case 'SUPER_ADMIN':    return '/banks';
      case 'BANK_ADMIN':     return '/dashboard';
      case 'BRANCH_MANAGER': return '/dashboard';
      case 'STAFF':          return '/dashboard';
      case 'CUSTOMER':       return '/dashboard';
      default:               return '/dashboard';
    }
  }

  /**
   * Helper: Toast Centralization
   */
  private showToast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail });
  }
}