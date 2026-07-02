import { Component, inject, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../features/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private http        = inject(HttpClient);
  private cdr         = inject(ChangeDetectorRef);

  currentUser: any = null;
  userInitials = '??';
  isDark = false;

  /** Branch details — shown in header for branch-scoped users */
  branchName    = '';
  branchIfsc    = '';
  branchCity    = '';
  isBranchUser  = false;

  ngOnInit() {
    this.currentUser = this.authService.getUserProfile();
    if (this.currentUser) {
      const f = this.currentUser.firstName || '';
      const l = this.currentUser.lastName  || '';
      this.userInitials = f && l
        ? (f[0] + l[0]).toUpperCase()
        : (this.currentUser.fullName || '??').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

      // Load branch info if the user is branch-scoped
      this.isBranchUser = !!(this.currentUser.bankId && this.currentUser.branchId);
      if (this.isBranchUser) {
        this.loadBranch(this.currentUser.bankId, this.currentUser.branchId);
      }
    }
    this.authService.isDarkMode$.subscribe(v => { this.isDark = v; this.cdr.markForCheck(); });
  }

  private loadBranch(bankId: string, branchId: string) {
    this.http.get<any>(`/banks/${bankId}/branches/${branchId}`)
      .subscribe({
        next: (res) => {
          const b = res.data ?? res;
          this.branchName = b.name || '';
          this.branchIfsc = b.ifsc || '';
          this.branchCity = b.city || '';
          this.cdr.markForCheck();
        },
      });
  }

  toggleTheme() { this.authService.setThemeState(!this.isDark); }
  goToProfile()  { this.router.navigate(['/profile']); }
}
