import {
  Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CustomerSearchModalComponent } from '../branch/quick-actions/customer-search-modal.component';
import { QuickTransactionModalComponent } from '../branch/quick-actions/quick-transaction-modal.component';
import { CustomerOnboardModalComponent } from '../../shared/components/modals/customer-onboard-modal/customer-onboard-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective, DatePipe,
            CustomerSearchModalComponent, QuickTransactionModalComponent, CustomerOnboardModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `

<!-- ═══════════════════════════════════════════════════════════════
     BRANCH USER DASHBOARD  —  Personal overview & direct actions
     (Branch Home /branch/dashboard = operational workspace with tables)
════════════════════════════════════════════════════════════════ -->
<div *ngIf="isBranchUser" class="max-w-[1400px] mx-auto space-y-6 animate-fade-in-up">

  <!-- ── Hero greeting with gradient ── -->
  <div class="relative overflow-hidden rounded-3xl p-7 shadow-xl"
       [style.background]="heroBg()">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-16 -left-16 w-48 h-48 bg-white/8 rounded-full blur-2xl"></div>
      <div class="absolute top-6 right-1/3 w-2 h-2 bg-white/30 rounded-full animate-ping" style="animation-duration:3s"></div>
      <div class="absolute bottom-8 right-1/4 w-1.5 h-1.5 bg-white/20 rounded-full animate-ping" style="animation-duration:4s;animation-delay:1s"></div>
    </div>
    <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div>
        <p class="text-white/70 text-sm font-semibold tracking-wide mb-1">
          {{ greeting() }} · {{ today | date:'EEEE, d MMM' }}
        </p>
        <h1 class="text-3xl font-extrabold text-white tracking-tight">
          {{ userName || 'Welcome' }} <span class="wave-emoji">👋</span>
        </h1>
        <p class="text-white/60 mt-2 text-sm">
          <span *ngIf="(branchStats()?.pendingApprovals || 0) > 0" class="text-amber-200 font-bold">
            {{ branchStats().pendingApprovals }} pending approvals ·
          </span>
          Here's how your branch is performing.
        </p>
      </div>
      <!-- Live stat chips -->
      <div class="flex items-center gap-3 flex-wrap justify-end">
        <div class="px-4 py-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-sm text-center shrink-0">
          <p class="text-white/60 text-[10px] font-bold uppercase tracking-widest">Customers</p>
          <p class="text-white font-black text-xl leading-none mt-0.5">{{ branchStats()?.totalCustomers ?? '—' }}</p>
        </div>
        <div class="px-4 py-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-sm text-center shrink-0">
          <p class="text-white/60 text-[10px] font-bold uppercase tracking-widest">Accounts</p>
          <p class="text-white font-black text-xl leading-none mt-0.5">{{ branchStats()?.totalAccounts ?? '—' }}</p>
        </div>
        <div class="px-4 py-2.5 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-sm text-center shrink-0">
          <p class="text-white/60 text-[10px] font-bold uppercase tracking-widest">Loans</p>
          <p class="text-white font-black text-xl leading-none mt-0.5">{{ branchStats()?.totalLoans ?? '—' }}</p>
        </div>
        <a [routerLink]="['/branch/dashboard']"
           class="px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-2xl border border-white/30 backdrop-blur-sm text-center shrink-0 transition-all group no-underline">
          <p class="text-white/70 text-[10px] font-bold uppercase tracking-widest">Operations</p>
          <p class="text-white font-bold text-sm leading-none mt-0.5 group-hover:underline">Open →</p>
        </a>
      </div>
    </div>
  </div>

  <!-- ── Pending approvals alert ── -->
  <div *ngIf="(branchStats()?.pendingApprovals || 0) > 0"
       class="flex items-start gap-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5 animate-fade-in-up">
    <div class="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
      <i class="pi pi-exclamation-triangle text-amber-600 dark:text-amber-400 text-lg"></i>
    </div>
    <div class="flex-1">
      <p class="font-bold text-amber-900 dark:text-amber-300">
        {{ branchStats().pendingApprovals }} pending approval{{ branchStats().pendingApprovals !== 1 ? 's' : '' }} awaiting your action
      </p>
      <p class="text-sm text-amber-700 dark:text-amber-400 mt-0.5">Review and process pending loan applications before end of day.</p>
    </div>
    <a [routerLink]="['/branch/dashboard']"
       class="btn-secondary px-4 py-2 text-sm shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 whitespace-nowrap">
      Open Operations →
    </a>
  </div>

  <!-- ── Branch Charts ── -->
  <ng-container *ngIf="!loading()">
    <ng-container *ngTemplateOutlet="chartsRow1"></ng-container>
    <ng-container *ngTemplateOutlet="chartsRow2"></ng-container>
  </ng-container>

</div>

<!-- Modals triggered from dashboard -->
<app-customer-search-modal *ngIf="isBranchUser"
  [(visible)]="showSearch" [bankId]="branchBankId" [branchId]="branchBranchId">
</app-customer-search-modal>
<app-quick-transaction-modal *ngIf="isBranchUser && showCredit"
  [(visible)]="showCredit" txnType="CREDIT" [bankId]="branchBankId" [branchId]="branchBranchId">
</app-quick-transaction-modal>
<app-quick-transaction-modal *ngIf="isBranchUser && showDebit"
  [(visible)]="showDebit" txnType="DEBIT" [bankId]="branchBankId" [branchId]="branchBranchId">
</app-quick-transaction-modal>
<ng-container *ngIf="isBranchUser && authService.hasPermission('customers','create')">
  <app-customer-onboard-modal
    [(visible)]="showNewCustomer" [bankId]="branchBankId" [branchId]="branchBranchId"
    (onCustomerCreated)="loadStats()">
  </app-customer-onboard-modal>
</ng-container>

<!-- ═══════════════════════════════════════════════════════════════
     NON-BRANCH USERS: Super Admin / Bank Admin analytics
════════════════════════════════════════════════════════════════ -->
<div *ngIf="!isBranchUser" class="max-w-[1600px] mx-auto space-y-6 animate-fade-in-up">

  <!-- ── Welcome Header ── -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
        Welcome back<span *ngIf="userName">, {{ userName }}</span> 👋
      </h1>
      <p class="text-sm text-slate-400 mt-1">
        Here's what's happening {{ scopeLabel() }} today.
      </p>
    </div>
    <span class="badge badge-blue self-start md:self-center">
      <i class="pi pi-shield text-[10px]"></i> {{ roleLabel }}
    </span>
  </div>

  <!-- Skeleton -->
  <div *ngIf="loading()" class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div *ngFor="let _ of [1,2,3,4]"
         class="h-28 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
  </div>

  <!-- KPI Cards -->
  <div *ngIf="!loading()" class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <ng-container *ngFor="let card of statCards(); let i = index">
      <a *ngIf="card.route && authService.hasPermission(card.permResource || 'dashboard', 'read')"
         [routerLink]="card.route"
         class="card p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group animate-fade-in-up"
         [style.animation-delay]="(i * 80) + 'ms'">
        <ng-container *ngTemplateOutlet="statCardTpl; context: { card: card }"></ng-container>
      </a>
      <div *ngIf="!card.route"
           class="card p-5 flex flex-col gap-3 animate-fade-in-up"
           [style.animation-delay]="(i * 80) + 'ms'">
        <ng-container *ngTemplateOutlet="statCardTpl; context: { card: card }"></ng-container>
      </div>
    </ng-container>
  </div>

  <!-- Stat card template -->
  <ng-template #statCardTpl let-card="card">
    <div class="flex items-center justify-between">
      <div class="w-11 h-11 rounded-2xl flex items-center justify-center" [class]="card.iconBg">
        <i class="pi text-lg" [class]="card.icon + ' ' + card.iconColor"></i>
      </div>
      <i *ngIf="card.route" class="pi pi-arrow-up-right text-slate-300 dark:text-slate-700
                group-hover:text-primary-400 transition-colors text-xs"></i>
    </div>
    <div>
      <p class="text-3xl font-black text-slate-900 dark:text-white leading-none">{{ card.value | number }}</p>
      <p class="text-xs font-semibold text-slate-400 mt-1 truncate">{{ card.label }}</p>
    </div>
    <div *ngIf="card.subValue !== undefined"
         class="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
      <i class="pi pi-check-circle text-[10px]"></i>{{ card.subValue }} active
    </div>
  </ng-template>

  <!-- ── Non-branch Charts (same templates reused by branch section above) ── -->
  <ng-container *ngIf="!loading()">
    <ng-container *ngTemplateOutlet="chartsRow1"></ng-container>
    <ng-container *ngTemplateOutlet="chartsRow2"></ng-container>
  </ng-container>

  <!-- Quick Actions -->
  <div *ngIf="!loading() && quickLinks().length > 0" class="animate-fade-in-up">
    <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Quick Actions</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      <a *ngFor="let link of quickLinks(); let i = index"
         [routerLink]="link.route"
         class="card p-4 flex flex-col items-center gap-2.5 text-center cursor-pointer
                hover:shadow-md hover:-translate-y-1 transition-all duration-300 group animate-fade-in-up"
         [style.animation-delay]="(i * 50) + 'ms'">
        <div class="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
             [class]="link.iconBg + ' group-hover:opacity-80'">
          <i class="pi text-lg" [class]="link.icon + ' ' + link.iconColor"></i>
        </div>
        <span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">{{ link.label }}</span>
      </a>
    </div>
  </div>

</div>

<!-- ═══════════════════════════════════════════════════════════
     SHARED CHART TEMPLATES — used by both branch + non-branch
════════════════════════════════════════════════════════════ -->

<!-- Period filter bar -->
<ng-template #periodFilter>
  <div class="flex items-center gap-1.5 flex-wrap">
    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Period</span>
    <button *ngFor="let p of PERIODS" type="button"
            (click)="setPeriod(p)"
            class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200"
            [class.bg-primary-600]="period() === p"
            [class.text-white]="period() === p"
            [class.shadow-sm]="period() === p"
            [class.bg-slate-100]="period() !== p"
            [class.dark:bg-slate-800]="period() !== p"
            [class.text-slate-500]="period() !== p"
            [class.hover:bg-slate-200]="period() !== p">
      {{ p }}
    </button>
    <span *ngIf="chartLoading()" class="ml-1 w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></span>
  </div>
</ng-template>

<!-- Opening / Closing Balance banner -->
<ng-template #balanceBanner>
  <div *ngIf="balanceSummary() as b" class="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
    <div class="card p-4 flex flex-col gap-1">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
      <p class="text-lg font-black text-slate-900 dark:text-white leading-none">{{ formatCurrency(b.openingBalance) }}</p>
      <p class="text-[10px] text-slate-400">Start of {{ period() }} period</p>
    </div>
    <div class="card p-4 flex flex-col gap-1">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Balance</p>
      <p class="text-lg font-black text-slate-900 dark:text-white leading-none">{{ formatCurrency(b.closingBalance) }}</p>
      <p class="text-[10px] text-slate-400">Current total</p>
    </div>
    <div class="card p-4 flex flex-col gap-1">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Credits</p>
      <p class="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none">{{ formatCurrency(b.creditInPeriod) }}</p>
      <p class="text-[10px] text-slate-400">Deposits in period</p>
    </div>
    <div class="card p-4 flex flex-col gap-1">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Debits</p>
      <p class="text-lg font-black text-red-500 dark:text-red-400 leading-none">{{ formatCurrency(b.debitInPeriod) }}</p>
      <p class="text-[10px] text-slate-400">Withdrawals in period</p>
    </div>
  </div>
</ng-template>

<!-- Row 1: Customer Growth Sparkline + Loans Disbursed -->
<ng-template #chartsRow1>
  <!-- Period filter -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Analytics</p>
    <ng-container *ngTemplateOutlet="periodFilter"></ng-container>
  </div>

  <!-- Balance banner -->
  <ng-container *ngTemplateOutlet="balanceBanner"></ng-container>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

    <!-- Customer Growth Sparkline -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <i class="pi pi-chart-line text-emerald-600 dark:text-emerald-400 text-sm"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">Customer Growth</p>
            <p class="text-[11px] text-slate-400">New onboarding · {{ period() }}</p>
          </div>
        </div>
        <div *ngIf="sparklineData().dots.length >= 2" class="text-right">
          <p class="text-xs font-bold"
             [class.text-emerald-500]="sparklineTrend() >= 0"
             [class.text-red-500]="sparklineTrend() < 0">
            {{ sparklineTrend() >= 0 ? '↑' : '↓' }} {{ sparklineTrend() | number:'1.0-0' }}%
          </p>
          <p class="text-[10px] text-slate-400">vs prev bucket</p>
        </div>
      </div>
      <ng-container *ngIf="sparklineData().dots.length >= 2; else noGrowthData">
        <div class="relative">
          <svg viewBox="0 0 300 80" class="w-full h-20" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="300" y2="20" stroke="#e2e8f0" stroke-width="0.5"/>
            <line x1="0" y1="40" x2="300" y2="40" stroke="#e2e8f0" stroke-width="0.5"/>
            <line x1="0" y1="60" x2="300" y2="60" stroke="#e2e8f0" stroke-width="0.5"/>
            <defs>
              <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            <polygon [attr.points]="sparklineData().area" fill="url(#sparkGrad)"/>
            <polyline [attr.points]="sparklineData().line" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle *ngFor="let pt of sparklineData().dots" [attr.cx]="pt.x" [attr.cy]="pt.y" r="3" fill="white" stroke="#10b981" stroke-width="2"/>
          </svg>
          <div class="flex justify-between mt-1 overflow-hidden">
            <span *ngFor="let lbl of sparklineData().labels" class="text-[9px] text-slate-400 font-bold truncate" style="max-width:2.5rem">{{ lbl }}</span>
          </div>
        </div>
      </ng-container>
      <ng-template #noGrowthData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-chart-line text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No customer data in this period</p>
        </div>
      </ng-template>
    </div>

    <!-- Loans Disbursed Bar Chart -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <i class="pi pi-money-bill text-blue-600 dark:text-blue-400 text-sm"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">Loans Disbursed</p>
            <p class="text-[11px] text-slate-400">Amount disbursed · {{ period() }}</p>
          </div>
        </div>
        <a *ngIf="authService.hasPermission('loans','read')" routerLink="/loans"
           class="text-xs font-semibold text-primary-600 hover:underline">View all →</a>
      </div>
      <ng-container *ngIf="loanDisbursedData().length > 0; else noLoanDisbData">
        <div class="space-y-2.5">
          <div *ngFor="let item of loanDisbursedData(); let i = index"
               class="animate-fade-in-up" [style.animation-delay]="(i*50)+'ms'">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{{ item.label }}</span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="font-black text-blue-600 dark:text-blue-400">{{ formatCurrency(item.amount) }}</span>
                <span class="text-slate-400 text-[10px]">{{ item.count }} loans</span>
              </div>
            </div>
            <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-blue-400 transition-all duration-700 ease-out" [style.width]="item.barPct + '%'"></div>
            </div>
          </div>
        </div>
      </ng-container>
      <ng-template #noLoanDisbData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-money-bill text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No disbursements in this period</p>
        </div>
      </ng-template>
    </div>

  </div>
</ng-template>

<!-- Row 2: Transaction Volume + Loan Pipeline + KYC + Account Mix + Activity -->
<ng-template #chartsRow2>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

    <!-- Transaction Volume — grouped credit/debit bars -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <i class="pi pi-arrows-h text-violet-600 dark:text-violet-400 text-sm"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">Transaction Volume</p>
            <p class="text-[11px] text-slate-400">Credit vs Debit · {{ period() }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3 text-[10px] font-bold">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>Credit</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>Debit</span>
        </div>
      </div>
      <ng-container *ngIf="txnVolumeData().length > 0; else noTxnData">
        <div class="space-y-2.5">
          <div *ngFor="let item of txnVolumeData(); let i = index"
               class="animate-fade-in-up" [style.animation-delay]="(i*40)+'ms'">
            <p class="text-[10px] font-bold text-slate-400 mb-1 truncate">{{ item.label }}</p>
            <div class="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div class="h-full bg-emerald-400 rounded-l-full transition-all duration-700 ease-out"
                   [style.width]="(item.maxVal ? (item.credit/item.maxVal)*100 : 0) + '%'"></div>
              <div class="h-full bg-red-400 rounded-r-full transition-all duration-700 ease-out"
                   [style.width]="(item.maxVal ? (item.debit/item.maxVal)*100 : 0) + '%'"></div>
            </div>
            <div class="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span class="text-emerald-600 font-semibold">{{ formatCurrency(item.creditAmt) }}</span>
              <span class="text-red-500 font-semibold">{{ formatCurrency(item.debitAmt) }}</span>
            </div>
          </div>
        </div>
      </ng-container>
      <ng-template #noTxnData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-arrows-h text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No transactions in this period</p>
        </div>
      </ng-template>
    </div>

    <!-- Loan Pipeline status breakdown -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
            <i class="pi pi-chart-bar text-primary-600 dark:text-primary-400 text-sm"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">Loan Pipeline</p>
            <p class="text-[11px] text-slate-400">All-time status breakdown</p>
          </div>
        </div>
        <a *ngIf="authService.hasPermission('loans','read')" routerLink="/loans"
           class="text-xs font-semibold text-primary-600 hover:underline">View →</a>
      </div>
      <ng-container *ngIf="loanChartData().length > 0; else noLoanData">
        <div class="flex h-4 rounded-full overflow-hidden mb-4 gap-0.5">
          <div *ngFor="let item of loanChartData()" class="h-full transition-all duration-700 ease-out"
               [class]="item.barColor" [style.width]="item.pct+'%'" [title]="item.label+': '+item.count"></div>
        </div>
        <div class="space-y-2.5">
          <div *ngFor="let item of loanChartData(); let i = index" class="animate-fade-in-up" [style.animation-delay]="(i*60)+'ms'">
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full shrink-0" [class]="item.dot"></span>
                <span class="font-semibold text-slate-600 dark:text-slate-400 capitalize">{{ item.label }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="font-black" [class]="item.color">{{ item.count }}</span>
                <span class="text-slate-400 text-[10px] w-7 text-right">{{ item.pct | number:'1.0-0' }}%</span>
              </div>
            </div>
            <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700 ease-out" [class]="item.barColor" [style.width]="item.pct+'%'"></div>
            </div>
          </div>
        </div>
      </ng-container>
      <ng-template #noLoanData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-file text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No loan applications yet</p>
        </div>
      </ng-template>
    </div>

  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">

    <!-- Account Mix -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center gap-2 mb-5">
        <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <i class="pi pi-wallet text-blue-600 dark:text-blue-400 text-sm"></i>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-white">Account Mix</p>
          <p class="text-[11px] text-slate-400">By product type</p>
        </div>
      </div>
      <ng-container *ngIf="accountTypeChartData().length > 0; else noAccountData">
        <div class="space-y-3">
          <div *ngFor="let a of accountTypeChartData(); let i = index" class="animate-fade-in-up" [style.animation-delay]="(i*50)+'ms'">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{{ a.label }}</span>
              <span class="font-black text-slate-800 dark:text-slate-200 shrink-0 ml-2">{{ a.count }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700 ease-out" [class]="a.bar" [style.width]="a.pct+'%'"></div>
              </div>
              <span class="text-[10px] text-slate-400 w-7 text-right shrink-0">{{ a.pct | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      </ng-container>
      <ng-template #noAccountData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-wallet text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No accounts opened yet</p>
        </div>
      </ng-template>
    </div>

    <!-- KYC Health -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center gap-2 mb-5">
        <div class="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
          <i class="pi pi-id-card text-violet-600 dark:text-violet-400 text-sm"></i>
        </div>
        <div>
          <p class="text-sm font-bold text-slate-900 dark:text-white">KYC Health</p>
          <p class="text-[11px] text-slate-400">Verification status</p>
        </div>
      </div>
      <ng-container *ngIf="kycChartData().length > 0; else noKycData">
        <div class="flex items-center justify-center mb-4">
          <div class="w-28 h-28 rounded-full flex items-center justify-center" [style.background]="kycDonut()">
            <div class="bg-white dark:bg-slate-900 rounded-full flex flex-col items-center justify-center" style="width:4.5rem;height:4.5rem">
              <span class="text-xl font-black text-slate-900 dark:text-white leading-none">{{ kycTotal() }}</span>
              <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Total</span>
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <div *ngFor="let k of kycChartData()" class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" [class]="k.dot"></span>
              <span class="font-medium text-slate-600 dark:text-slate-400">{{ k.label }}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="h-1.5 w-12 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full" [class]="k.dot" [style.width]="k.pct+'%'"></div>
              </div>
              <span class="font-black text-slate-800 dark:text-slate-200 w-6 text-right">{{ k.count }}</span>
            </div>
          </div>
        </div>
      </ng-container>
      <ng-template #noKycData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-id-card text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">No KYC data yet</p>
        </div>
      </ng-template>
    </div>

    <!-- Bank / Branch Activity -->
    <div class="card p-5 animate-fade-in-up">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl" [class]="data()?.scope==='SUPER_ADMIN'?'bg-blue-50 dark:bg-blue-900/30':'bg-indigo-50 dark:bg-indigo-900/30'" style="display:flex;align-items:center;justify-content:center">
            <i class="pi text-sm" [class]="data()?.scope==='SUPER_ADMIN'?'pi-building-columns text-blue-600':'pi-sitemap text-indigo-600'"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">{{ data()?.scope==='SUPER_ADMIN'?'Bank Activity':'Branch Activity' }}</p>
            <p class="text-[11px] text-slate-400">Customer distribution</p>
          </div>
        </div>
        <a *ngIf="data()?.scope==='SUPER_ADMIN' && authService.hasPermission('banks','read')" routerLink="/banks" class="text-xs font-semibold text-primary-600 hover:underline">→</a>
      </div>
      <ng-container *ngIf="breakdownRows().length > 0; else noBreakdownData">
        <div class="space-y-2.5">
          <div *ngFor="let row of breakdownRows(); let i = index" (click)="navigateBreakdown(row)"
               class="flex items-center gap-3 cursor-pointer group p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors animate-fade-in-up" [style.animation-delay]="(i*40)+'ms'">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0" [style.background]="getRowColor(i)">{{ row.name?.charAt(0) }}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-semibold text-slate-700 dark:text-slate-300 truncate">{{ row.name }}</span>
                <span class="font-black text-slate-800 dark:text-slate-200 shrink-0 ml-1">{{ row.customers }}</span>
              </div>
              <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700 ease-out" [style.background]="getRowColor(i)" [style.width]="getBreakdownPct(row,i)+'%'"></div>
              </div>
            </div>
            <i class="pi pi-chevron-right text-[9px] text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"></i>
          </div>
        </div>
      </ng-container>
      <ng-template #noBreakdownData>
        <div class="flex flex-col items-center justify-center h-24 text-center">
          <i class="pi pi-building-columns text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
          <p class="text-xs text-slate-400">{{ data()?.scope==='SUPER_ADMIN'?'No banks yet':'No branch data' }}</p>
        </div>
      </ng-template>
    </div>

  </div>
</ng-template>

  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private http         = inject(HttpClient);
  readonly router      = inject(Router);
  readonly cdr         = inject(ChangeDetectorRef);
  private destroy$     = new Subject<void>();

  loading        = signal(true);
  chartLoading   = signal(false);
  data           = signal<any>(null);
  branchStats    = signal<any>(null);
  chartData      = signal<any>(null);
  period         = signal<string>('1M');

  readonly PERIODS = ['1D','1W','1M','3M','6M','1Y','2Y','3Y'];

  userName      = '';
  roleLabel     = '';
  isBranchUser  = false;
  today         = new Date();

  // Branch user modal state
  branchBankId   = '';
  branchBranchId = '';
  showSearch     = false;
  showCredit     = false;
  showDebit      = false;
  showNewCustomer = false;
  showOpenAccount = false;

  ngOnInit() {
    const user = this.authService.getUserProfile();
    if (user) {
      this.userName       = user.firstName ?? '';
      this.roleLabel      = user.roleType  ?? '';
      this.isBranchUser   = !!user.branchId;
      this.branchBankId   = user.bankId    || '';
      this.branchBranchId = user.branchId  || '';
    }
    this.loadStats();
    this.loadCharts();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /** Dynamic gradient based on time of day */
  heroBg(): string {
    const h = new Date().getHours();
    if (h < 6)  return 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e40af 100%)'; // night
    if (h < 12) return 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%)'; // morning
    if (h < 17) return 'linear-gradient(135deg, #4338ca 0%, #6d28d9 50%, #7c3aed 100%)'; // afternoon
    return 'linear-gradient(135deg, #1e3a5f 0%, #312e81 50%, #4c1d95 100%)'; // evening
  }

  scopeLabel(): string {
    const s = this.data()?.scope;
    if (s === 'SUPER_ADMIN') return 'across the platform';
    if (s === 'BANK_ADMIN')  return 'across your bank';
    return 'at your branch';
  }

  loadStats() {
    this.loading.set(true);
    this.http.get<any>('/dashboard/stats')
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          if (this.isBranchUser || d?.scope === 'BRANCH') {
            this.branchStats.set(d);
            this.isBranchUser = true;
          } else {
            this.isBranchUser = false;
          }
          this.cdr.detectChanges();
        },
        error: () => { this.loading.set(false); this.cdr.detectChanges(); },
      });
  }

  loadCharts() {
    this.chartLoading.set(true);
    this.http.get<any>(`/dashboard/charts?period=${this.period()}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.chartLoading.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (d) => { this.chartData.set(d); this.cdr.detectChanges(); },
        error: () => { this.chartLoading.set(false); this.cdr.detectChanges(); },
      });
  }

  setPeriod(p: string) {
    this.period.set(p);
    this.loadCharts();
  }

  // ── Branch stat cards ─────────────────────────────────────────────
  branchStatCards(): any[] {
    const d = this.branchStats();
    if (!d) return [];
    return [
      { label: 'Total Customers',   value: d.totalCustomers   ?? 0, icon: 'pi-id-card', iconBg: 'bg-blue-50 dark:bg-blue-900/20',    iconColor: 'text-blue-600 dark:text-blue-400'    },
      { label: 'Active Accounts',   value: d.totalAccounts    ?? '—', icon: 'pi-wallet',  iconBg: 'bg-violet-50 dark:bg-violet-900/20', iconColor: 'text-violet-600 dark:text-violet-400' },
      { label: 'Pending Approvals', value: d.pendingApprovals ?? 0, icon: 'pi-clock',   iconBg: 'bg-amber-50 dark:bg-amber-900/20',   iconColor: 'text-amber-600 dark:text-amber-400',   urgent: (d.pendingApprovals ?? 0) > 0 },
      { label: 'Total Loans',       value: d.totalLoans       ?? 0, icon: 'pi-file',    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    ];
  }

  // ── Non-branch stat cards ─────────────────────────────────────────
  statCards(): any[] {
    const d = this.data();
    if (!d) return [];
    const cards: any[] = [];
    const can = (r: string) => this.authService.hasPermission(r, 'read');
    if (d.scope === 'SUPER_ADMIN') {
      if (can('banks'))     cards.push({ label:'Total Banks',     value:d.totalBanks,       subValue:d.activeBanks, icon:'pi-building-columns', iconBg:'bg-blue-50 dark:bg-blue-900/20',     iconColor:'text-blue-600 dark:text-blue-400',    route:'/banks',   permResource:'banks'     });
      if (can('branches'))  cards.push({ label:'Active Branches', value:d.totalBranches,    icon:'pi-sitemap',      iconBg:'bg-indigo-50 dark:bg-indigo-900/20', iconColor:'text-indigo-600 dark:text-indigo-400', route:'/banks',   permResource:'branches'  });
      if (can('customers')) cards.push({ label:'Active Customers',value:d.totalCustomers,   icon:'pi-id-card',      iconBg:'bg-violet-50 dark:bg-violet-900/20', iconColor:'text-violet-600 dark:text-violet-400',                   permResource:'customers' });
      if (can('users'))     cards.push({ label:'Active Users',    value:d.totalActiveUsers, icon:'pi-users',        iconBg:'bg-emerald-50 dark:bg-emerald-900/20',iconColor:'text-emerald-600 dark:text-emerald-400',                 permResource:'users'     });
    } else if (d.scope === 'BANK_ADMIN') {
      if (can('branches'))  cards.push({ label:'Branches',  value:d.totalBranches, icon:'pi-sitemap', iconBg:'bg-blue-50 dark:bg-blue-900/20',     iconColor:'text-blue-600',    permResource:'branches'  });
      if (can('customers')) cards.push({ label:'Customers', value:d.totalCustomers,icon:'pi-id-card', iconBg:'bg-violet-50 dark:bg-violet-900/20',  iconColor:'text-violet-600',  permResource:'customers' });
      if (can('accounting'))cards.push({ label:'Accounts',  value:d.totalAccounts, icon:'pi-wallet',  iconBg:'bg-emerald-50 dark:bg-emerald-900/20',iconColor:'text-emerald-600', permResource:'accounting' });
      if (can('users'))     cards.push({ label:'Staff',     value:d.totalStaff,    icon:'pi-users',   iconBg:'bg-amber-50 dark:bg-amber-900/20',    iconColor:'text-amber-600',   permResource:'users'     });
    }
    return cards;
  }

  loanChartData(): any[] {
    const loans = this.data()?.loansByStatus;
    if (!loans || !Object.keys(loans).length) return [];
    const total = Object.values(loans).reduce((a: any, b: any) => a + b, 0) as number;
    if (!total) return [];
    const cfg: Record<string, any> = {
      PENDING:   { label:'Pending',  color:'text-amber-500',   barColor:'bg-amber-400',   dot:'bg-amber-400'   },
      APPROVED:  { label:'Approved', color:'text-emerald-500', barColor:'bg-emerald-400', dot:'bg-emerald-400' },
      REJECTED:  { label:'Rejected', color:'text-red-500',     barColor:'bg-red-400',     dot:'bg-red-400'     },
      DISBURSED: { label:'Disbursed',color:'text-blue-500',    barColor:'bg-blue-400',    dot:'bg-blue-400'    },
      CLOSED:    { label:'Closed',   color:'text-slate-400',   barColor:'bg-slate-300',   dot:'bg-slate-300'   },
    };
    return Object.entries(loans)
      .map(([s, c]: any) => ({ label:cfg[s]?.label||s, count:c, color:cfg[s]?.color||'text-slate-500', barColor:cfg[s]?.barColor||'bg-slate-400', dot:cfg[s]?.dot||'bg-slate-400', pct:Math.round((c/total)*100) }))
      .filter(i => i.count > 0).sort((a,b) => b.count - a.count);
  }

  // ── SVG sparkline from period chart data ──────────────────────────
  sparklineData(): { line: string; area: string; dots: {x:number,y:number}[]; labels: string[] } {
    const raw: {label:string, count:number}[] = this.chartData()?.customerGrowth || this.data()?.monthlyGrowth?.map((r: any) => ({ label: r.month, count: r.count })) || [];
    const empty = { line:'', area:'', dots:[], labels:[] };
    if (raw.length < 2) return empty;
    const W = 300, H = 80, PAD = 8;
    const values = raw.map(r => r.count);
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const toX = (i: number) => PAD + (i / (raw.length - 1)) * (W - PAD * 2);
    const toY = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
    const pts = raw.map((r, i) => ({ x: toX(i), y: toY(r.count) }));
    const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${pts[0].x.toFixed(1)},${H} ${line} ${pts[pts.length-1].x.toFixed(1)},${H}`;
    // Show max ~8 evenly-spaced labels
    const step = Math.max(1, Math.floor(raw.length / 8));
    const labels = raw.map((r, i) => (i % step === 0 || i === raw.length - 1) ? r.label : '');
    return { line, area, dots: pts, labels };
  }

  sparklineTrend(): number {
    const raw: {label:string, count:number}[] = this.chartData()?.customerGrowth || this.data()?.monthlyGrowth?.map((r: any) => ({ label: r.month, count: r.count })) || [];
    if (raw.length < 2) return 0;
    const prev = raw[raw.length - 2].count, curr = raw[raw.length - 1].count;
    if (!prev) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  // ── Loans Disbursed bar chart ─────────────────────────────────────
  loanDisbursedData(): { label: string; count: number; amount: number; barPct: number }[] {
    const raw: {label:string, count:number, amount:number}[] = this.chartData()?.loanDisbursed || [];
    if (!raw.length) return [];
    const maxAmt = Math.max(...raw.map(r => r.amount), 1);
    return raw.map(r => ({ ...r, barPct: Math.round((r.amount / maxAmt) * 100) }));
  }

  // ── Transaction Volume (credit vs debit bars) ─────────────────────
  txnVolumeData(): { label: string; credit: number; debit: number; creditAmt: number; debitAmt: number; maxVal: number }[] {
    const raw: any[] = this.chartData()?.txnVolume || [];
    if (!raw.length) return [];
    const maxVal = Math.max(...raw.flatMap(r => [r.credit, r.debit]), 1);
    return raw.map(r => ({ ...r, maxVal }));
  }

  // ── Opening / Closing balance ────────────────────────────────────
  balanceSummary(): { openingBalance: number; closingBalance: number; creditInPeriod: number; debitInPeriod: number; netChange: number } | null {
    return this.chartData()?.balanceSummary || null;
  }

  formatCurrency(val: number): string {
    if (val >= 10_000_000) return '₹' + (val / 10_000_000).toFixed(1) + 'Cr';
    if (val >= 100_000)    return '₹' + (val / 100_000).toFixed(1) + 'L';
    if (val >= 1_000)      return '₹' + (val / 1_000).toFixed(1) + 'K';
    return '₹' + val.toFixed(0);
  }

  // ── Account Type Distribution bars ────────────────────────────────
  accountTypeChartData(): any[] {
    const raw: {type:string, count:number}[] = this.data()?.accountTypeBreakdown || [];
    if (!raw.length) return [];
    const total = raw.reduce((a, r) => a + r.count, 0);
    if (!total) return [];
    const bars = ['bg-blue-400','bg-violet-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-cyan-400'];
    return raw.map((r, i) => ({ label: r.type?.replace(/_/g,' ') || 'Unknown', count: r.count, pct: Math.round((r.count / total) * 100), bar: bars[i % bars.length] }));
  }

  getBreakdownPct(row: any, _i: number): number {
    const rows = this.breakdownRows();
    if (!rows.length) return 0;
    const max = Math.max(...rows.map((r: any) => r.customers || 0));
    return max ? Math.round((row.customers / max) * 100) : 0;
  }

  kycChartData(): any[] {
    const kyc = this.data()?.kycBreakdown;
    if (!kyc || !Object.keys(kyc).length) return [];
    const cfg: Record<string, any> = {
      VERIFIED:    { label:'Verified',    dot:'bg-emerald-500', hex:'#10b981' },
      PENDING:     { label:'Pending',     dot:'bg-amber-400',   hex:'#f59e0b' },
      REJECTED:    { label:'Rejected',    dot:'bg-red-500',     hex:'#ef4444' },
      NOT_STARTED: { label:'Not Started', dot:'bg-slate-300',   hex:'#cbd5e1' },
    };
    const total = Object.values(kyc).reduce((a:any,b:any)=>a+b,0) as number;
    return Object.entries(kyc)
      .map(([s,c]:any) => ({ ...(cfg[s]||{label:s,dot:'bg-slate-400',hex:'#94a3b8'}), count:c, pct:total?(c/total)*100:0 }))
      .filter(i => i.count > 0);
  }

  kycTotal(): number { return this.kycChartData().reduce((a,b)=>a+b.count,0); }

  kycDonut(): string {
    const items = this.kycChartData();
    if (!items.length) return '#e2e8f0';
    let deg = 0;
    const stops = items.map(i => { const s=deg; deg+=(i.pct/100)*360; return `${i.hex} ${s.toFixed(1)}deg ${deg.toFixed(1)}deg`; });
    return `conic-gradient(${stops.join(', ')})`;
  }

  breakdownRows(): any[] { const d=this.data(); if(!d)return[]; return d.bankBreakdown||d.branchBreakdown||[]; }
  getRowColor(i: number): string { return ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'][i%6]; }

  navigateBreakdown(row: any) {
    const d = this.data();
    if (!d) return;
    if (d.scope === 'SUPER_ADMIN') this.router.navigate(['/banks', row.id]);
    else this.router.navigate(['/banks', this.authService.getUserProfile()?.bankId, 'branches', row.id]);
  }

  quickLinks(): any[] {
    const defs = [
      { resource:'banks',       label:'Banks',       icon:'pi-building-columns', route:'/banks',       iconBg:'bg-blue-50 dark:bg-blue-900/20',     iconColor:'text-blue-600'   },
      { resource:'customers',   label:'Customers',   icon:'pi-id-card',          route:'/customers',   iconBg:'bg-violet-50 dark:bg-violet-900/20',  iconColor:'text-violet-600' },
      { resource:'roles',       label:'Roles',       icon:'pi-shield',           route:'/roles',       iconBg:'bg-indigo-50 dark:bg-indigo-900/20',  iconColor:'text-indigo-600' },
      { resource:'geography',   label:'Geography',   icon:'pi-map',              route:'/geography',   iconBg:'bg-teal-50 dark:bg-teal-900/20',      iconColor:'text-teal-600'   },
      { resource:'currencies',  label:'Currencies',  icon:'pi-dollar',           route:'/currencies',  iconBg:'bg-emerald-50 dark:bg-emerald-900/20', iconColor:'text-emerald-600' },
      { resource:'master-data', label:'Master Data', icon:'pi-server',           route:'/master-data', iconBg:'bg-amber-50 dark:bg-amber-900/20',    iconColor:'text-amber-600'  },
    ];
    return defs.filter(d => this.authService.hasPermission(d.resource, 'read'));
  }
}
