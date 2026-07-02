import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { QuickTransactionModalComponent, TxnType } from '../quick-actions/quick-transaction-modal.component';

@Component({
  selector: 'app-branch-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, HasPermissionDirective, LoadingSkeletonComponent, QuickTransactionModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Accounts</h1>
      <p class="text-sm text-slate-400 mt-0.5">All accounts at this branch across all customers</p>
    </div>
  </div>

  <!-- Filter tabs + search -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3">
    <div class="flex gap-1">
      <button *ngFor="let f of filters" type="button" (click)="activeFilter = f; fetch()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeFilter === f" [class.text-white]="activeFilter === f"
              [class.bg-slate-100]="activeFilter !== f" [class.dark:bg-slate-800]="activeFilter !== f"
              [class.text-slate-500]="activeFilter !== f">
        {{ f === 'ALL' ? 'All' : f }}
      </button>
    </div>
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3 pointer-events-none z-10 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="onSearch()"
             placeholder="Account number or customer name..."
             style="padding-left: 2.5rem !important" class="w-full pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:border-primary-500 text-slate-900 dark:text-slate-100" />
    </div>
  </div>

  <app-loading-skeleton *ngIf="isLoading && accounts.length === 0" [lines]="5"></app-loading-skeleton>

  <div *ngIf="!isLoading && accounts.length === 0" class="card p-12 text-center">
    <i class="pi pi-wallet text-3xl text-slate-300 block mb-3"></i>
    <p class="font-bold text-slate-500">No accounts found</p>
  </div>

  <div *ngIf="accounts.length > 0" class="card overflow-hidden">
    <table class="w-full data-table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Customer</th>
          <th>Type</th>
          <th class="text-right">Balance</th>
          <th>Status</th>
          <th *appHasPermission="['accounting', 'create']" class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let acc of accounts" class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <td>
            <p class="text-sm font-mono font-bold text-slate-900 dark:text-white">{{ acc.accountNumber }}</p>
            <p *ngIf="acc.interestRate" class="text-[10px] text-slate-400">{{ acc.interestRate }}% p.a.</p>
          </td>
          <td>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ acc.customer?.firstName }} {{ acc.customer?.lastName }}</p>
            <p class="text-[10px] text-slate-400 font-mono">{{ acc.customer?.customerNumber }}</p>
          </td>
          <td>
            <span class="badge badge-blue text-[10px]">{{ acc.accountType }}</span>
          </td>
          <td class="text-right">
            <p class="text-sm font-bold font-mono text-slate-900 dark:text-white">₹{{ acc.availableBalance | number:'1.2-2' }}</p>
            <p class="text-[10px] text-slate-400">{{ acc.currency }}</p>
          </td>
          <td>
            <span class="badge" [class.badge-green]="acc.status === 'ACTIVE'" [class.badge-red]="acc.status !== 'ACTIVE'">
              {{ acc.status }}
            </span>
          </td>
          <td *appHasPermission="['accounting', 'create']" class="text-right" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-end gap-1">
              <button type="button" (click)="quickTxn(acc, 'CREDIT')"
                      class="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                <i class="pi pi-arrow-up text-[10px]"></i> Credit
              </button>
              <button type="button" (click)="quickTxn(acc, 'DEBIT')"
                      class="px-2 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                <i class="pi pi-arrow-down text-[10px]"></i> Debit
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div *ngIf="hasMore" class="flex justify-center px-5 py-3 border-t border-slate-100 dark:border-slate-800">
      <button type="button" (click)="fetch(true)" [disabled]="isLoading" class="btn-secondary px-5 py-2 text-sm">
        <i *ngIf="isLoading" class="pi pi-spin pi-spinner text-xs mr-1.5"></i> Load more
      </button>
    </div>
  </div>
</div>

<app-quick-transaction-modal
  [(visible)]="showTxnModal"
  [txnType]="activeTxnType"
  [bankId]="bankId"
  [branchId]="branchId"
  (transactionPosted)="fetch()">
</app-quick-transaction-modal>
  `,
})
export class BranchAccountsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private http        = inject(HttpClient);
  readonly cdr        = inject(ChangeDetectorRef);
  private destroy$    = new Subject<void>();
  private searchTimer: any;

  bankId = ''; branchId = '';
  accounts: any[] = []; isLoading = false; hasMore = false; offset = 0; readonly limit = 20;
  filters = ['ALL', 'SAVINGS', 'CURRENT', 'FIXED_DEPOSIT', 'LOAN'];
  activeFilter = 'ALL'; searchQuery = '';
  showTxnModal = false; activeTxnType: TxnType = 'CREDIT';

  ngOnInit() {
    const p = this.authService.getUserProfile();
    this.bankId = p?.bankId || ''; this.branchId = p?.branchId || '';
    this.fetch();
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); clearTimeout(this.searchTimer); }

  fetch(more = false) {
    if (!more) { this.offset = 0; this.accounts = []; }
    this.isLoading = true; this.cdr.detectChanges();
    let params = new HttpParams().set('limit', this.limit).set('offset', this.offset).set('search', this.searchQuery);
    if (this.activeFilter !== 'ALL') params = params.set('accountType', this.activeFilter);
    // Try branch-level accounts endpoint; fall back gracefully
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/accounts`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (r) => { const d = r.data ?? r ?? []; this.accounts = more ? [...this.accounts, ...d] : d; this.offset += d.length; this.hasMore = d.length === this.limit; this.cdr.detectChanges(); },
        error: () => { this.cdr.detectChanges(); }
      });
  }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.fetch(), 350); }
  quickTxn(acc: any, type: TxnType) { this.activeTxnType = type; this.showTxnModal = true; }
}
