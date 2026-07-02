import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonComponent } from '../../../shared/components/modals/button/button.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { RoleOnboardModalComponent } from '../../../shared/components/modals/role-onboard-modal/role-onboard-modal.component';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, TableModule,
    ButtonComponent, HasPermissionDirective,
    RoleOnboardModalComponent, LoadingSkeletonComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Roles & Permissions</h1>
      <p class="text-sm text-slate-400 mt-0.5">
        Manage system roles and custom bank roles. Click a role to view and edit its permission matrix.
      </p>
    </div>
    <ng-container *appHasPermission="['roles', 'create']">
      <button type="button" (click)="showRoleModal = true"
              class="btn-primary px-4 py-2 text-sm gap-2 shrink-0">
        <i class="pi pi-plus text-xs"></i> New Role
      </button>
    </ng-container>
  </div>

  <!-- Search + filter strip -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3 items-center">
    <!-- Search -->
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
             placeholder="Search roles by name or slug..."
             style="padding-left: 2.5rem !important"
             class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
    <!-- Scope filter -->
    <div class="flex gap-1 shrink-0">
      <button *ngFor="let f of scopeFilters" type="button"
              (click)="activeScope = f.value; cdr.detectChanges()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeScope === f.value"
              [class.text-white]="activeScope === f.value"
              [class.bg-slate-100]="activeScope !== f.value"
              [class.dark:bg-slate-800]="activeScope !== f.value"
              [class.text-slate-500]="activeScope !== f.value">
        {{ f.label }}
      </button>
    </div>
  </div>

  <!-- Loading -->
  <app-loading-skeleton *ngIf="isLoading && roles.length === 0" [lines]="6"></app-loading-skeleton>

  <!-- Table -->
  <div *ngIf="roles.length > 0 || (!isLoading && roles.length === 0)" class="card overflow-hidden">
    <table class="w-full [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-slate-400 [&_th]:py-3 [&_th]:px-5 [&_th]:bg-slate-50/80 [&_th]:dark:bg-slate-800/60 [&_th]:border-b [&_th]:border-slate-100 [&_th]:dark:border-slate-800 [&_td]:py-3.5 [&_td]:px-5 [&_td]:border-b [&_td]:border-slate-100/70 [&_td]:dark:border-slate-800/70">
      <thead>
        <tr>
          <th>Role</th>
          <th>Scope / Bank</th>
          <th>Type</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let role of filteredRoles()"
            (click)="navigate(role)"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">

          <!-- Role identity -->
          <td>
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                   [class.bg-purple-100]="role.bankId === null"
                   [class.dark:bg-purple-900\/30]="role.bankId === null"
                   [class.bg-blue-100]="role.bankId !== null"
                   [class.dark:bg-blue-900\/30]="role.bankId !== null">
                <i class="pi text-sm"
                   [class.pi-globe]="role.bankId === null"
                   [class.text-purple-600]="role.bankId === null"
                   [class.dark:text-purple-400]="role.bankId === null"
                   [class.pi-key]="role.bankId !== null"
                   [class.text-blue-600]="role.bankId !== null"
                   [class.dark:text-blue-400]="role.bankId !== null"></i>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">{{ role.name }}</p>
                <p class="text-[10px] font-mono text-slate-400 mt-0.5">{{ role.role }}</p>
              </div>
            </div>
          </td>

          <!-- Scope: bank name or System -->
          <td>
            <div *ngIf="role.bankId === null"
                 class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider">
              <i class="pi pi-globe text-[9px]"></i> System
            </div>
            <div *ngIf="role.bankId !== null"
                 class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wider">
              <i class="pi pi-building-columns text-[9px]"></i>
              {{ role.bank?.name || role.bankId | slice:0:8 }}
            </div>
          </td>

          <!-- Type badge -->
          <td>
            <span class="badge"
                  [class.badge-purple]="role.isSystemRole"
                  [class.badge-blue]="!role.isSystemRole">
              <i *ngIf="role.isSystemRole" class="pi pi-lock text-[9px]"></i>
              {{ role.isSystemRole ? 'System' : 'Custom' }}
            </span>
          </td>

          <!-- Status toggle -->
          <td (click)="$event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <ng-container *appHasPermission="['roles', 'update']">
                <button type="button" (click)="toggleStatus(role)" [disabled]="role.isUpdating"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60"
                        [class.bg-green-500]="role.isActive" [class.dark:bg-green-600]="role.isActive"
                        [class.bg-slate-300]="!role.isActive" [class.dark:bg-slate-700]="!role.isActive">
                  <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200"
                        [class.translate-x-4]="role.isActive" [class.translate-x-0]="!role.isActive">
                    <i *ngIf="role.isUpdating" class="pi pi-spinner pi-spin text-[8px] text-primary-600"></i>
                  </span>
                </button>
              </ng-container>
              <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                    [class.text-green-600]="role.isActive" [class.dark:text-green-400]="role.isActive"
                    [class.text-slate-400]="!role.isActive">
                {{ role.isActive ? 'Active' : 'Inactive' }}
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

        <!-- Empty state inside tbody -->
        <tr *ngIf="!isLoading && roles.length === 0">
          <td colspan="5" class="py-16 text-center">
            <div class="w-14 h-14 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
              <i class="pi pi-shield text-xl text-slate-400"></i>
            </div>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-300">No roles found</p>
            <p class="text-xs text-slate-400 mt-1">{{ searchQuery ? 'Try a different search term' : 'Create the first role using the button above' }}</p>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- (No load more needed — all roles loaded at once) -->
  </div>

