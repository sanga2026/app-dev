import {
  Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { CustomerSearchModalComponent } from '../quick-actions/customer-search-modal.component';
import { QuickTransactionModalComponent, TxnType } from '../quick-actions/quick-transaction-modal.component';
import { CustomerOnboardModalComponent } from '../../../shared/components/modals/customer-onboard-modal/customer-onboard-modal.component';
import { CustomerAccountsComponent } from '../../super-admin/banks/branch-detail/customer-detail/customer-accounts.component';

@Component({
  selector: 'app-branch-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, HasPermissionDirective,
    CustomerSearchModalComponent, QuickTransactionModalComponent,
    CustomerOnboardModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-6 animate-fade-in-up">

  <!-- ── Operations Header ── -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Branch Operations</h1>
      <p class="text-sm text-slate-400 mt-0.5">All tools and actions for your daily work</p>
    </div>
    <div class="flex items-center gap-2 text-xs text-slate-400 font-semibold">
      <i class="pi pi-calendar text-[11px]"></i>
      {{ today | date:'EEEE, d MMMM yyyy' }}
    </div>
  </div>

  <!-- ── Stats ── -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <!-- Skeleton while loading -->
    <ng-container *ngIf="loadingStats()">
      <div *ngFor="let _ of [1,2,3,4]"
           class="card p-5 animate-pulse">
        <div class="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-3"></div>
        <div class="h-8 w-16 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2"></div>
        <div class="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded"></div>
      </div>
    </ng-container>
    <!-- Loaded stats -->
    <ng-container *ngIf="!loadingStats()">
      <div *ngFor="let stat of statCards(); let i = index"
           (click)="stat.route && router.navigate(stat.route)"
           class="card p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-fade-in-up"
           [class.cursor-pointer]="stat.route"
           [style.animation-delay]="(i * 70) + 'ms'">
        <div class="flex items-center justify-between">
          <div class="w-11 h-11 rounded-2xl flex items-center justify-center" [class]="stat.iconBg">
            <i class="pi text-xl" [class]="stat.icon + ' ' + stat.iconColor"></i>
          </div>
          <span *ngIf="stat.urgent && stat.value > 0"
                class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
            !</span>
        </div>
        <div>
          <p class="text-3xl font-black text-slate-900 dark:text-white leading-none">{{ stat.value }}</p>
          <p class="text-xs font-semibold text-slate-400 mt-1">{{ stat.label }}</p>
        </div>
      </div>
    </ng-container>
  </div>

  <!-- ── Quick Actions — operational tasks ── -->
  <div>
    <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Quick Actions</p>
    <div class="grid grid-cols-3 md:grid-cols-6 gap-3">

      <ng-container *appHasPermission="['customers', 'create']">
        <button type="button" (click)="showNewCustomer = true"
                class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-900/10 hover:from-primary-100 hover:to-primary-50 animate-fade-in-up"
                style="animation-delay:0ms">
          <div class="w-12 h-12 rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/30 flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-primary-500/50">
            <i class="pi pi-user-plus text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">New Customer</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Onboard</p>
          </div>
        </button>
      </ng-container>

      <ng-container *appHasPermission="['accounting', 'create']">
        <button type="button" (click)="openAccountSearch()"
                class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-900/10 hover:from-violet-100 animate-fade-in-up"
                style="animation-delay:60ms">
          <div class="w-12 h-12 rounded-2xl bg-violet-500 shadow-lg shadow-violet-500/30 flex items-center justify-center transition-all group-hover:scale-110">
            <i class="pi pi-wallet text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">Open Account</p>
            <p class="text-[10px] text-slate-400 mt-0.5">New account</p>
          </div>
        </button>
      </ng-container>

      <ng-container *appHasPermission="['accounting', 'create']">
        <button type="button" (click)="openTxnModal('CREDIT')"
                class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 hover:from-emerald-100 animate-fade-in-up"
                style="animation-delay:120ms">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all group-hover:scale-110">
            <i class="pi pi-arrow-up text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">Credit</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Deposit cash</p>
          </div>
        </button>
      </ng-container>

      <ng-container *appHasPermission="['accounting', 'create']">
        <button type="button" (click)="openTxnModal('DEBIT')"
                class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10 hover:from-red-100 animate-fade-in-up"
                style="animation-delay:180ms">
          <div class="w-12 h-12 rounded-2xl bg-red-500 shadow-lg shadow-red-500/30 flex items-center justify-center transition-all group-hover:scale-110">
            <i class="pi pi-arrow-down text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">Debit</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Withdrawal</p>
          </div>
        </button>
      </ng-container>

      <ng-container *appHasPermission="['customers', 'read']">
        <button type="button" (click)="showSearch = true"
                class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 hover:from-blue-100 animate-fade-in-up"
                style="animation-delay:240ms">
          <div class="w-12 h-12 rounded-2xl bg-blue-500 shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all group-hover:scale-110">
            <i class="pi pi-search text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">Find Customer</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Search CIF</p>
          </div>
        </button>
      </ng-container>

      <ng-container *appHasPermission="['customers', 'read']">
        <a [routerLink]="['/branch', 'customers']"
           class="group card p-4 flex flex-col items-center gap-2.5 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer text-center border-0 bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 hover:from-amber-100 animate-fade-in-up no-underline"
           style="animation-delay:300ms">
          <div class="w-12 h-12 rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all group-hover:scale-110">
            <i class="pi pi-users text-white text-xl"></i>
          </div>
          <div>
            <p class="text-xs font-black text-slate-800 dark:text-slate-200">All Customers</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Browse list</p>
          </div>
        </a>
      </ng-container>

    </div>
  </div>

  <!-- ── Two-column layout: Recent Customers + KYC Status ── -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

    <!-- Recent Customers -->
    <div *ngIf="authService.hasPermission('customers','read')" class="card overflow-hidden animate-fade-in-up">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <i class="pi pi-id-card text-violet-600 dark:text-violet-400 text-sm"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">Recent Customers</p>
            <p class="text-[11px] text-slate-400">Latest onboarded</p>
          </div>
        </div>
        <a [routerLink]="['/branch','customers']" class="text-xs font-semibold text-primary-600 hover:underline">View all →</a>
      </div>
      <div *ngIf="loadingStats()" class="p-4 space-y-3">
        <div *ngFor="let _ of [1,2,3]" class="h-11 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
      <div *ngIf="!loadingStats() && recentCustomers.length === 0" class="p-8 text-center text-slate-400">
        <i class="pi pi-users text-2xl mb-2 block text-slate-300"></i>
        <p class="text-sm">No customers yet</p>
      </div>
      <div class="divide-y divide-slate-100 dark:divide-slate-800">
        <div *ngFor="let c of recentCustomers"
             (click)="navigateCustomer(c)"
             class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
            {{ c.firstName?.charAt(0) }}{{ c.lastName?.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ c.firstName }} {{ c.lastName }}</p>
            <p class="text-[10px] font-mono text-slate-400">{{ c.customerNumber }}</p>
          </div>
          <i class="pi pi-chevron-right text-xs text-slate-300 group-hover:text-primary-500 transition-colors shrink-0"></i>
        </div>
      </div>
    </div>

    <!-- KYC Status breakdown -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center gap-2 mb-5">
        <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
          <i class="pi pi-shield-check text-emerald-600 dark:text-emerald-400 text-sm"></i>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-white">KYC Overview</p>
          <p class="text-[11px] text-slate-400">Customer verification status</p>
        </div>
      </div>
      <div *ngIf="loadingStats()" class="space-y-3">
        <div *ngFor="let _ of [1,2,3]" class="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
      <div *ngIf="!loadingStats()" class="space-y-3">
        <div *ngFor="let k of kycItems()" class="group">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" [class]="k.dot"></span>
              <span class="font-semibold text-slate-600 dark:text-slate-400">{{ k.label }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-black text-slate-900 dark:text-white">{{ k.count }}</span>
              <span class="text-slate-400 text-[10px] w-8 text-right">{{ k.pct | number:'1.0-0' }}%</span>
            </div>
          </div>
          <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700 ease-out" [class]="k.bar" [style.width]="k.pct + '%'"></div>
          </div>
        </div>
        <div *ngIf="kycItems().length === 0" class="text-center py-4 text-slate-400 text-sm">
          No KYC data available yet
        </div>
      </div>
    </div>

  </div>

  <!-- ── Pending approvals alert ── -->
  <div *ngIf="!loadingStats() && pendingCount > 0"
       class="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5 animate-fade-in-up">
    <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
      <i class="pi pi-exclamation-triangle text-amber-600 dark:text-amber-400 text-lg"></i>
    </div>
    <div class="flex-1">
      <p class="font-bold text-amber-900 dark:text-amber-300">
        {{ pendingCount }} pending approval{{ pendingCount !== 1 ? 's' : '' }} need your attention
      </p>
      <p class="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
        Review and process pending loan applications before end of day.
      </p>
    </div>
    <button type="button" class="btn-secondary px-4 py-2 text-sm shrink-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
      Review
    </button>
  </div>

</div>

<!-- Modals -->
<app-customer-search-modal
  [(visible)]="showSearch"
  [bankId]="bankId" [branchId]="branchId">
</app-customer-search-modal>

<app-quick-transaction-modal
  [(visible)]="showTxnModal"
  [txnType]="activeTxnType"
  [bankId]="bankId" [branchId]="branchId"
  (transactionPosted)="onTxnPosted()">
</app-quick-transaction-modal>

<ng-container *appHasPermission="['customers', 'create']">
  <app-customer-onboard-modal
    [(visible)]="showNewCustomer"
    [bankId]="bankId" [branchId]="branchId"
    (onCustomerCreated)="onCustomerCreated()">
  </app-customer-onboard-modal>
</ng-container>
  `,
})
export class BranchDashboardComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private http         = inject(HttpClient);
  readonly cdr         = inject(ChangeDetectorRef);
  readonly router      = inject(Router);
  private destroy$     = new Subject<void>();

  bankId   = '';
  branchId = '';
  today    = new Date();

  loadingStats    = signal(true);
  loadingActivity = signal(false);

  dashData: any        = null;
  recentCustomers: any[] = [];
  recentActivity: any[]  = [];
  pendingCount = 0;

  showSearch      = false;
  showTxnModal    = false;
  activeTxnType: TxnType = 'CREDIT';
  showNewCustomer = false;

  ngOnInit() {
    const p = this.authService.getUserProfile();
    this.bankId   = p?.bankId   || '';
    this.branchId = p?.branchId || '';
    if (!this.bankId || !this.branchId) return;
    this.loadStats();
    this.loadRecentCustomers();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadStats() {
    this.loadingStats.set(true);
    this.http.get<any>('/dashboard/stats')
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingStats.set(false); this.cdr.detectChanges(); }))
      .subscribe({ next: (d) => { this.dashData = d; this.pendingCount = d.pendingApprovals ?? 0; this.cdr.detectChanges(); } });
  }

  loadRecentCustomers() {
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers?limit=5`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => { this.recentCustomers = r.data ?? r ?? []; this.cdr.detectChanges(); } });
  }

  statCards(): any[] {
    const d = this.dashData;
    return [
      { label:'Total Customers',   value: d?.totalCustomers    ?? '—', icon:'pi-id-card', iconBg:'bg-blue-50 dark:bg-blue-900/20',    iconColor:'text-blue-600 dark:text-blue-400',   route:['/branch','customers'] },
      { label:'Active Accounts',   value: d?.totalAccounts     ?? '—', icon:'pi-wallet',  iconBg:'bg-violet-50 dark:bg-violet-900/20', iconColor:'text-violet-600 dark:text-violet-400',route:['/branch','accounts']  },
      { label:'Pending Approvals', value: d?.pendingApprovals  ?? '—', icon:'pi-clock',   iconBg:'bg-amber-50 dark:bg-amber-900/20',  iconColor:'text-amber-600 dark:text-amber-400',  urgent: (d?.pendingApprovals ?? 0) > 0 },
      { label:'Loans',             value: d?.totalLoans        ?? '—', icon:'pi-file',    iconBg:'bg-emerald-50 dark:bg-emerald-900/20',iconColor:'text-emerald-600 dark:text-emerald-400' },
    ];
  }

  kycItems(): any[] {
    const kyc = this.dashData?.kycBreakdown;
    if (!kyc) return [];
    const total = Object.values(kyc).reduce((a:any,b:any)=>a+b,0) as number;
    const cfg: Record<string,any> = {
      VERIFIED:    { label:'Verified',    dot:'bg-emerald-500', bar:'bg-emerald-400' },
      PENDING:     { label:'Pending',     dot:'bg-amber-400',   bar:'bg-amber-400'   },
      REJECTED:    { label:'Rejected',    dot:'bg-red-500',     bar:'bg-red-400'     },
      NOT_STARTED: { label:'Not Started', dot:'bg-slate-300',   bar:'bg-slate-300'   },
    };
    return Object.entries(kyc)
      .map(([s,c]:any) => ({ ...(cfg[s]||{label:s,dot:'bg-slate-400',bar:'bg-slate-400'}), count:c, pct:total?(c/total)*100:0 }))
      .filter(i=>i.count>0);
  }

  navigateCustomer(c: any) {
    this.router.navigate(['/branch','customers',c.id]);
  }

  openTxnModal(type: TxnType) { this.activeTxnType = type; this.showTxnModal = true; }
  openAccountSearch() { this.showSearch = true; }
  onTxnPosted() { this.loadStats(); }
  onCustomerCreated() { this.loadStats(); this.loadRecentCustomers(); }
}
