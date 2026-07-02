import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="min-h-[75vh] flex flex-col items-center justify-center gap-6 px-4 animate-fade-in-up">

  <!-- Icon -->
  <div class="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
    <i class="pi pi-lock text-4xl text-red-500 dark:text-red-400"></i>
  </div>

  <!-- Message -->
  <div class="text-center max-w-md">
    <h1 class="text-2xl font-black text-slate-900 dark:text-white mb-2">Access Denied</h1>
    <p class="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
      You do not have permission to access
      <span *ngIf="resourceLabel" class="font-semibold text-slate-700 dark:text-slate-300">
        <strong>{{ resourceLabel }}</strong>
      </span>
      <span *ngIf="!resourceLabel">this section</span>.
    </p>
    <p class="text-slate-400 dark:text-slate-500 text-xs mt-2">
      If you believe this is a mistake, contact your administrator to update your role permissions.
    </p>
  </div>

  <!-- Action buttons -->
  <div class="flex items-center gap-3">
    <button type="button" (click)="goBack()"
            class="btn-secondary px-5 py-2.5 text-sm gap-2">
      <i class="pi pi-arrow-left text-xs"></i> Go Back
    </button>
    <a [routerLink]="['/dashboard']" class="btn-primary px-5 py-2.5 text-sm gap-2">
      <i class="pi pi-home text-xs"></i> Dashboard
    </a>
  </div>

</div>
  `,
})
export class UnauthorizedComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private auth   = inject(AuthService);

  resource      = '';
  action        = '';
  resourceLabel = '';

  // Human-readable labels for known resources
  private readonly labels: Record<string, string> = {
    banks:             'Bank Management',
    branches:          'Branch Management',
    customers:         'Customer Directory',
    users:             'Staff & Users',
    loans:             'Loans',
    'loan-products':   'Loan Products',
    accounting:        'Accounting / Accounts',
    'account-products':'Account Products',
    roles:             'Role Management',
    'master-data':     'Master Data',
    geography:         'Geography',
    currencies:        'Currencies',
    audit:             'Audit Logs',
    reports:           'Reports',
    'global-settings': 'Global Settings',
    dashboard:         'Dashboard',
  };

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.resource      = params['resource'] || '';
      this.action        = params['action']   || 'read';
      this.resourceLabel = this.labels[this.resource] || this.resource;
    });
  }

  goBack() {
    window.history.back();
  }
}