</div>

<!-- Create Role modal — bankId is empty for super admin (creates system role) -->
<ng-container *appHasPermission="['roles', 'create']">
  <app-role-onboard-modal
    [(visible)]="showRoleModal"
    [bankId]="createBankId"
    (onRoleCreated)="handleCreated($event)">
  </app-role-onboard-modal>
</ng-container>
  `,
})
export class RolesComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private router  = inject(Router);
  private msg     = inject(MessageService);
  readonly cdr    = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  roles: any[]  = [];
  isLoading     = false;
  hasMore       = false;

  searchQuery  = '';
  activeScope  = 'ALL';
  showRoleModal = false;
  createBankId  = '';  // empty string = super admin creates a system-level role

  readonly scopeFilters = [
    { label: 'All', value: 'ALL' },
    { label: 'System', value: 'SYSTEM' },
    { label: 'Custom', value: 'CUSTOM' },
  ];

  ngOnInit() {
    this.fetch();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  fetch() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.http.get<any>('/roles')
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (r) => { this.roles = r.data ?? r ?? []; this.cdr.detectChanges(); },
        error: () => this.cdr.detectChanges(),
      });
  }

  filteredRoles(): any[] {
    let list = this.roles;
    // Apply scope filter
    if (this.activeScope === 'SYSTEM') list = list.filter(r => r.bankId === null);
    else if (this.activeScope === 'CUSTOM') list = list.filter(r => r.bankId !== null);
    // Apply search filter (client-side, case-insensitive)
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.role?.toLowerCase().includes(q) ||
        r.bank?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }

  onSearch(_q: string) { this.cdr.detectChanges(); }

  navigate(role: any) {
    // Navigate to role detail — pass bankId so back-navigation works correctly
    const bankId = role.bankId || '';
    if (bankId) {
      this.router.navigate(['/banks', bankId, 'roles', role.id]);
    } else {
      // System role — use a generic detail path (we'll add a /roles/:id route)
      this.router.navigate(['/roles', role.id]);
    }
  }

  toggleStatus(role: any) {
    role.isUpdating = true;
    this.cdr.detectChanges();
    this.http.patch(`/roles/${role.id}/status`, { isActive: !role.isActive })
      .pipe(takeUntil(this.destroy$), finalize(() => { role.isUpdating = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          role.isActive = !role.isActive;
          this.msg.add({ severity: 'success', summary: 'Updated', detail: `${role.name} ${role.isActive ? 'activated' : 'deactivated'}.` });
          this.cdr.detectChanges();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  handleCreated(role: any) {
    this.roles.unshift(role);
    this.cdr.detectChanges();
  }
}
