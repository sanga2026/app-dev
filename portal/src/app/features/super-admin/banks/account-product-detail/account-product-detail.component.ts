import {
  Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { StatusBadgeComponent } from '../../../../shared/components/ui/status-badge/status-badge.component';

// ── Static data (same as bank-account-products) ──────────────────────────────
const ACCOUNT_TYPES = [
  { value: 'SAVINGS',           label: 'Savings Account',       category: 'DEPOSIT' },
  { value: 'SAVINGS_BASIC',     label: 'Basic Savings (PMJDY)', category: 'DEPOSIT' },
  { value: 'CURRENT',           label: 'Current Account',       category: 'DEPOSIT' },
  { value: 'FIXED_DEPOSIT',     label: 'Fixed Deposit (FD)',    category: 'DEPOSIT' },
  { value: 'RECURRING_DEPOSIT', label: 'Recurring Deposit (RD)',category: 'DEPOSIT' },
  { value: 'NRE_SAVINGS',       label: 'NRE Savings',           category: 'DEPOSIT' },
  { value: 'NRO_SAVINGS',       label: 'NRO Savings',           category: 'DEPOSIT' },
  { value: 'CASH_CREDIT',       label: 'Cash Credit (CC)',      category: 'LOAN'    },
  { value: 'OVERDRAFT',         label: 'Overdraft (OD)',        category: 'LOAN'    },
  { value: 'HOME_LOAN',         label: 'Home Loan',             category: 'LOAN'    },
  { value: 'PERSONAL_LOAN',     label: 'Personal Loan',         category: 'LOAN'    },
  { value: 'AUTO_LOAN',         label: 'Auto / Vehicle Loan',   category: 'LOAN'    },
  { value: 'GOLD_LOAN',         label: 'Gold Loan',             category: 'LOAN'    },
  { value: 'EDUCATION_LOAN',    label: 'Education Loan',        category: 'LOAN'    },
];

const SUBTYPE_MAP: Record<string, string[]> = {
  SAVINGS:           ['REGULAR','SALARY','BSBD_PMJDY','SENIOR_CITIZEN','MINOR','NRI'],
  SAVINGS_BASIC:     ['REGULAR','BSBD_PMJDY'],
  CURRENT:           ['REGULAR','PREMIUM','STARTUP','CORPORATE','FLEXI'],
  FIXED_DEPOSIT:     ['REGULAR','SENIOR_CITIZEN','TAX_SAVER_80C','FLEXI_FD','CUMULATIVE','NON_CUMULATIVE','RECURRING'],
  RECURRING_DEPOSIT: ['REGULAR','FLEXIBLE','SENIOR_CITIZEN'],
  NRE_SAVINGS:       ['REGULAR','PREMIUM','JOINT'],
  NRO_SAVINGS:       ['REGULAR','PREMIUM'],
  HOME_LOAN:         ['REGULAR','TOP_UP','PLOT_PURCHASE','UNDER_CONSTRUCTION','BALANCE_TRANSFER','NRI'],
  PERSONAL_LOAN:     ['REGULAR','SALARY','PENSIONER','GOLD_SECURITY','DOCTOR_LOAN','CONSUMER_DURABLE'],
  AUTO_LOAN:         ['CAR_NEW','CAR_USED','TWO_WHEELER','COMMERCIAL_VEHICLE','ELECTRIC_VEHICLE'],
  GOLD_LOAN:         ['REGULAR','OVERDRAFT_AGAINST_GOLD','BULLET_REPAYMENT'],
  EDUCATION_LOAN:    ['DOMESTIC','ABROAD','VOCATIONAL','SKILL_DEVELOPMENT'],
  CASH_CREDIT:       ['AGAINST_STOCK','AGAINST_PROPERTY','AGAINST_RECEIVABLES'],
  OVERDRAFT:         ['AGAINST_FD','AGAINST_SALARY','AGAINST_PROPERTY','AGAINST_SHARES'],
};

const LOAN_TYPES = ['CASH_CREDIT','OVERDRAFT','HOME_LOAN','PERSONAL_LOAN','AUTO_LOAN','GOLD_LOAN','EDUCATION_LOAN'];
const DEPOSIT_WITH_TENURE = ['FIXED_DEPOSIT','RECURRING_DEPOSIT'];

@Component({
  selector: 'app-account-product-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    InputSwitchModule, DialogModule, HasPermissionDirective,
    DecimalPipe, TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<!-- Loading -->
<div *ngIf="loading()" class="min-h-[70vh] flex flex-col items-center justify-center gap-4">
  <i class="pi pi-spin pi-spinner text-4xl text-primary-600"></i>
  <p class="text-sm text-slate-500 animate-pulse">Loading product details...</p>
</div>

<div *ngIf="!loading() && product" class="max-w-[1600px] mx-auto p-1 space-y-5 animate-fade-in-up">

  <!-- Breadcrumb -->
  <div class="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
    <a [routerLink]="['/banks']" class="hover:text-primary-600 transition-colors">Banks</a>
    <i class="pi pi-angle-right text-[9px]"></i>
    <a [routerLink]="['/banks', bankId]" class="hover:text-primary-600 transition-colors">{{ product.bank?.name || 'Bank' }}</a>
    <i class="pi pi-angle-right text-[9px]"></i>
    <a [routerLink]="['/banks', bankId]" [queryParams]="{tab:'accountproducts'}" class="hover:text-primary-600 transition-colors">Account Products</a>
    <i class="pi pi-angle-right text-[9px]"></i>
    <span class="text-slate-800 dark:text-slate-200">{{ product.productName }}</span>
  </div>

  <!-- Header card -->
  <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200"
       [class.border]="!isEditing"
       [class.border-slate-200]="!isEditing"
       [class.dark:border-slate-700]="!isEditing"
       [class.border-2]="isEditing"
       [class.border-primary-400]="isEditing"
       [class.dark:border-primary-600]="isEditing">
    <div class="flex items-center gap-4">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-sm"
           [class.bg-gradient-to-br]="true"
           [class.from-emerald-500]="!isLoanType"
           [class.to-teal-600]="!isLoanType"
           [class.from-red-500]="isLoanType"
           [class.to-rose-600]="isLoanType">
        <i class="pi" [class.pi-wallet]="!isLoanType" [class.pi-credit-card]="isLoanType"></i>
      </div>
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">{{ product.productName }}</h1>
          <span class="font-mono text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-lg">
            {{ product.productCode }}
          </span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                [class.bg-emerald-100]="!isLoanType"
                [class.text-emerald-700]="!isLoanType"
                [class.bg-red-100]="isLoanType"
                [class.text-red-700]="isLoanType">
            {{ product.productCategory }}
          </span>
        </div>
        <p class="text-sm text-slate-400 mt-0.5">{{ product.accountType }}{{ product.accountSubtype ? ' · ' + product.accountSubtype : '' }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">

      <!-- Delete — view mode only, matches admin-general pattern -->
      <ng-container *appHasPermission="['banks', 'delete']">
        <button *ngIf="!isEditing" type="button" (click)="showDeleteConfirm = true"
                class="btn-danger px-4 py-2 text-sm gap-1.5">
          <i class="pi pi-trash text-xs"></i> Delete
        </button>
      </ng-container>

      <!-- Cancel — edit mode only -->
      <button *ngIf="isEditing" type="button" (click)="cancelEdit()" [disabled]="saving()"
              class="btn-secondary px-4 py-2 text-sm">
        Cancel
      </button>

      <!-- Edit / Save Changes — matches admin-general -->
      <ng-container *appHasPermission="['banks', 'update']">
        <button *ngIf="!isEditing" type="button" (click)="startEdit()"
                class="btn-primary px-4 py-2 text-sm gap-1.5">
          <i class="pi pi-pencil text-xs"></i> Edit
        </button>
        <button *ngIf="isEditing" type="button" (click)="save()" [disabled]="saving() || form.invalid"
                class="btn-primary px-4 py-2 text-sm gap-2">
          <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
          <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
          {{ saving() ? 'Saving...' : 'Save Changes' }}
        </button>
      </ng-container>

      <!-- Simulate — always visible -->
      <button *appHasPermission="['banks', 'update']"
              type="button" (click)="toggleSim()"
              class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
              [class.bg-violet-600]="showSimPanel" [class.text-white]="showSimPanel"
              [class.bg-violet-50]="!showSimPanel" [class.text-violet-700]="!showSimPanel">
        <i class="pi pi-calculator text-sm"></i>
        {{ showSimPanel ? 'Hide Simulator' : '▶ Simulate' }}
      </button>
    </div>
  </div>

  <!-- Editing mode banner -->
  <div *ngIf="isEditing"
       class="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/40 rounded-xl px-4 py-2.5 text-sm text-primary-700 dark:text-primary-300">
    <i class="pi pi-pencil text-xs shrink-0"></i>
    <span>You are in <strong>edit mode</strong> — make your changes and click <strong>Save Changes</strong>, or <strong>Cancel</strong> to discard.</span>
  </div>

  <!-- Delete Confirmation — p-dialog, same as admin-general -->
  <p-dialog [(visible)]="showDeleteConfirm" appendTo="body" [modal]="true"
            [style]="{ width: '420px' }" [showHeader]="false"
            contentStyleClass="p-0 bg-transparent">
    <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6
                border border-slate-200 dark:border-slate-700 text-center animate-scale-in">
      <div class="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/30
                  flex items-center justify-center mx-auto mb-4">
        <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
      </div>
      <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Product</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
        Are you sure you want to permanently delete
        <span class="font-bold text-slate-900 dark:text-white">{{ product.productName }}</span>
        ({{ product.productCode }})? This action cannot be undone.
      </p>
      <div class="flex gap-3">
        <button type="button" (click)="showDeleteConfirm = false"
                class="btn-secondary flex-1 py-2.5">Cancel</button>
        <ng-container *appHasPermission="['banks', 'delete']">
          <button type="button" (click)="deleteProduct()" [disabled]="deleting()"
                  class="btn-danger flex-1 py-2.5 gap-2">
            <i *ngIf="deleting()" class="pi pi-spin pi-spinner text-xs"></i>
            {{ deleting() ? 'Deleting...' : 'Delete Product' }}
          </button>
        </ng-container>
      </div>
    </div>
  </p-dialog>

  <!-- Main layout: form + optional simulator side panel -->
  <div class="flex gap-5 items-start">

    <!-- ═══════════════ EDIT FORM ═══════════════ -->
    <div class="flex-1 min-w-0 space-y-5">

      <form [formGroup]="form" (ngSubmit)="save()">

        <!-- ── Section: Identity ── -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <i class="pi pi-tag text-slate-400 text-sm"></i>
            <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Product Identity</p>
          </div>
          <div class="p-5 grid grid-cols-2 gap-4">
            <div class="form-group col-span-2 md:col-span-1">
              <label>Product Name <span class="text-red-500">*</span></label>
              <input type="text" formControlName="productName" placeholder="e.g. Savings Plus" maxlength="100" />
            </div>
            <div class="form-group col-span-2 md:col-span-1">
              <label>Product Code <span class="text-xs text-slate-400 font-normal ml-1">(auto-generated, read-only)</span></label>
              <input type="text" [value]="product.productCode" readonly
                     class="bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed" />
            </div>
            <div class="form-group col-span-2">
              <label>Description <span class="text-slate-400 text-xs ml-1">(optional)</span></label>
              <textarea formControlName="description" rows="2" placeholder="Brief description for branch staff..."></textarea>
            </div>
            <!-- Account Type — read-only (immutable after creation) -->
            <div class="form-group">
              <label>Account Type <span class="text-xs text-slate-400 font-normal ml-1">(immutable)</span></label>
              <input type="text" [value]="getTypeLabel(product.accountType)" readonly
                     class="bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed" />
            </div>
            <div class="form-group">
              <label>Sub-type</label>
              <div class="flex flex-wrap gap-2">
                <button *ngFor="let sub of availableSubtypes" type="button"
                        (click)="form.get('accountSubtype')?.setValue(sub); cdr.detectChanges()"
                        class="px-3 py-1 rounded-lg text-xs font-bold border transition-all"
                        [class.bg-primary-600]="form.get('accountSubtype')?.value === sub"
                        [class.text-white]="form.get('accountSubtype')?.value === sub"
                        [class.border-primary-600]="form.get('accountSubtype')?.value === sub"
                        [class.border-slate-200]="form.get('accountSubtype')?.value !== sub"
                        [class.text-slate-600]="form.get('accountSubtype')?.value !== sub">
                  {{ sub.replace(/_/g,' ') | titlecase }}
                </button>
              </div>
            </div>
            <!-- Currency from API -->
            <div class="form-group">
              <label>Currency</label>
              <div class="relative">
                <input type="text" [(ngModel)]="currencySearch" [ngModelOptions]="{standalone:true}"
                       (focus)="showCurrencyDropdown=true"
                       (blur)="onCurrencyBlur()"
                       [placeholder]="form.get('currency')?.value || 'Search currency...'"
                       class="w-full" />
                <div *ngIf="showCurrencyDropdown && filteredCurrencies().length > 0"
                     class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  <button *ngFor="let c of filteredCurrencies()" type="button"
                          (mousedown)="selectCurrency(c)"
                          class="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between">
                    <span class="font-bold text-slate-800 dark:text-slate-200">{{ c.code }}</span>
                    <span class="text-slate-400 text-xs">{{ c.name }} {{ c.symbol }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Section: Balance Rules ── -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-blue-50/60 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/40 flex items-center gap-2">
            <i class="pi pi-wallet text-blue-400 text-sm"></i>
            <p class="text-xs font-black text-blue-500 uppercase tracking-widest">Balance Rules</p>
          </div>
          <div class="p-5 grid grid-cols-3 gap-4">
            <div class="form-group !mb-0">
              <label>Min Opening (₹)</label>
              <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">₹</span>
                <input type="number" formControlName="minimumOpeningAmount" min="0" style="padding-left:1.8rem!important" /></div>
            </div>
            <div class="form-group !mb-0">
              <label>Min Balance / MAB (₹)</label>
              <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">₹</span>
                <input type="number" formControlName="minimumBalance" min="0" style="padding-left:1.8rem!important" /></div>
            </div>
            <div class="form-group !mb-0">
              <label>Max Balance (₹) <span class="text-slate-400 text-[10px]">(Opt)</span></label>
              <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">₹</span>
                <input type="number" formControlName="maximumBalance" min="0" style="padding-left:1.8rem!important" placeholder="No cap" /></div>
            </div>
          </div>
        </div>

        <!-- ── Section: Interest Configuration ── -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-emerald-50/60 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2">
            <i class="pi pi-percentage text-emerald-500 text-sm"></i>
            <p class="text-xs font-black text-emerald-600 uppercase tracking-widest">Interest Configuration</p>
          </div>
          <div class="p-5 grid grid-cols-2 gap-4">
            <div class="form-group !mb-0">
              <label>Annual Rate (% p.a.)</label>
              <input type="number" formControlName="interestRate" min="0" max="100" step="0.0001" placeholder="e.g. 7.5" />
            </div>
            <div class="form-group !mb-0">
              <label>Rate Type</label>
              <select formControlName="interestRateType">
                <option value="FIXED">Fixed Rate</option>
                <option value="FLOATING">Floating (MCLR-linked)</option>
              </select>
            </div>
            <div class="form-group !mb-0">
              <label>Payout Frequency</label>
              <select formControlName="interestPayoutFreq">
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half-Yearly</option>
                <option value="YEARLY">Yearly</option>
                <option value="AT_MATURITY">At Maturity</option>
              </select>
            </div>
            <div class="form-group !mb-0">
              <label>Compounding Frequency</label>
              <select formControlName="compoundingFreq">
                <option value="DAILY">Daily</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="HALF_YEARLY">Half-Yearly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div class="form-group !mb-0 flex items-center gap-3 pt-4">
              <p-inputSwitch formControlName="autoInterestCredit"></p-inputSwitch>
              <label class="!mb-0 text-sm font-medium text-slate-700 dark:text-slate-300">Auto-Credit Interest</label>
            </div>
            <div class="form-group !mb-0">
              <label>Credit Day of Month (1–28)</label>
              <input type="number" formControlName="creditDayOfMonth" min="1" max="28" placeholder="1" />
            </div>
            <div class="form-group !mb-0">
              <label>Senior Citizen Extra Rate (%)</label>
              <input type="number" formControlName="seniorCitizenExtraRate" min="0" max="5" step="0.25" placeholder="e.g. 0.5" />
            </div>
          </div>
        </div>

        <!-- ── Section: Tenure (FD / Loans) ── -->
        <div *ngIf="isDepositWithTenure || isLoanType" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <i class="pi pi-clock text-slate-400 text-sm"></i>
            <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Tenure</p>
          </div>
          <div class="p-5 grid grid-cols-3 gap-4">
            <div class="form-group !mb-0">
              <label>Min Tenure (months)</label>
              <input type="number" formControlName="minTenureMonths" min="1" placeholder="e.g. 6" />
            </div>
            <div class="form-group !mb-0">
              <label>Max Tenure (months)</label>
              <input type="number" formControlName="maxTenureMonths" min="1" placeholder="e.g. 360" />
            </div>
            <div class="form-group !mb-0">
              <label>Default Tenure (months)</label>
              <input type="number" formControlName="defaultTenureMonths" min="1" placeholder="e.g. 24" />
            </div>
          </div>
        </div>

        <!-- ── Section: Loan Parameters ── -->
        <div *ngIf="isLoanType" class="bg-white dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-900/40 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-red-50/60 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/40 flex items-center gap-2">
            <i class="pi pi-credit-card text-red-400 text-sm"></i>
            <p class="text-xs font-black text-red-500 uppercase tracking-widest">Loan Parameters</p>
          </div>
          <div class="p-5 grid grid-cols-2 gap-4">
            <div class="form-group !mb-0">
              <label>Min Loan Amount (₹)</label>
              <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">₹</span>
                <input type="number" formControlName="minLoanAmount" min="0" style="padding-left:1.8rem!important" placeholder="e.g. 50000" /></div>
            </div>
            <div class="form-group !mb-0">
              <label>Max Loan Amount (₹)</label>
              <div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">₹</span>
                <input type="number" formControlName="maxLoanAmount" min="0" style="padding-left:1.8rem!important" placeholder="e.g. 5000000" /></div>
            </div>
            <div class="form-group !mb-0">
              <label>Processing Fee (%)</label>
              <input type="number" formControlName="processingFeePercent" min="0" max="10" step="0.01" placeholder="e.g. 0.5" />
            </div>
            <div class="form-group !mb-0">
              <label>Foreclosure Charge (%)</label>
              <input type="number" formControlName="foreclosureChargePercent" min="0" max="10" step="0.01" placeholder="e.g. 2.0" />
            </div>
            <div class="form-group !mb-0">
              <label>Penal Interest Rate (extra %)</label>
              <input type="number" formControlName="penalInterestRate" min="0" max="30" step="0.01" placeholder="e.g. 2.0" />
            </div>
          </div>
        </div>

        <!-- ── Section: Transaction Limits ── -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <i class="pi pi-arrow-right-arrow-left text-slate-400 text-sm"></i>
            <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Transaction Limits</p>
          </div>
          <div class="p-5 grid grid-cols-3 gap-4">
            <div class="form-group !mb-0">
              <label>Daily Withdrawal (₹)</label>
              <input type="number" formControlName="dailyWithdrawalLimit" min="0" />
            </div>
            <div class="form-group !mb-0">
              <label>ATM Daily Limit (₹)</label>
              <input type="number" formControlName="atmDailyLimit" min="0" />
            </div>
            <div class="form-group !mb-0">
              <label>Online Txn Limit (₹)</label>
              <input type="number" formControlName="onlineTxnDailyLimit" min="0" />
            </div>
          </div>
        </div>

        <!-- ── Section: Eligibility & Features ── -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <i class="pi pi-check-square text-slate-400 text-sm"></i>
            <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Eligibility &amp; Features</p>
          </div>
          <div class="p-5 grid grid-cols-2 gap-4">
            <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-primary-300 transition-colors">
              <input type="checkbox" [checked]="form.get('seniorCitizenOnly')?.value"
                     (change)="form.get('seniorCitizenOnly')?.setValue($any($event.target).checked)"
                     class="w-4 h-4 rounded accent-primary-600" />
              <div><p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Senior Citizens Only</p>
                <p class="text-[11px] text-slate-400">Age 60+ accounts only</p></div>
            </label>
            <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-primary-300 transition-colors">
              <input type="checkbox" [checked]="form.get('nriOnly')?.value"
                     (change)="form.get('nriOnly')?.setValue($any($event.target).checked)"
                     class="w-4 h-4 rounded accent-primary-600" />
              <div><p class="text-sm font-semibold text-slate-800 dark:text-slate-200">NRI Only</p>
                <p class="text-[11px] text-slate-400">Non-Resident Indians only</p></div>
            </label>
            <div class="col-span-2">
              <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Product Features</p>
              <div class="grid grid-cols-2 gap-2">
                <label *ngFor="let feat of featuresList"
                       class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-primary-300 transition-colors">
                  <input type="checkbox" [checked]="getFeature(feat.key)"
                         (change)="setFeature(feat.key, $any($event.target).checked)"
                         class="w-3.5 h-3.5 rounded accent-primary-600 shrink-0" />
                  <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ feat.label }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- end of last section -->

      </form>
    </div>

    <!-- ═══════════════ SIMULATION PANEL ═══════════════ -->
    <div *ngIf="showSimPanel"
         class="rounded-2xl border border-violet-200 dark:border-violet-800/40 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-800"
         style="width:480px; min-width:480px; max-height:calc(100vh - 180px); position:sticky; top:80px; flex-shrink:0">

      <!-- Sim header -->
      <div class="flex items-center justify-between px-5 py-4 bg-white dark:bg-slate-900 border-b border-violet-100 dark:border-violet-800/40 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <i class="pi pi-calculator text-violet-600 dark:text-violet-400"></i>
          </div>
          <div>
            <p class="font-bold text-slate-900 dark:text-white">Financial Simulator</p>
            <p class="text-xs text-slate-400">Reflects form values above — live</p>
          </div>
        </div>
        <button type="button" (click)="showSimPanel=false"
                class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
          <i class="pi pi-times text-xs"></i>
        </button>
      </div>

      <!-- Config badges -->
      <div class="flex flex-wrap gap-1.5 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
          {{ form.get('interestRate')?.value || '0' }}% p.a.
        </span>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
              [class.bg-amber-100]="form.get('interestRateType')?.value==='FLOATING'"
              [class.text-amber-700]="form.get('interestRateType')?.value==='FLOATING'"
              [class.bg-blue-100]="form.get('interestRateType')?.value!=='FLOATING'"
              [class.text-blue-700]="form.get('interestRateType')?.value!=='FLOATING'">
          {{ form.get('interestRateType')?.value==='FLOATING' ? 'Floating' : 'Fixed' }}
        </span>
        <span *ngIf="!isLoanType" class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
          Cmpd: {{ form.get('compoundingFreq')?.value }}
        </span>
        <span *ngIf="!isLoanType" class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
          {{ form.get('interestPayoutFreq')?.value }}
        </span>
        <span *ngIf="(form.get('seniorCitizenExtraRate')?.value||0)>0" class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700">
          +{{ form.get('seniorCitizenExtraRate')?.value }}% Sr.
        </span>
      </div>

      <!-- Scrollable sim body -->
      <div class="overflow-y-auto flex-1 custom-scrollbar" style="padding:16px; display:flex; flex-direction:column; gap:14px">

        <!-- Inputs -->
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Simulation Inputs</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-group !mb-0">
              <label class="!text-xs">{{ isLoanType ? 'Loan Amount (₹)' : 'Principal (₹)' }}</label>
              <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none z-10">₹</span>
                <input type="number" [(ngModel)]="simAmount" (ngModelChange)="computeSimulation()" [ngModelOptions]="{standalone:true}"
                       style="padding-left:1.5rem!important" class="!text-sm" [placeholder]="isLoanType?'500000':'100000'" min="1" />
              </div>
            </div>
            <div class="form-group !mb-0">
              <label class="!text-xs">Tenure (months)</label>
              <input type="number" [(ngModel)]="simTenure" (ngModelChange)="computeSimulation()" [ngModelOptions]="{standalone:true}"
                     class="!text-sm" placeholder="12" min="1" />
            </div>
          </div>
        </div>

        <!-- No rate -->
        <div *ngIf="!form.get('interestRate')?.value" class="text-center py-8 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300">
          <i class="pi pi-percentage text-4xl text-slate-200 block mb-2"></i>
          <p class="text-sm font-semibold text-slate-400">Set Annual Rate to see results</p>
        </div>

        <!-- DEPOSIT results -->
        <ng-container *ngIf="!isLoanType && form.get('interestRate')?.value && simResults">
          <!-- Hero -->
          <div class="rounded-xl overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
              <p class="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">
                {{ simResults.payFreq==='AT_MATURITY'?'Cumulative Maturity':'Total Received' }}
              </p>
              <p class="text-3xl font-black text-white mt-1">&#8377;{{ simResults.maturityAmount | number:'1.0-0' }}</p>
              <p class="text-emerald-100 text-xs mt-1">
                &#8377;{{ simAmount | number:'1.0-0' }} + &#8377;{{ simResults.compoundInterest | number:'1.0-0' }} interest
              </p>
            </div>
            <div class="grid grid-cols-2 divide-x divide-slate-100 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div class="p-3 text-center">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Compound Interest</p>
                <p class="text-base font-black text-emerald-600 mt-0.5">&#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</p>
                <p class="text-[10px] text-slate-400">{{ simResults.compFreq }}</p>
              </div>
              <div class="p-3 text-center">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Simple Interest</p>
                <p class="text-base font-black text-blue-600 mt-0.5">&#8377;{{ simResults.simpleInterest | number:'1.0-0' }}</p>
                <p class="text-[10px] text-slate-400">flat {{ form.get('interestRate')?.value }}%</p>
              </div>
              <div class="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Eff. Annual Rate</p>
                <p class="text-base font-black text-violet-600 mt-0.5">{{ simResults.effectiveRate | number:'1.3-3' }}%</p>
                <p class="text-[10px] text-slate-400">vs {{ form.get('interestRate')?.value }}% nominal</p>
              </div>
              <div class="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Compounding Bonus</p>
                <p class="text-base font-black text-teal-600 mt-0.5">+&#8377;{{ (simResults.compoundInterest - simResults.simpleInterest) | number:'1.0-0' }}</p>
                <p class="text-[10px] text-slate-400">extra earned</p>
              </div>
            </div>
          </div>
          <!-- Compound vs Simple bar -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Compounding vs Simple</p>
            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>Compound ({{ simResults.compFreq }})</span>
                  <span class="font-bold text-emerald-700">&#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</span>
                </div>
                <div class="h-5 bg-slate-100 rounded-lg overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-lg" style="width:100%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block"></span>Simple (no compounding)</span>
                  <span class="font-bold text-blue-700">&#8377;{{ simResults.simpleInterest | number:'1.0-0' }}</span>
                </div>
                <div class="h-5 bg-slate-100 rounded-lg overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-blue-300 to-blue-500 rounded-lg transition-all duration-700"
                       [style.width]="((simResults.simpleInterest/simResults.compoundInterest)*100)+'%'"></div>
                </div>
              </div>
              <p class="text-[10px] text-slate-400 text-center">{{ simResults.compFreq }} compounding earns <strong class="text-emerald-600">&#8377;{{ (simResults.compoundInterest-simResults.simpleInterest)|number:'1.0-0' }} extra</strong></p>
            </div>
          </div>
          <!-- Payout schedule -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Payout Schedule</p>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    [class.bg-emerald-100]="simResults.payFreq==='AT_MATURITY'"
                    [class.text-emerald-700]="simResults.payFreq==='AT_MATURITY'"
                    [class.bg-blue-100]="simResults.payFreq!=='AT_MATURITY'"
                    [class.text-blue-700]="simResults.payFreq!=='AT_MATURITY'">{{ form.get('interestPayoutFreq')?.value }}</span>
            </div>
            <div class="divide-y divide-slate-100">
              <div *ngFor="let row of simResults.payoutSchedule"
                   class="flex items-center justify-between px-4 py-2.5"
                   [class.bg-emerald-50]="row.highlight">
                <span class="text-xs text-slate-500">{{ row.label }}</span>
                <span class="text-sm font-black font-mono ml-3"
                      [class.text-emerald-700]="row.highlight" [class.text-slate-700]="!row.highlight">
                  &#8377;{{ row.amount | number:'1.2-2' }}
                </span>
              </div>
            </div>
          </div>
          <!-- Auto credit -->
          <div class="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <i class="pi pi-calendar text-blue-500 shrink-0"></i>
            <p class="text-xs font-semibold text-blue-700">{{ simResults.autoCreditInfo }}</p>
          </div>
          <!-- Senior citizen -->
          <div *ngIf="simResults.seniorExtra>0" class="bg-teal-50 rounded-xl border border-teal-200 overflow-hidden">
            <div class="px-4 py-2.5 bg-teal-100/60 border-b border-teal-200">
              <p class="text-[10px] font-black text-teal-700 uppercase tracking-widest">Senior Citizen +{{ simResults.seniorExtra }}%</p>
            </div>
            <div class="grid grid-cols-3 divide-x divide-teal-100">
              <div class="p-3 text-center">
                <p class="text-[10px] text-teal-600">Regular</p>
                <p class="text-sm font-black text-slate-700">{{ form.get('interestRate')?.value }}%</p>
                <p class="text-[10px] text-slate-500">&#8377;{{ simResults.maturityAmount|number:'1.0-0' }}</p>
              </div>
              <div class="p-3 text-center bg-teal-50">
                <p class="text-[10px] text-teal-600">Senior</p>
                <p class="text-sm font-black text-teal-700">{{ (+(form.get('interestRate')?.value||0)+simResults.seniorExtra).toFixed(2) }}%</p>
                <p class="text-[10px] font-bold text-teal-600">&#8377;{{ simResults.seniorMaturity|number:'1.0-0' }}</p>
              </div>
              <div class="p-3 text-center">
                <p class="text-[10px] text-teal-600">Extra</p>
                <p class="text-sm font-black text-emerald-600">+&#8377;{{ simResults.seniorExtra2|number:'1.0-0' }}</p>
                <p class="text-[10px] text-slate-500">benefit</p>
              </div>
            </div>
          </div>
          <!-- Year growth chart -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Year-by-Year Growth</p>
            <div class="space-y-2">
              <ng-container *ngFor="let row of simResults.yearGrowth">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold text-slate-500 w-8 text-right shrink-0">Yr {{ row.year }}</span>
                  <div class="flex-1 relative h-6 bg-slate-100 rounded overflow-hidden">
                    <div class="absolute inset-y-0 left-0 bg-blue-200 rounded" [style.width]="((simAmount/simResults.maturityAmount)*100)+'%'"></div>
                    <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-emerald-500 rounded transition-all duration-500"
                         [style.width]="((row.amount/simResults.maturityAmount)*100)+'%'"></div>
                    <div class="absolute inset-0 flex items-center px-2">
                      <span class="text-[10px] font-bold text-white drop-shadow">&#8377;{{ row.amount|number:'1.0-0' }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-emerald-600 w-16 text-right shrink-0">+&#8377;{{ row.interest|number:'1.0-0' }}</span>
                </div>
              </ng-container>
            </div>
          </div>
        </ng-container>

        <!-- LOAN results -->
        <ng-container *ngIf="isLoanType && form.get('interestRate')?.value && simResults">
          <!-- Hero EMI -->
          <div class="rounded-xl overflow-hidden">
            <div class="bg-gradient-to-r from-red-600 to-rose-600 p-4">
              <p class="text-red-100 text-[10px] font-bold uppercase tracking-widest">Monthly EMI — Reducing Balance</p>
              <p class="text-3xl font-black text-white mt-1">&#8377;{{ simResults.emi | number:'1.2-2' }}</p>
              <p class="text-red-100 text-xs mt-1">{{ simResults.N }} months at {{ form.get('interestRate')?.value }}% p.a.</p>
            </div>
            <div class="grid grid-cols-3 divide-x divide-slate-100 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 rounded-b-xl">
              <div class="p-3 text-center">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Principal</p>
                <p class="text-sm font-black text-blue-600 mt-0.5">&#8377;{{ simAmount|number:'1.0-0' }}</p>
              </div>
              <div class="p-3 text-center">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Total Interest</p>
                <p class="text-sm font-black text-red-600 mt-0.5">&#8377;{{ simResults.totalInterest|number:'1.0-0' }}</p>
              </div>
              <div class="p-3 text-center">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Total Payable</p>
                <p class="text-sm font-black text-slate-800 dark:text-white mt-0.5">&#8377;{{ simResults.totalPayable|number:'1.0-0' }}</p>
              </div>
            </div>
          </div>
          <!-- Cost bars -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cost Breakdown</p>
            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="flex items-center gap-1.5 text-blue-600"><span class="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span>Principal</span>
                  <span class="font-bold text-blue-700">&#8377;{{ simAmount|number:'1.0-0' }} ({{ (100-simResults.interestPercent)|number:'1.1-1' }}%)</span>
                </div>
                <div class="h-5 bg-slate-100 rounded-lg overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg" [style.width]="(100-simResults.interestPercent)+'%'"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="flex items-center gap-1.5 text-red-600"><span class="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block"></span>Interest</span>
                  <span class="font-bold text-red-700">&#8377;{{ simResults.totalInterest|number:'1.0-0' }} ({{ simResults.interestPercent|number:'1.1-1' }}%)</span>
                </div>
                <div class="h-5 bg-slate-100 rounded-lg overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-lg" [style.width]="simResults.interestPercent+'%'"></div>
                </div>
              </div>
            </div>
          </div>
          <!-- Charges -->
          <div *ngIf="simResults.processingFee>0||simResults.forecloseFee>0" class="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
            <div class="px-4 py-2.5 bg-amber-100/60 border-b border-amber-200">
              <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Charges &amp; Fees</p>
            </div>
            <div class="p-4 space-y-3">
              <div *ngIf="simResults.processingFee>0" class="flex items-center justify-between text-xs">
                <span class="text-amber-700">Processing Fee ({{ simResults.procFeePct }}%)</span>
                <span class="font-bold text-amber-700">&#8377;{{ simResults.processingFee|number:'1.0-0' }}</span>
              </div>
              <div *ngIf="simResults.forecloseFee>0" class="flex items-center justify-between text-xs border-t border-amber-200 pt-3">
                <span class="text-amber-700">Foreclosure Charge ({{ simResults.foreclosePct }}%)</span>
                <span class="font-bold text-amber-700">&#8377;{{ simResults.forecloseFee|number:'1.0-0' }}</span>
              </div>
              <div class="flex items-center justify-between text-sm font-bold border-t border-amber-300 pt-3">
                <span class="text-amber-900">Total Cost (incl. fees)</span>
                <span class="text-amber-900">&#8377;{{ (simResults.totalPayable+simResults.processingFee)|number:'1.0-0' }}</span>
              </div>
            </div>
          </div>
          <!-- Penal -->
          <div *ngIf="simResults.penalRate>0" class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <i class="pi pi-exclamation-circle text-red-500 text-lg shrink-0 mt-0.5"></i>
            <div>
              <p class="text-sm font-bold text-red-700">Penal +{{ simResults.penalRate }}% on overdue</p>
              <p class="text-xs text-red-600 mt-0.5">1 month overdue → extra ≈ <strong>&#8377;{{ simResults.penalOnEmi|number:'1.2-2' }}</strong></p>
            </div>
          </div>
          <!-- Year repayment chart -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Year-by-Year Repayment</p>
            <div class="space-y-2">
              <ng-container *ngFor="let row of simResults.yearSummary">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold text-slate-500 w-8 text-right shrink-0">Yr {{ row.year }}</span>
                  <div class="flex-1 h-6 rounded overflow-hidden flex">
                    <div class="bg-blue-400 flex items-center justify-center transition-all duration-500"
                         [style.width]="((row.principal/(row.principal+row.interest))*100)+'%'">
                      <span class="text-[9px] font-bold text-white px-1 truncate">&#8377;{{ row.principal|number:'1.0-0' }}</span>
                    </div>
                    <div class="bg-red-400 flex items-center justify-center transition-all duration-500"
                         [style.width]="((row.interest/(row.principal+row.interest))*100)+'%'">
                      <span class="text-[9px] font-bold text-white px-1 truncate">&#8377;{{ row.interest|number:'1.0-0' }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] text-slate-400 w-20 text-right font-mono shrink-0">&#8377;{{ row.balance|number:'1.0-0' }}</span>
                </div>
              </ng-container>
            </div>
          </div>
          <!-- Amortization -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amortization</p>
              <span class="text-[10px] text-slate-400">{{ simResults.N>24?'Key months':'All '+simResults.N+' months' }}</span>
            </div>
            <table class="w-full">
              <thead><tr class="border-b border-slate-100 bg-slate-50/50">
                <th class="text-left px-4 py-2 text-[10px] font-bold text-slate-500">Month</th>
                <th class="text-right px-4 py-2 text-[10px] font-bold text-blue-500">Principal ↑</th>
                <th class="text-right px-4 py-2 text-[10px] font-bold text-red-500">Interest ↓</th>
                <th class="text-right px-4 py-2 text-[10px] font-bold text-slate-400">Balance</th>
              </tr></thead>
              <tbody>
                <ng-container *ngFor="let row of simResults.amortization; let i=index">
                  <tr *ngIf="i>0&&simResults.amortization[i-1].month+1<row.month">
                    <td colspan="4" class="px-4 py-1 text-center text-[10px] text-slate-300">&bull; &bull; skipped &bull; &bull;</td>
                  </tr>
                  <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      [class.bg-amber-50]="row.isLast">
                    <td class="px-4 py-2 text-xs font-semibold text-slate-700">{{ row.isLast?'M'+row.month+' ✓':row.isMid?'M'+row.month+' (mid)':'M'+row.month }}</td>
                    <td class="px-4 py-2 text-right font-mono text-xs font-bold text-blue-600">&#8377;{{ row.principal|number:'1.0-0' }}</td>
                    <td class="px-4 py-2 text-right font-mono text-xs font-bold text-red-500">&#8377;{{ row.interest|number:'1.0-0' }}</td>
                    <td class="px-4 py-2 text-right font-mono text-xs text-slate-600">&#8377;{{ row.balance|number:'1.0-0' }}</td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
            <div class="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
              Principal ↑ increases, Interest ↓ decreases each month — reducing balance.
            </div>
          </div>
        </ng-container>

      </div><!-- end sim scroll -->
    </div><!-- end sim panel -->

  </div><!-- end main layout -->
</div>
  `,
})
export class AccountProductDetailComponent implements OnInit, OnDestroy {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private http   = inject(HttpClient);
  private fb     = inject(FormBuilder);
  private msg    = inject(MessageService);
  readonly cdr   = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  bankId    = '';
  productId = '';
  product: any = null;

  loading = signal(true);
  saving  = signal(false);
  deleting = signal(false);

  showDeleteConfirm = false;
  isEditing = false;

  // Currencies from API
  currencies: any[] = [];
  currencySearch = '';
  showCurrencyDropdown = false;

  // Simulation
  showSimPanel = false;
  simAmount    = 100000;
  simTenure    = 12;
  simResults: any = null;

  readonly featuresList = [
    { key: 'debitCard',     label: 'Debit Card' },
    { key: 'chequebook',    label: 'Cheque Book' },
    { key: 'sweepFacility', label: 'Sweep Facility' },
    { key: 'autoRenewal',   label: 'Auto Renewal' },
    { key: 'tdsApplicable', label: 'TDS Applicable' },
    { key: 'form15gAllowed',label: 'Form 15G/H Allowed' },
    { key: 'netBanking',    label: 'Net Banking' },
    { key: 'upiEnabled',    label: 'UPI Enabled' },
    { key: 'taxBenefit80C', label: 'Tax Benefit (80C)' },
    { key: 'dematLinked',   label: 'Demat Linked' },
  ];

  features: Record<string, any> = {};

  form = this.fb.group({
    productName:             ['', [Validators.required, Validators.maxLength(100)]],
    description:             [''],
    accountSubtype:          [''],
    currency:                ['INR'],
    minimumOpeningAmount:    [0],
    minimumBalance:          [0],
    maximumBalance:          [null],
    interestRate:            [null],
    interestRateType:        ['FIXED'],
    interestPayoutFreq:      ['QUARTERLY'],
    compoundingFreq:         ['QUARTERLY'],
    autoInterestCredit:      [true],
    creditDayOfMonth:        [1],
    seniorCitizenExtraRate:  [null],
    minTenureMonths:         [null],
    maxTenureMonths:         [null],
    defaultTenureMonths:     [null],
    minLoanAmount:           [null],
    maxLoanAmount:           [null],
    processingFeePercent:    [null],
    foreclosureChargePercent:[null],
    penalInterestRate:       [null],
    dailyWithdrawalLimit:    [25000],
    atmDailyLimit:           [10000],
    onlineTxnDailyLimit:     [200000],
    overdraftLimit:          [null],
    seniorCitizenOnly:       [false],
    nriOnly:                 [false],
  });

  ngOnInit() {
    // Extract route params
    let cur: any = this.route.root;
    let params: any = {};
    while (cur) { if (cur.snapshot?.params) params = { ...params, ...cur.snapshot.params }; cur = cur.firstChild; }
    this.bankId    = params['bankId'] || '';
    this.productId = params['productId'] || '';

    this.loadCurrencies();
    this.loadProduct();

    // Reactive simulation
    this.form.valueChanges.pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => { if (this.showSimPanel) this.computeSimulation(); });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadProduct() {
    this.loading.set(true);
    this.http.get<any>(`/banks/${this.bankId}/account-products/${this.productId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          this.product  = res.data ?? res;
          this.features = this.product.features ?? {};
          this.form.patchValue({ ...this.product });
          this.simAmount  = this.product.minimumOpeningAmount || 100000;
          this.simTenure  = this.product.defaultTenureMonths || 12;
          this.isEditing  = false;
          // Start in read-only / display mode
          this.form.disable({ emitEvent: false });
          this.cdr.detectChanges();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'Product not found.' });
          this.goBack();
        },
      });
  }

  loadCurrencies() {
    this.http.get<any>('/currencies?activeOnly=true')
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (res) => { this.currencies = res.data ?? res ?? []; this.cdr.detectChanges(); } });
  }

  filteredCurrencies(): any[] {
    const q = this.currencySearch.toLowerCase();
    return this.currencies.filter(c =>
      !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }

  selectCurrency(c: any) {
    this.form.get('currency')?.setValue(c.code);
    this.currencySearch = '';
    this.showCurrencyDropdown = false;
    this.cdr.detectChanges();
  }

  onCurrencyBlur() {
    setTimeout(() => { this.showCurrencyDropdown = false; this.cdr.detectChanges(); }, 200);
  }

  get isLoanType(): boolean {
    return LOAN_TYPES.includes(this.product?.accountType ?? '');
  }

  get isDepositWithTenure(): boolean {
    return DEPOSIT_WITH_TENURE.includes(this.product?.accountType ?? '');
  }

  get availableSubtypes(): string[] {
    return SUBTYPE_MAP[this.product?.accountType] ?? [];
  }

  getTypeLabel(type: string): string {
    return ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;
  }

  getFeature(key: string): boolean { return !!this.features[key]; }
  setFeature(key: string, val: boolean) { this.features = { ...this.features, [key]: val }; }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const { accountType: _immutable, ...editableFields } = this.form.getRawValue() as any;
    const val = { ...editableFields, features: this.features };
    this.http.patch(`/banks/${this.bankId}/account-products/${this.productId}`, val)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Product updated successfully.' });
          this.isEditing = false;
          this.loadProduct();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Save failed.' });
        },
      });
  }

  startEdit() {
    this.isEditing = true;
    this.form.enable({ emitEvent: false });
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.isEditing = false;
    // Revert to saved values and re-disable
    this.form.patchValue({ ...this.product }, { emitEvent: false });
    this.features = { ...this.product.features ?? {} };
    this.form.disable({ emitEvent: false });
    this.cdr.detectChanges();
  }

  goBack() {
    this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'accountproducts' } });
  }

  deleteProduct() {
    this.deleting.set(true);
    this.http.delete(`/banks/${this.bankId}/account-products/${this.productId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.deleting.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${this.product.productName} deleted.` });
          this.showDeleteConfirm = false;
          setTimeout(() => this.goBack(), 800);
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Delete failed.' });
        },
      });
  }

  toggleProductStatus() {
    const newStatus = !this.product.isActive;
    this.saving.set(true);
    this.http.patch(`/banks/${this.bankId}/account-products/${this.productId}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.product = { ...this.product, isActive: newStatus };
          this.msg.add({ severity: 'success', summary: 'Updated', detail: `Product ${newStatus ? 'activated' : 'deactivated'}.` });
          this.cdr.detectChanges();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Status update failed.' });
        },
      });
  }

  toggleSim() {
    this.showSimPanel = !this.showSimPanel;
    if (this.showSimPanel) { this.seedSimInputs(); this.computeSimulation(); }
    this.cdr.detectChanges();
  }

  // ── Simulation (same formulas as bank-account-products) ────────────────
  seedSimInputs() {
    if (this.isLoanType) {
      const minL = parseFloat(String(this.form.get('minLoanAmount')?.value ?? '')) || 0;
      const maxL = parseFloat(String(this.form.get('maxLoanAmount')?.value ?? '')) || 0;
      this.simAmount = minL && maxL ? Math.round((minL + maxL) / 2) : (minL || maxL || 500000);
    } else {
      const mo = parseFloat(String(this.form.get('minimumOpeningAmount')?.value ?? '')) || 0;
      this.simAmount = mo >= 1000 ? mo : 100000;
    }
    const def = parseInt(String(this.form.get('defaultTenureMonths')?.value ?? '')) || 0;
    const mn  = parseInt(String(this.form.get('minTenureMonths')?.value ?? '')) || 0;
    const mx  = parseInt(String(this.form.get('maxTenureMonths')?.value ?? '')) || 0;
    this.simTenure = def > 0 ? def : (mn && mx ? Math.round((mn + mx) / 2) : (mx || mn || 12));
  }

  computeSimulation() {
    const r          = parseFloat(String(this.form.get('interestRate')?.value ?? '')) || 0;
    const rateType   = this.form.get('interestRateType')?.value || 'FIXED';
    const compFreq   = this.form.get('compoundingFreq')?.value || 'QUARTERLY';
    const payFreq    = this.form.get('interestPayoutFreq')?.value || 'AT_MATURITY';
    const autoCredit = !!this.form.get('autoInterestCredit')?.value;
    const creditDay  = parseInt(String(this.form.get('creditDayOfMonth')?.value ?? '')) || 1;
    const seniorEx   = parseFloat(String(this.form.get('seniorCitizenExtraRate')?.value ?? '')) || 0;
    const procFeePct = parseFloat(String(this.form.get('processingFeePercent')?.value ?? '')) || 0;
    const foreclosePct = parseFloat(String(this.form.get('foreclosureChargePercent')?.value ?? '')) || 0;
    const penalRate  = parseFloat(String(this.form.get('penalInterestRate')?.value ?? '')) || 0;
    const minTenure  = parseInt(String(this.form.get('minTenureMonths')?.value ?? '')) || 0;
    const maxTenure  = parseInt(String(this.form.get('maxTenureMonths')?.value ?? '')) || 0;

    const P = this.simAmount || 0;
    let   N = this.simTenure || 12;
    if (minTenure > 0 && N < minTenure) N = minTenure;
    if (maxTenure > 0 && N > maxTenure) N = maxTenure;

    if (!r || !P) { this.simResults = null; this.cdr.detectChanges(); return; }

    const compPerYear: Record<string, number> = { DAILY:365, MONTHLY:12, QUARTERLY:4, HALF_YEARLY:2, YEARLY:1 };
    const payPerYear:  Record<string, number> = { MONTHLY:12, QUARTERLY:4, HALF_YEARLY:2, YEARLY:1, AT_MATURITY:0 };
    const n  = compPerYear[compFreq] ?? 4;
    const pp = payPerYear[payFreq] ?? 0;
    const t  = N / 12;

    if (this.isLoanType) {
      const mr = r / 100 / 12;
      const pow = Math.pow(1 + mr, N);
      const emi = mr > 0 ? P * mr * pow / (pow - 1) : P / N;
      const totalPayable  = emi * N;
      const totalInterest = totalPayable - P;
      const interestPercent = Math.round((totalInterest / totalPayable) * 100 * 10) / 10;
      const processingFee = procFeePct > 0 ? P * procFeePct / 100 : 0;
      const forecloseFee  = foreclosePct > 0 ? P * foreclosePct / 100 : 0;
      const penalOnEmi    = penalRate > 0 ? emi * penalRate / 100 / 12 : 0;

      // Amortization
      const displaySet = N <= 24
        ? new Set(Array.from({length:N},(_,i)=>i+1))
        : new Set([...Array.from({length:6},(_,i)=>i+1), Math.ceil(N/2), N-1, N]);
      const amortization: any[] = [];
      let bal = P;
      for (let m = 1; m <= N; m++) {
        const ip = bal * mr;
        const pp2 = Math.min(emi - ip, bal);
        bal -= pp2;
        if (displaySet.has(m)) {
          amortization.push({ month:m, principal:Math.round(pp2), interest:Math.round(ip), balance:Math.max(0,Math.round(bal)), isLast:m===N, isMid:m===Math.ceil(N/2)&&N>12 });
        }
      }

      // Year summary
      const yearSummary: any[] = [];
      let bal2 = P;
      for (let y = 1; y <= Math.ceil(N/12); y++) {
        let yInt=0, yPrin=0;
        const months = Math.min(12, N-(y-1)*12);
        for (let m=0;m<months;m++) { const ip=bal2*mr; const pp2=Math.min(emi-ip,bal2); yInt+=ip; yPrin+=pp2; bal2-=pp2; }
        yearSummary.push({ year:y, interest:Math.round(yInt), principal:Math.round(yPrin), balance:Math.max(0,Math.round(bal2)) });
      }

      this.simResults = { emi, totalPayable, totalInterest, interestPercent, processingFee, forecloseFee, procFeePct, foreclosePct, penalRate, penalOnEmi, amortization, yearSummary, N, minTenure, maxTenure, rateType };
    } else {
      const maturityAmount   = P * Math.pow(1 + (r/100)/n, n*t);
      const compoundInterest = maturityAmount - P;
      const simpleInterest   = P * r / 100 * t;
      const effectiveRate    = (Math.pow(1 + (r/100)/n, n) - 1) * 100;
      const growthPercent    = Math.round((compoundInterest/P)*100*10)/10;

      const payoutSchedule: any[] = [];
      if (pp > 0) {
        const perPeriod = P * (r/100) / pp;
        const periodsInTenure = t * pp;
        const totalPaidOut = perPeriod * periodsInTenure;
        const lbl: Record<string,string> = { MONTHLY:'Per Month', QUARTERLY:'Per Quarter', HALF_YEARLY:'Per 6 Months', YEARLY:'Per Year' };
        payoutSchedule.push({ label: lbl[payFreq]||'Per Period', amount: perPeriod, highlight: true });
        payoutSchedule.push({ label: `Total over ${N}m (${periodsInTenure.toFixed(0)} payouts)`, amount: totalPaidOut, highlight: false });
        payoutSchedule.push({ label: 'Principal at maturity', amount: P, highlight: false });
        payoutSchedule.push({ label: 'Net total received', amount: P + totalPaidOut, highlight: true });
      } else {
        payoutSchedule.push({ label: 'Maturity (Principal + Interest)', amount: maturityAmount, highlight: true });
      }

      let seniorMaturity=0, seniorInterest=0, seniorExtra2=0;
      if (seniorEx > 0) {
        const sr = r + seniorEx;
        seniorMaturity  = P * Math.pow(1 + (sr/100)/n, n*t);
        seniorInterest  = seniorMaturity - P;
        seniorExtra2    = seniorInterest - compoundInterest;
      }

      const yearGrowth: any[] = [];
      for (let y=1; y<=Math.ceil(t); y++) {
        const yt = Math.min(y, t);
        const amt = P * Math.pow(1+(r/100)/n, n*yt);
        const sAmt = seniorEx > 0 ? P * Math.pow(1+((r+seniorEx)/100)/n, n*yt) : null;
        yearGrowth.push({ year:y, amount:Math.round(amt), interest:Math.round(amt-P), seniorAmount:sAmt?Math.round(sAmt):null });
      }

      const autoCreditInfo = autoCredit
        ? `Interest credited on day ${creditDay} of every ${{MONTHLY:'month',QUARTERLY:'3rd month',HALF_YEARLY:'6th month',YEARLY:'year'}[payFreq]||'period'}`
        : 'Manual credit (auto-credit off)';

      this.simResults = { maturityAmount, compoundInterest, simpleInterest, effectiveRate, growthPercent, payFreq, payoutSchedule, seniorExtra:seniorEx, seniorMaturity, seniorInterest, seniorExtra2, yearGrowth, compFreq, n, rateType, autoCredit, autoCreditInfo, creditDay, N, minTenure, maxTenure };
    }
    this.cdr.detectChanges();
  }
}
