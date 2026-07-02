import {
  Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { CustomerOnboardModalComponent } from '../../../shared/components/modals/customer-onboard-modal/customer-onboard-modal.component';

@Component({
  selector: 'app-branch-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, LoadingSkeletonComponent, CustomerOnboardModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Customers</h1>
      <p class="text-sm text-slate-400 mt-0.5">All customers at this branch</p>
    </div>
    <ng-container *appHasPermission="['customers', 'create']">
      <button type="button" (click)="showCreateModal = true"
              class="btn-primary px-4 py-2 text-sm gap-2">
        <i class="pi pi-user-plus text-xs"></i> New Customer
      </button>
    </ng-container>
  </div>

  <!-- Search & filters -->
  <div class="card p-4">
    <div class="relative">
      <i class="pi pi-search absolute left-3.5 pointer-events-none z-10 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
             placeholder="Search by name, phone, CIF or document..."
             style="padding-left: 2.5rem !important" class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
  </div>

  <!-- Loading -->
  <div *ngIf="isLoading && customers.length === 0">
    <app-loading-skeleton [lines]="6"></app-loading-skeleton>
  </div>

  <!-- Empty state -->
  <div *ngIf="!isLoading && customers.length === 0" class="card p-12 text-center">
    <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
      <i class="pi pi-users text-2xl text-slate-400"></i>
    </div>
    <p class="font-bold text-slate-700 dark:text-slate-300">No customers found</p>
    <p class="text-sm text-slate-400 mt-1">{{ searchQuery ? 'Try a different search term' : 'No customers are registered at this branch yet' }}</p>
  </div>

  <!-- Customer list -->
  <div *ngIf="customers.length > 0" class="card overflow-hidden">
    <table class="w-full data-table">
      <thead>
        <tr>
          <th>Customer</th>
          <th>CIF / KYC</th>
          <th>Contact</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let c of customers"
            (click)="navigate(c)"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">

          <td>
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
                {{ c.firstName?.charAt(0) }}{{ c.lastName?.charAt(0) }}
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">
                  {{ c.title ? c.title + ' ' : '' }}{{ c.firstName }} {{ c.lastName }}
                </p>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      [class.bg-blue-100]="c.customerCategory === 'PUBLIC_SECTOR'"
                      [class.text-blue-700]="c.customerCategory === 'PUBLIC_SECTOR'"
                      [class.bg-slate-100]="c.customerCategory !== 'PUBLIC_SECTOR'"
                      [class.text-slate-600]="c.customerCategory !== 'PUBLIC_SECTOR'">
                  {{ c.customerCategory || 'GENERAL' }}
                </span>
              </div>
            </div>
          </td>

          <td>
            <p class="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{{ c.customerNumber }}</p>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 inline-block"
                  [class.bg-emerald-100]="c.kycStatus === 'VERIFIED'"
                  [class.text-emerald-700]="c.kycStatus === 'VERIFIED'"
                  [class.bg-amber-100]="c.kycStatus === 'PENDING'"
                  [class.text-amber-700]="c.kycStatus === 'PENDING'"
                  [class.bg-red-100]="c.kycStatus === 'REJECTED'"
                  [class.text-red-700]="c.kycStatus === 'REJECTED'"
                  [class.bg-slate-100]="!['VERIFIED','PENDING','REJECTED'].includes(c.kycStatus)"
                  [class.text-slate-500]="!['VERIFIED','PENDING','REJECTED'].includes(c.kycStatus)">
              {{ c.kycStatus }}
            </span>
          </td>

          <td>
            <div class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <i class="pi pi-phone text-[10px] opacity-50"></i>
              <span class="font-mono">{{ c.phoneNumber }}</span>
            </div>
            <div *ngIf="c.email" class="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <i class="pi pi-envelope text-[10px] opacity-50"></i>
              <span class="truncate max-w-[160px]">{{ c.email }}</span>
            </div>
          </td>

          <td>
            <span class="badge" [class.badge-green]="c.isActive" [class.badge-red]="!c.isActive">
              {{ c.isActive ? 'Active' : 'Suspended' }}
            </span>
          </td>

          <td class="text-right">
            <button class="h-8 w-8 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors">
              <i class="pi pi-chevron-right text-xs"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Load more -->
    <div *ngIf="hasMore" class="flex justify-center px-5 py-3 border-t border-slate-100 dark:border-slate-800">
      <button type="button" (click)="loadMore()" [disabled]="isLoading"
              class="btn-secondary px-5 py-2 text-sm gap-2">
        <i *ngIf="isLoading" class="pi pi-spin pi-spinner text-xs"></i>
        Load more
      </button>
    </div>
  </div>

</div>

<!-- New customer modal -->
<ng-container *appHasPermission="['customers', 'create']">
  <app-customer-onboard-modal
    [(visible)]="showCreateModal"
    [bankId]="bankId"
    [branchId]="branchId"
    (onCustomerCreated)="handleCreated($event)">
  </app-customer-onboard-modal>
</ng-container>
  `,
})
export class BranchCustomersComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private http        = inject(HttpClient);
  readonly cdr        = inject(ChangeDetectorRef);
  readonly router     = inject(Router);
  private destroy$    = new Subject<void>();
  private searchTimer: any;

  bankId   = '';
  branchId = '';

  customers: any[] = [];
  isLoading  = false;
  hasMore     = false;
  offset      = 0;
  readonly limit = 20;
  searchQuery = '';

  showCreateModal = false;

  ngOnInit() {
    const p = this.authService.getUserProfile();
    this.bankId   = p?.bankId   || '';
    this.branchId = p?.branchId || '';
    this.fetch();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); clearTimeout(this.searchTimer); }

  fetch(loadMore = false) {
    if (!loadMore) { this.offset = 0; this.customers = []; }
    this.isLoading = true;
    this.cdr.detectChanges();

    const params = new HttpParams()
      .set('limit', this.limit)
      .set('offset', this.offset)
      .set('search', this.searchQuery);

    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => {
        const data = r.data ?? r ?? [];
        this.customers = loadMore ? [...this.customers, ...data] : data;
        this.offset += data.length;
        this.hasMore = data.length === this.limit;
        this.cdr.detectChanges();
      }});
  }

  onSearch(q: string) {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.fetch(), 350);
  }

  loadMore() { this.fetch(true); }

  navigate(c: any) {
    this.router.navigate(['/branch', 'customers', c.id], {
      queryParams: { bankId: this.bankId, branchId: this.branchId }
    });
  }

  handleCreated(c: any) { this.customers.unshift(c); this.cdr.detectChanges(); }
}
