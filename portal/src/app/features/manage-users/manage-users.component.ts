import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { UserOnboardModalComponent } from '../../shared/components/modals/user-onboard-modal/user-onboard-modal.component';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    HasPermissionDirective, LoadingSkeletonComponent, UserOnboardModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Manage Users</h1>
      <p class="text-sm text-slate-400 mt-0.5">
        <ng-container *ngIf="scopeLabel">{{ scopeLabel }} ·&nbsp;</ng-container>
        All users you have permission to manage
      </p>
    </div>
    <ng-container *appHasPermission="['users', 'create']">
      <button type="button" (click)="showCreateModal = true"
              class="btn-primary px-4 py-2 text-sm gap-2 shrink-0">
        <i class="pi pi-user-plus text-xs"></i> New User
      </button>
    </ng-container>
  </div>

  <!-- Search + status filter -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3 items-center">
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="onSearch()"
             placeholder="Search by name, email or username..."
             style="padding-left: 2.5rem !important"
             class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
    <div class="flex gap-1 shrink-0">
      <button *ngFor="let f of statusFilters" type="button"
              (click)="activeStatus = f.value; fetch()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeStatus === f.value" [class.text-white]="activeStatus === f.value"
              [class.bg-slate-100]="activeStatus !== f.value" [class.dark:bg-slate-800]="activeStatus !== f.value"
              [class.text-slate-500]="activeStatus !== f.value">
        {{ f.label }}
      </button>
    </div>
  </div>

  <!-- Loading -->
  <app-loading-skeleton *ngIf="isLoading && users.length === 0" [lines]="6"></app-loading-skeleton>

  <!-- Table -->
  <div *ngIf="users.length > 0 || (!isLoading)" class="card overflow-hidden">
    <table class="w-full data-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Username</th>
          <th>Contact</th>
          <th>Bank / Branch</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <!-- Empty state -->
        <tr *ngIf="!isLoading && users.length === 0">
          <td colspan="6" class="py-16 text-center">
            <div class="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
              <i class="pi pi-users text-xl text-slate-400"></i>
            </div>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-300">No users found</p>
            <p class="text-xs text-slate-400 mt-1">{{ searchQuery ? 'Try a different search' : 'No users have been created yet' }}</p>
          </td>
        </tr>

        <tr *ngFor="let u of users"
            (click)="navigate(u)"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">

          <!-- Name + role -->
          <td>
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
                {{ u.firstName?.charAt(0) }}{{ u.lastName?.charAt(0) }}
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">{{ u.firstName }} {{ u.lastName }}</p>
                <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {{ u.role?.name || u.roleType || '—' }}
                </span>
              </div>
            </div>
          </td>

          <!-- Username -->
          <td>
            <span class="font-mono text-xs font-bold text-slate-700 dark:text-slate-300
                         bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded select-all">
              {{ u.username || '—' }}
            </span>
          </td>

          <!-- Contact -->
          <td>
            <div class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <i class="pi pi-envelope text-[10px] opacity-50"></i>
              <span class="truncate max-w-[180px]">{{ u.email || '—' }}</span>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <i class="pi pi-phone text-[10px] opacity-50"></i>
              <span class="font-mono">{{ u.phoneNumber || '—' }}</span>
            </div>
          </td>

          <!-- Bank / Branch scope -->
          <td>
            <div *ngIf="u.bank?.name" class="text-xs font-semibold text-slate-700 dark:text-slate-300">
              <i class="pi pi-building-columns text-[10px] text-slate-400 mr-1"></i>{{ u.bank.name }}
            </div>
            <div *ngIf="u.branch?.name" class="text-[10px] text-slate-400 mt-0.5">
              <i class="pi pi-sitemap text-[9px] mr-1"></i>{{ u.branch.name }}
            </div>
            <span *ngIf="!u.bank?.name && !u.branch?.name" class="badge badge-purple text-[10px]">System</span>
          </td>

          <!-- Status toggle -->
          <td (click)="$event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <ng-container *appHasPermission="['users', 'update']">
                <button type="button" (click)="toggleStatus(u)" [disabled]="u.isUpdating"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                               transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60"
                        [class.bg-green-500]="u.isActive" [class.dark:bg-green-600]="u.isActive"
                        [class.bg-slate-300]="!u.isActive" [class.dark:bg-slate-700]="!u.isActive">
                  <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow
                               flex items-center justify-center transition-transform duration-200"
                        [class.translate-x-4]="u.isActive" [class.translate-x-0]="!u.isActive">
                    <i *ngIf="u.isUpdating" class="pi pi-spinner pi-spin text-[8px] text-primary-600"></i>
                  </span>
                </button>
              </ng-container>
              <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                    [class.text-green-600]="u.isActive" [class.dark:text-green-400]="u.isActive"
                    [class.text-slate-400]="!u.isActive">
                {{ u.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </td>

          <!-- Chevron -->
          <td class="text-right">
            <button class="h-8 w-8 text-slate-400 group-hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors">
              <i class="pi pi-chevron-right text-xs"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Load more -->
    <div *ngIf="hasMore" class="flex justify-center px-5 py-3 border-t border-slate-100 dark:border-slate-800">
      <button type="button" (click)="fetch(true)" [disabled]="isLoading"
              class="btn-secondary px-5 py-2 text-sm gap-2">
        <i *ngIf="isLoading" class="pi pi-spin pi-spinner text-xs"></i>
        Load more
      </button>
    </div>
  </div>

</div>

<!-- New User modal — bank/branch pre-filled from JWT, editable for super admin -->
<ng-container *appHasPermission="['users', 'create']">
  <app-user-onboard-modal
    [(visible)]="showCreateModal"
    [bankId]="myBankId"
    [branchId]="myBranchId"
    (onUserCreated)="handleCreated($event)">
  </app-user-onboard-modal>
</ng-container>
  `,
})
export class ManageUsersComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private http        = inject(HttpClient);
  readonly cdr        = inject(ChangeDetectorRef);
  readonly router     = inject(Router);
  private destroy$    = new Subject<void>();
  private searchTimer: any;

  // Scope from JWT — pre-fills the modal; SUPER_ADMIN has no bankId → modal is fully editable
  myBankId   = '';
  myBranchId = '';
  scopeLabel = '';

  users: any[]  = [];
  isLoading     = false;
  hasMore       = false;
  offset        = 0;
  readonly limit = 20;

  searchQuery   = '';
  activeStatus  = 'ALL';
  showCreateModal = false;

  readonly statusFilters = [
    { label: 'All',      value: 'ALL'    },
    { label: 'Active',   value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  ngOnInit() {
    const profile = this.authService.getUserProfile();
    this.myBankId   = profile?.bankId   || '';
    this.myBranchId = profile?.branchId || '';

    // Build scope label for the subtitle
    if (this.myBranchId) this.scopeLabel = 'Branch scope';
    else if (this.myBankId) this.scopeLabel = 'Bank scope';
    else this.scopeLabel = '';  // super admin — no scope restriction shown

    this.fetch();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); clearTimeout(this.searchTimer); }

  fetch(more = false) {
    if (!more) { this.offset = 0; this.users = []; }
    this.isLoading = true;
    this.cdr.detectChanges();

    let params = new HttpParams()
      .set('search', this.searchQuery)
      .set('limit', this.limit)
      .set('offset', this.offset);

    if (this.activeStatus === 'active')   params = params.set('isActive', 'true');
    if (this.activeStatus === 'inactive') params = params.set('isActive', 'false');

    // The API automatically scopes by the requester's bankId — super admin sees all
    this.http.get<any>('/users', { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (r) => {
          const data = r.data ?? r ?? [];
          this.users   = more ? [...this.users, ...data] : data;
          this.offset += data.length;
          this.hasMore  = data.length === this.limit;
          this.cdr.detectChanges();
        },
        error: () => this.cdr.detectChanges(),
      });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.fetch(), 350);
  }

  toggleStatus(u: any) {
    u.isUpdating = true;
    this.cdr.detectChanges();
    this.http.patch(`/users/${u.id}/status`, { isActive: !u.isActive })
      .pipe(takeUntil(this.destroy$), finalize(() => { u.isUpdating = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => { u.isActive = !u.isActive; this.cdr.detectChanges(); },
        error: () => this.cdr.detectChanges(),
      });
  }

  navigate(u: any) {
    // Navigate to the existing admin-detail page with the correct bank/branch context
    const bankId   = u.bankId   || this.myBankId   || '';
    const branchId = u.branchId || this.myBranchId || '';
    if (branchId && bankId) {
      this.router.navigate(['/banks', bankId, 'branches', branchId, 'staff', u.id]);
    } else if (bankId) {
      this.router.navigate(['/banks', bankId, 'admins', u.id]);
    } else {
      // System-level user (super admin) — use generic admin path with no bankId
      this.router.navigate(['/users', u.id]);
    }
  }

  handleCreated(u: any) {
    this.users.unshift(u);
    this.cdr.detectChanges();
  }
}
