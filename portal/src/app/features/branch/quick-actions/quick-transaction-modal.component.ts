import {
  Component, EventEmitter, Input, Output, inject,
  ChangeDetectorRef, ChangeDetectionStrategy, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';

export type TxnType = 'CREDIT' | 'DEBIT';

@Component({
  selector: 'app-quick-transaction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<p-dialog [(visible)]="visible" (visibleChange)="visibleChange.emit($event)"
          [modal]="true" appendTo="body" position="center"
          [style]="{ width: '580px', maxWidth: '98vw' }"
          [showHeader]="false" contentStyleClass="p-0 bg-transparent">
  <div *ngIf="visible" class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col animate-scale-in"
       style="max-height:88vh">

    <!-- Header -->
    <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0"
         [class.bg-emerald-50]="txnType === 'CREDIT'"
         [class.dark:bg-emerald-900\/10]="txnType === 'CREDIT'"
         [class.bg-red-50]="txnType === 'DEBIT'"
         [class.dark:bg-red-900\/10]="txnType === 'DEBIT'">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
             [class.bg-gradient-to-br]="true"
             [class.from-emerald-500]="txnType === 'CREDIT'"
             [class.to-teal-600]="txnType === 'CREDIT'"
             [class.from-red-500]="txnType === 'DEBIT'"
             [class.to-rose-600]="txnType === 'DEBIT'">
          <i class="pi" [class.pi-arrow-up]="txnType === 'CREDIT'" [class.pi-arrow-down]="txnType === 'DEBIT'"></i>
        </div>
        <div>
          <p class="font-bold text-slate-900 dark:text-white">
            {{ txnType === 'CREDIT' ? 'Credit Account' : 'Debit Account' }}
          </p>
          <div *ngIf="!done()" class="flex items-center gap-2">
            <span *ngFor="let s of steps; let i = index"
                  class="h-1.5 rounded-full transition-all duration-300"
                  [style.width]="step === i ? '16px' : '6px'"
                  [class.bg-primary-500]="step === i"
                  [class.bg-slate-300]="step !== i"
                  [class.dark:bg-slate-600]="step !== i"></span>
            <span class="text-xs text-slate-400 ml-1">Step {{ step + 1 }} of {{ steps.length }}</span>
          </div>
        </div>
      </div>
      <button (click)="closeModal()" class="w-8 h-8 rounded-xl bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
        <i class="pi pi-times text-xs"></i>
      </button>
    </div>

    <!-- ── SUCCESS STATE ── -->
    <div *ngIf="done()" class="p-8 flex flex-col items-center text-center gap-4">
      <div class="w-16 h-16 rounded-full flex items-center justify-center"
           [class.bg-emerald-100]="txnType === 'CREDIT'"
           [class.bg-red-100]="txnType === 'DEBIT'">
        <i class="pi pi-check-circle text-3xl"
           [class.text-emerald-600]="txnType === 'CREDIT'"
           [class.text-red-600]="txnType === 'DEBIT'"></i>
      </div>
      <div>
        <p class="text-xl font-black text-slate-900 dark:text-white">
          {{ txnType === 'CREDIT' ? 'Credited Successfully!' : 'Debited Successfully!' }}
        </p>
        <p class="text-sm text-slate-400 mt-1">
          ₹{{ amount | number:'1.2-2' }} {{ txnType === 'CREDIT' ? 'deposited to' : 'withdrawn from' }}
          <span class="font-mono font-bold text-slate-600 dark:text-slate-300">{{ selectedAccount?.accountNumber }}</span>
        </p>
      </div>
      <div class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-sm space-y-2 text-left">
        <div class="flex justify-between">
          <span class="text-slate-400">Customer</span>
          <span class="font-semibold text-slate-800 dark:text-slate-200">{{ selectedCustomer?.firstName }} {{ selectedCustomer?.lastName }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-400">New Balance</span>
          <span class="font-black" [class.text-emerald-600]="txnType==='CREDIT'" [class.text-red-600]="txnType==='DEBIT'">
            ₹{{ newBalance() | number:'1.2-2' }}
          </span>
        </div>
      </div>
      <button type="button" (click)="closeModal()"
              class="btn-primary px-8 py-2.5 text-sm mt-2">Done</button>
    </div>

    <!-- Step 1: Search Customer -->
    <div *ngIf="!done() && step === 0" class="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Search for the customer and select their account
      </p>

      <div class="relative">
        <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input type="text" [(ngModel)]="customerQuery" (ngModelChange)="onCustomerSearch($event)"
               placeholder="Customer name, phone or CIF..." autofocus
               class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700
                      bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                      outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
        <div *ngIf="searchingCustomers" class="absolute right-3.5 top-1/2 -translate-y-1/2">
          <i class="pi pi-spin pi-spinner text-slate-400 text-sm"></i>
        </div>
      </div>

      <div *ngIf="customerResults.length > 0" class="space-y-2">
        <button *ngFor="let c of customerResults" type="button"
                (click)="selectCustomer(c)"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/10"
                [class.border-primary-500]="selectedCustomer?.id === c.id"
                [class.bg-primary-50]="selectedCustomer?.id === c.id"
                [class.dark:bg-primary-900\/10]="selectedCustomer?.id === c.id"
                [class.border-slate-200]="selectedCustomer?.id !== c.id"
                [class.dark:border-slate-700]="selectedCustomer?.id !== c.id">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
            {{ c.firstName?.charAt(0) }}{{ c.lastName?.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ c.firstName }} {{ c.lastName }}</p>
            <p class="text-[10px] text-slate-400 font-mono">CIF: {{ c.customerNumber }} · {{ c.phoneNumber }}</p>
          </div>
          <i *ngIf="selectedCustomer?.id === c.id" class="pi pi-check-circle text-primary-500 shrink-0"></i>
        </button>
      </div>

      <div *ngIf="loadingAccounts" class="flex justify-center py-4">
        <i class="pi pi-spin pi-spinner text-slate-400 text-lg"></i>
      </div>

      <div *ngIf="selectedCustomer && !loadingAccounts && customerAccounts.length > 0" class="space-y-2">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Account</p>
        <button *ngFor="let acc of customerAccounts" type="button"
                (click)="selectAccount(acc)"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                [class.border-primary-500]="selectedAccount?.id === acc.id"
                [class.bg-primary-50]="selectedAccount?.id === acc.id"
                [class.dark:bg-primary-900\/10]="selectedAccount?.id === acc.id"
                [class.border-slate-200]="selectedAccount?.id !== acc.id"
                [class.dark:border-slate-700]="selectedAccount?.id !== acc.id">
          <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <i class="pi pi-wallet text-slate-500 text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-900 dark:text-white">{{ acc.accountType | titlecase }}</p>
            <p class="text-[10px] text-slate-400 font-mono">{{ acc.accountNumber }} · Bal: ₹{{ acc.availableBalance | number:'1.2-2' }}</p>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-700">
            {{ acc.status }}
          </span>
        </button>
      </div>

      <div *ngIf="selectedCustomer && !loadingAccounts && customerAccounts.length === 0"
           class="text-center py-6 text-slate-400 text-sm">
        <i class="pi pi-wallet text-2xl mb-2 block text-slate-300"></i>
        No active accounts found for this customer.
      </div>
    </div>

    <!-- Step 2: Enter Amount -->
    <div *ngIf="!done() && step === 1" class="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
      <div class="flex items-center gap-3 p-3 rounded-xl"
           [class.bg-emerald-50]="txnType === 'CREDIT'"
           [class.dark:bg-emerald-900\/10]="txnType === 'CREDIT'"
           [class.bg-red-50]="txnType === 'DEBIT'"
           [class.dark:bg-red-900\/10]="txnType === 'DEBIT'">
        <div class="flex-1">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Account</p>
          <p class="text-sm font-bold text-slate-900 dark:text-white font-mono">{{ selectedAccount?.accountNumber }}</p>
          <p class="text-xs text-slate-400">{{ selectedCustomer?.firstName }} {{ selectedCustomer?.lastName }} · {{ selectedAccount?.accountType }}</p>
        </div>
        <div class="text-right">
          <p class="text-xs font-bold text-slate-400">Available</p>
          <p class="text-base font-black text-slate-900 dark:text-white">₹{{ selectedAccount?.availableBalance | number:'1.2-2' }}</p>
        </div>
      </div>

      <div class="form-group">
        <label class="text-sm font-bold">Amount (₹) <span class="text-red-500">*</span></label>
        <div class="relative mt-1">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base pointer-events-none z-10">₹</span>
          <input type="number" [(ngModel)]="amount" min="1" step="0.01"
                 placeholder="0.00" autofocus
                 class="text-2xl font-black !py-4 !pl-8 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700
                        bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                        outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
        </div>
        <p *ngIf="txnType === 'DEBIT' && amount > (selectedAccount?.availableBalance || 0)"
           class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <i class="pi pi-exclamation-triangle text-[10px]"></i>
          Amount exceeds available balance of ₹{{ selectedAccount?.availableBalance | number:'1.2-2' }}
        </p>
      </div>

      <div class="form-group">
        <label class="text-sm font-bold">Description / Narration <span class="text-slate-400 font-normal text-xs">(optional)</span></label>
        <input type="text" [(ngModel)]="description" placeholder="e.g. Cash deposit, EMI payment..."
               maxlength="200" class="mt-1" />
      </div>

      <div class="form-group">
        <label class="text-sm font-bold">Reference / Voucher No. <span class="text-slate-400 font-normal text-xs">(optional)</span></label>
        <input type="text" [(ngModel)]="reference" placeholder="e.g. VCH/2026/001"
               maxlength="50" class="mt-1 font-mono" />
      </div>
    </div>

    <!-- Step 3: Confirm -->
    <div *ngIf="!done() && step === 2" class="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
      <div class="rounded-2xl overflow-hidden">
        <div class="p-5 text-center"
             [class.bg-gradient-to-r]="true"
             [class.from-emerald-600]="txnType === 'CREDIT'"
             [class.to-teal-600]="txnType === 'CREDIT'"
             [class.from-red-600]="txnType === 'DEBIT'"
             [class.to-rose-600]="txnType === 'DEBIT'">
          <p class="text-white/80 text-xs font-bold uppercase tracking-widest">
            {{ txnType === 'CREDIT' ? 'Crediting' : 'Debiting' }}
          </p>
          <p class="text-4xl font-black text-white mt-1">₹{{ amount | number:'1.2-2' }}</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/40 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-2xl p-4 space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">Customer</span>
            <span class="font-semibold text-slate-900 dark:text-white">{{ selectedCustomer?.firstName }} {{ selectedCustomer?.lastName }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">Account</span>
            <span class="font-mono font-semibold text-slate-900 dark:text-white">{{ selectedAccount?.accountNumber }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-slate-500">Type</span>
            <span class="font-semibold" [class.text-emerald-600]="txnType === 'CREDIT'" [class.text-red-600]="txnType === 'DEBIT'">{{ txnType }}</span>
          </div>
          <div *ngIf="description" class="flex justify-between text-sm">
            <span class="text-slate-500">Narration</span>
            <span class="font-semibold text-slate-900 dark:text-white max-w-[60%] text-right">{{ description }}</span>
          </div>
          <div *ngIf="reference" class="flex justify-between text-sm">
            <span class="text-slate-500">Reference</span>
            <span class="font-mono font-semibold text-slate-900 dark:text-white">{{ reference }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="txnType === 'DEBIT' && amount > (selectedAccount?.availableBalance || 0)"
           class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
        <i class="pi pi-exclamation-triangle text-red-500 shrink-0 mt-0.5"></i>
        <p class="text-sm text-red-700">Insufficient balance. This transaction will be rejected.</p>
      </div>
    </div>

    <!-- Inline error banner -->
    <div *ngIf="errorMsg()" class="mx-5 mb-3 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl p-3 shrink-0">
      <i class="pi pi-exclamation-circle text-red-500 shrink-0 mt-0.5"></i>
      <div class="flex-1">
        <p class="text-sm font-bold text-red-700 dark:text-red-400">Transaction Failed</p>
        <p class="text-xs text-red-600 dark:text-red-300 mt-0.5">{{ errorMsg() }}</p>
      </div>
      <button (click)="clearError()" class="text-red-400 hover:text-red-600 shrink-0"><i class="pi pi-times text-xs"></i></button>
    </div>

    <!-- Footer actions -->
    <div *ngIf="!done()" class="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 rounded-b-2xl">
      <button *ngIf="step > 0" type="button" (click)="prevStep()"
              class="btn-secondary px-4 py-2 text-sm gap-1.5">
        <i class="pi pi-arrow-left text-xs"></i> Back
      </button>
      <div *ngIf="step === 0"></div>

      <div class="flex items-center gap-3">
        <button type="button" (click)="closeModal()" class="btn-secondary px-4 py-2 text-sm">Cancel</button>

        <button *ngIf="step === 0" type="button" (click)="nextStep()"
                [disabled]="!selectedAccount"
                class="btn-primary px-5 py-2 text-sm gap-1.5 disabled:opacity-50">
          Continue <i class="pi pi-arrow-right text-xs"></i>
        </button>

        <button *ngIf="step === 1" type="button" (click)="nextStep()"
                [disabled]="!amount || amount <= 0"
                class="btn-primary px-5 py-2 text-sm gap-1.5 disabled:opacity-50">
          Review <i class="pi pi-arrow-right text-xs"></i>
        </button>

        <button *ngIf="step === 2" type="button" (click)="submit()" [disabled]="saving()"
                class="px-6 py-2 text-sm font-bold rounded-xl text-white gap-2 flex items-center transition-all disabled:opacity-50"
                [class.bg-emerald-600]="txnType === 'CREDIT'" [class.hover:bg-emerald-700]="txnType === 'CREDIT'"
                [class.bg-red-600]="txnType === 'DEBIT'" [class.hover:bg-red-700]="txnType === 'DEBIT'">
          <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
          <i *ngIf="!saving()" class="pi" [class.pi-arrow-up]="txnType === 'CREDIT'" [class.pi-arrow-down]="txnType === 'DEBIT'"></i>
          {{ saving() ? 'Processing...' : (txnType === 'CREDIT' ? 'Confirm Credit' : 'Confirm Debit') }}
        </button>
      </div>
    </div>

  </div>
</p-dialog>
  `,
})
export class QuickTransactionModalComponent {
  @Input()  visible  = false;
  @Input()  txnType: TxnType = 'CREDIT';
  @Input()  bankId   = '';
  @Input()  branchId = '';
  @Output() visibleChange      = new EventEmitter<boolean>();
  @Output() transactionPosted  = new EventEmitter<any>();

  private http     = inject(HttpClient);
  readonly cdr     = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private cusSearch$ = new Subject<string>();

  readonly steps = ['Find Account', 'Enter Amount', 'Confirm'];
  step = 0;

  customerQuery      = '';
  customerResults: any[] = [];
  searchingCustomers = false;
  selectedCustomer: any = null;
  customerAccounts: any[] = [];
  loadingAccounts    = false;
  selectedAccount: any  = null;

  amount      = 0;
  description = '';
  reference   = '';

  saving   = signal(false);
  done     = signal(false);
  errorMsg = signal('');

  // Holds the balance returned from the API after success
  private _newBalance = 0;
  newBalance() { return this._newBalance; }

  ngOnInit() {
    this.cusSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap((q) => {
        if (!q || q.length < 2) {
          this.customerResults = [];
          this.searchingCustomers = false;
          this.cdr.detectChanges();
          return [];
        }
        this.searchingCustomers = true;
        this.cdr.detectChanges();
        return this.http.get<any>(
          `/banks/${this.bankId}/branches/${this.branchId}/customers?search=${encodeURIComponent(q)}&limit=8`
        );
      })
    ).subscribe({
      next: (res) => {
        this.customerResults = res?.data ?? res ?? [];
        this.searchingCustomers = false;
        this.cdr.detectChanges();
      },
      error: () => { this.searchingCustomers = false; this.cdr.detectChanges(); }
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onCustomerSearch(q: string) { this.cusSearch$.next(q); }

  selectCustomer(c: any) {
    this.selectedCustomer = c;
    this.selectedAccount  = null;
    this.customerAccounts = [];
    this.loadingAccounts  = true;
    this.cdr.detectChanges();
    this.http.get<any>(
      `/banks/${this.bankId}/branches/${this.branchId}/customers/${c.id}/accounts`
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.loadingAccounts = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (r) => {
        this.customerAccounts = (r.data ?? r ?? []).filter((a: any) => a.status === 'ACTIVE');
        this.cdr.detectChanges();
      },
      error: () => { this.customerAccounts = []; this.cdr.detectChanges(); }
    });
  }

  selectAccount(acc: any) { this.selectedAccount = acc; this.cdr.detectChanges(); }

  nextStep() {
    this.clearError();
    if (this.step < this.steps.length - 1) { this.step++; this.cdr.detectChanges(); }
  }

  prevStep() {
    this.clearError();
    if (this.step > 0) { this.step--; this.cdr.detectChanges(); }
  }

  clearError() { this.errorMsg.set(''); }

  submit() {
    if (!this.selectedAccount || !this.amount || this.amount <= 0) return;
    this.clearError();
    this.saving.set(true);

    const payload = {
      type:      this.txnType,
      amount:    this.amount,
      note:      this.description || undefined,
      reference: this.reference   || undefined,
    };

    this.http.post<any>(
      `/banks/${this.bankId}/branches/${this.branchId}/customers/${this.selectedCustomer.id}/accounts/${this.selectedAccount.id}/transactions`,
      payload
    ).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.saving.set(false); this.cdr.detectChanges(); })
    ).subscribe({
      next: (res) => {
        this._newBalance = res?.runningBalanceSnapshot
          ?? (this.txnType === 'CREDIT'
              ? Number(this.selectedAccount.availableBalance) + this.amount
              : Number(this.selectedAccount.availableBalance) - this.amount);
        this.done.set(true);
        this.transactionPosted.emit(res);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = Array.isArray(err.error?.message)
          ? err.error.message[0]
          : (err.error?.message || err.message || 'Could not post transaction. Please try again.');
        this.errorMsg.set(msg);
        this.cdr.detectChanges();
      }
    });
  }

  closeModal() {
    this.step             = 0;
    this.customerQuery    = '';
    this.customerResults  = [];
    this.selectedCustomer = null;
    this.selectedAccount  = null;
    this.customerAccounts = [];
    this.amount           = 0;
    this.description      = '';
    this.reference        = '';
    this.done.set(false);
    this.errorMsg.set('');
    this.visible = false;
    this.visibleChange.emit(false);
    this.cdr.detectChanges();
  }
}