import { Component, EventEmitter, Input, Output, inject, ChangeDetectorRef, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-customer-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<p-dialog [(visible)]="visible" (visibleChange)="visibleChange.emit($event)"
          [modal]="true" appendTo="body" position="center"
          [style]="{ width: '560px', maxWidth: '98vw' }"
          [showHeader]="false" contentStyleClass="p-0 bg-transparent">
  <div *ngIf="visible" class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">

    <!-- Header -->
    <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-search text-primary-600 dark:text-primary-400"></i>
        </div>
        <div>
          <p class="font-bold text-slate-900 dark:text-white">Find Customer</p>
          <p class="text-xs text-slate-400">Search by name, phone, CIF or document number</p>
        </div>
      </div>
      <button (click)="close()" class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
        <i class="pi pi-times text-xs"></i>
      </button>
    </div>

    <!-- Search input -->
    <div class="px-5 pt-4 pb-2">
      <div class="relative">
        <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input type="text" [(ngModel)]="query" (ngModelChange)="onQueryChange($event)"
               placeholder="Type name, phone, CIF..." autofocus
               class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700
                      bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100
                      text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                      transition-all" />
        <div *ngIf="isSearching" class="absolute right-3.5 top-1/2 -translate-y-1/2">
          <i class="pi pi-spin pi-spinner text-slate-400 text-sm"></i>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="overflow-y-auto max-h-72 custom-scrollbar px-3 pb-4">

      <!-- Initial state -->
      <div *ngIf="!query" class="py-8 text-center text-slate-400">
        <i class="pi pi-users text-3xl mb-2 block text-slate-300"></i>
        <p class="text-sm">Start typing to search customers</p>
      </div>

      <!-- No results -->
      <div *ngIf="query && !isSearching && results.length === 0" class="py-8 text-center text-slate-400">
        <i class="pi pi-id-card text-3xl mb-2 block text-slate-300"></i>
        <p class="text-sm font-semibold">No customers found</p>
        <p class="text-xs mt-1">Try a different name, phone or CIF number</p>
      </div>

      <!-- Results list -->
      <div *ngFor="let c of results"
           (click)="select(c)"
           class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group">
        <!-- Avatar -->
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0 uppercase">
          {{ c.firstName?.charAt(0) }}{{ c.lastName?.charAt(0) }}
        </div>
        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-900 dark:text-white truncate">
            {{ c.firstName }} {{ c.middleName ? c.middleName + ' ' : '' }}{{ c.lastName }}
          </p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] font-mono text-slate-400">CIF: {{ c.customerNumber }}</span>
            <span class="text-[10px] text-slate-300">·</span>
            <span class="text-[10px] text-slate-400 font-mono">{{ c.phoneNumber }}</span>
          </div>
        </div>
        <!-- KYC badge -->
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
              [class.bg-emerald-100]="c.kycStatus === 'VERIFIED'"
              [class.text-emerald-700]="c.kycStatus === 'VERIFIED'"
              [class.bg-amber-100]="c.kycStatus === 'PENDING'"
              [class.text-amber-700]="c.kycStatus === 'PENDING'"
              [class.bg-slate-100]="c.kycStatus !== 'VERIFIED' && c.kycStatus !== 'PENDING'"
              [class.text-slate-500]="c.kycStatus !== 'VERIFIED' && c.kycStatus !== 'PENDING'">
          {{ c.kycStatus }}
        </span>
        <i class="pi pi-chevron-right text-xs text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"></i>
      </div>
    </div>

    <!-- Footer hint -->
    <div *ngIf="results.length > 0" class="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
      <p class="text-xs text-slate-400">Click a customer to open their profile</p>
    </div>

  </div>
</p-dialog>
  `,
})
export class CustomerSearchModalComponent implements OnInit, OnDestroy {
  @Input()  visible = false;
  @Input()  bankId = '';
  @Input()  branchId = '';
  /** If true, emits selected customer instead of navigating */
  @Input()  emitOnly = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() customerSelected = new EventEmitter<any>();

  private http   = inject(HttpClient);
  private router = inject(Router);
  private cdr    = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private search$  = new Subject<string>();

  query      = '';
  results: any[] = [];
  isSearching = false;

  ngOnInit() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap((q) => {
        if (!q || q.length < 2) { this.results = []; this.isSearching = false; this.cdr.detectChanges(); return []; }
        this.isSearching = true;
        this.cdr.detectChanges();
        return this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers?search=${encodeURIComponent(q)}&limit=10`);
      })
    ).subscribe({
      next: (res) => { this.results = res?.data ?? res ?? []; this.isSearching = false; this.cdr.detectChanges(); },
      error: () => { this.isSearching = false; this.cdr.detectChanges(); }
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onQueryChange(q: string) { this.search$.next(q); }

  select(customer: any) {
    if (this.emitOnly) {
      this.customerSelected.emit(customer);
      this.close();
      return;
    }
    this.close();
    this.router.navigate(['/branch', 'customers', customer.id]);
  }

  close() {
    this.query   = '';
    this.results = [];
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
