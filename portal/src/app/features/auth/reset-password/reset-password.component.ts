import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../auth.service';
import { AppValidators } from '../../../core/utils/validators.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule, ToastModule],
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  // --- State Management ---
  token: string | null = null;
  newPassword = '';
  confirmPassword = '';
  isProcessing = false;
  
  // Specific toggles for independent eye icons
  public showNewPassword = false;
  public showConfirmPassword = false;

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.showToast('error', 'Invalid Link', 'Reset token is missing. Redirecting to login...');
      setTimeout(() => this.router.navigate(['/login']), 3000);
    }
  }

  onResetPassword() {
    // 🛡️ 1. Basic Token Check
    if (!this.token) return;

    // 🛡️ 2. Match Check
    if (this.newPassword !== this.confirmPassword) {
      this.showToast('error', 'Mismatch', 'Passwords do not match!');
      return;
    }

    // 🛡️ 3. Strong Password Validation (Using your Regex)
    // Checks for: Uppercase, Lowercase, Number, Special Char, and Min Length
    if (!AppValidators.isStrongPassword(this.newPassword)) {
      this.showToast(
        'error', 
        'Weak Password', 
        'Password must contain at least 6 characters, including uppercase, lowercase, a number, and a special character.'
      );
      return;
    }

    // 🚀 Validation Passed - Proceed to Backend
    this.isProcessing = true;

    this.authService.confirmResetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.showToast('success', 'Success', 'Password has been reset. Please login with your new credentials.');
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.isProcessing = false;
        const msg = err.error?.message || 'Link may have expired or is invalid.';
        this.showToast('error', 'Reset Failed', msg);
      },
    });
  }

  /**
   * 🛠️ Helper: Centralized Toast logic
   */
  private showToast(severity: string, summary: string, detail: string): void {
    this.messageService.add({ severity, summary, detail });
  }
}