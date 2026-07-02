import {
  Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges,
  inject, signal, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective }   from '../../../../../../shared/directives/has-permission.directive';
import { StatusBadgeComponent }     from '../../../../../../shared/components/ui/status-badge/status-badge.component';
import { EmptyStateComponent }      from '../../../../../../shared/components/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../../../shared/components/ui/loading-skeleton/loading-skeleton.component';

// ─── Static data ──────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  // Deposits
  { value: 'SAVINGS',           label: 'Savings Account',        category: 'DEPOSIT' },
  { value: 'SAVINGS_BASIC',     label: 'Basic Savings (PMJDY)',   category: 'DEPOSIT' },
  { value: 'CURRENT',           label: 'Current Account',         category: 'DEPOSIT' },
  { value: 'FIXED_DEPOSIT',     label: 'Fixed Deposit (FD)',      category: 'DEPOSIT' },
  { value: 'RECURRING_DEPOSIT', label: 'Recurring Deposit (RD)', category: 'DEPOSIT' },
  { value: 'NRE_SAVINGS',       label: 'NRE Savings',             category: 'DEPOSIT' },
  { value: 'NRO_SAVINGS',       label: 'NRO Savings',             category: 'DEPOSIT' },
  // Loans
  { value: 'CASH_CREDIT',       label: 'Cash Credit (CC)',        category: 'LOAN'    },
  { value: 'OVERDRAFT',         label: 'Overdraft (OD)',          category: 'LOAN'    },
  { value: 'HOME_LOAN',         label: 'Home Loan',               category: 'LOAN'    },
  { value: 'PERSONAL_LOAN',     label: 'Personal Loan',           category: 'LOAN'    },
  { value: 'AUTO_LOAN',         label: 'Auto / Vehicle Loan',     category: 'LOAN'    },
  { value: 'GOLD_LOAN',         label: 'Gold Loan',               category: 'LOAN'    },
  { value: 'EDUCATION_LOAN',    label: 'Education Loan',          category: 'LOAN'    },
];

const SUBTYPE_MAP: Record<string, string[]> = {
  SAVINGS:           ['REGULAR', 'SALARY', 'BSBD_PMJDY', 'SENIOR_CITIZEN', 'MINOR', 'NRI'],
  SAVINGS_BASIC:     ['REGULAR', 'BSBD_PMJDY'],
  CURRENT:           ['REGULAR', 'PREMIUM', 'STARTUP', 'CORPORATE', 'FLEXI'],
  FIXED_DEPOSIT:     ['REGULAR', 'SENIOR_CITIZEN', 'TAX_SAVER_80C', 'FLEXI_FD', 'CUMULATIVE', 'NON_CUMULATIVE', 'RECURRING'],
  RECURRING_DEPOSIT: ['REGULAR', 'FLEXIBLE', 'SENIOR_CITIZEN'],
  NRE_SAVINGS:       ['REGULAR', 'PREMIUM', 'JOINT'],
  NRO_SAVINGS:       ['REGULAR', 'PREMIUM'],
  HOME_LOAN:         ['REGULAR', 'TOP_UP', 'PLOT_PURCHASE', 'UNDER_CONSTRUCTION', 'BALANCE_TRANSFER', 'NRI'],
  PERSONAL_LOAN:     ['REGULAR', 'SALARY', 'PENSIONER', 'GOLD_SECURITY', 'DOCTOR_LOAN', 'CONSUMER_DURABLE'],
  AUTO_LOAN:         ['CAR_NEW', 'CAR_USED', 'TWO_WHEELER', 'COMMERCIAL_VEHICLE', 'ELECTRIC_VEHICLE'],
  GOLD_LOAN:         ['REGULAR', 'OVERDRAFT_AGAINST_GOLD', 'BULLET_REPAYMENT'],
  EDUCATION_LOAN:    ['DOMESTIC', 'ABROAD', 'VOCATIONAL', 'SKILL_DEVELOPMENT'],
  CASH_CREDIT:       ['AGAINST_STOCK', 'AGAINST_PROPERTY', 'AGAINST_RECEIVABLES'],
  OVERDRAFT:         ['AGAINST_FD', 'AGAINST_SALARY', 'AGAINST_PROPERTY', 'AGAINST_SHARES'],
};

const LOAN_TYPES = ['CASH_CREDIT','OVERDRAFT','HOME_LOAN','PERSONAL_LOAN','AUTO_LOAN','GOLD_LOAN','EDUCATION_LOAN'];
const DEPOSIT_WITH_TENURE = ['FIXED_DEPOSIT','RECURRING_DEPOSIT'];

@Component({
  selector: 'app-bank-account-products',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule, RouterLink,
    DialogModule, InputSwitchModule, DecimalPipe, TitleCasePipe,
    HasPermissionDirective, EmptyStateComponent, LoadingSkeletonComponent,
  ],
  providers: [MessageService],
  template: `
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
      <div>
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Account Products</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Define the account types, interest rates and limits your branches offer to customers.
        </p>
      </div>
      <ng-container *appHasPermission="['banks', 'create']">
        <button (click)="openCreateDialog()" class="btn-primary px-4 py-2 text-sm gap-2">
          <i class="pi pi-plus text-xs"></i> New Product
        </button>
      </ng-container>
    </div>

    <app-loading-skeleton *ngIf="loading()" [lines]="5"></app-loading-skeleton>

    <app-empty-state *ngIf="!loading() && products().length === 0"
                     icon="pi-th-large"
                     title="No Account Products"
                     message="Create account products (Savings, FD, Personal Loan…) that your branches can offer to customers.">
    </app-empty-state>

    <!-- Category tabs + table -->
    <div *ngIf="!loading() && products().length > 0">

      <!-- Category filter pills -->
      <div class="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4 w-fit">
        <button *ngFor="let cat of ['ALL','DEPOSIT','LOAN']"
                (click)="activeCategory = cat"
                class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                [class.bg-white]="activeCategory === cat"
                [class.dark:bg-slate-700]="activeCategory === cat"
                [class.shadow-sm]="activeCategory === cat"
                [class.text-slate-900]="activeCategory === cat"
                [class.text-slate-500]="activeCategory !== cat">
          {{ cat === 'ALL' ? 'All Products' : cat === 'DEPOSIT' ? '💰 Deposits' : '🏦 Loans' }}
          <span class="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                [class.bg-primary-100]="activeCategory === cat"
                [class.text-primary-700]="activeCategory === cat"
                [class.bg-slate-200]="activeCategory !== cat"
                [class.text-slate-500]="activeCategory !== cat">
            {{ getCategoryCount(cat) }}
          </span>
        </button>
      </div>

      <div class="card overflow-hidden">
        <table class="w-full data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Code</th>
              <th>Type / Subtype</th>
              <th class="text-right">Interest Rate</th>
              <th class="text-right">Min Balance</th>
              <th class="text-right">Min Opening</th>
              <th>Tenure</th>
              <th>Status</th>
              <th class="text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of filteredProducts()"
                [routerLink]="['/banks', bankId, 'account-products', p.id]"
                class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
              <td>
                <p class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ p.productName }}</p>
                <p *ngIf="p.description" class="text-[11px] text-slate-400 truncate max-w-[180px]">{{ p.description }}</p>
              </td>
              <td>
                <span class="font-mono text-xs font-bold text-primary-600 dark:text-primary-400
                             bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-lg">
                  {{ p.productCode }}
                </span>
              </td>
              <td>
                <span class="badge text-[10px]"
                      [class.badge-blue]="p.productCategory === 'DEPOSIT'"
                      [class.badge-red]="p.productCategory === 'LOAN'">
                  {{ getTypeLabel(p.accountType) }}
                </span>
                <p *ngIf="p.accountSubtype" class="text-[10px] text-slate-400 mt-0.5">
                  {{ p.accountSubtype.replace(/_/g, ' ') | titlecase }}
                </p>
              </td>
              <td class="text-right font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                {{ p.interestRate ? p.interestRate + '% p.a.' : '—' }}
                <span *ngIf="p.seniorCitizenExtraRate" class="text-[10px] text-emerald-600 block">
                  +{{ p.seniorCitizenExtraRate }}% Sr.
                </span>
              </td>
              <td class="text-right text-sm text-slate-500 font-mono">
                {{ p.minimumBalance > 0 ? '₹' + (p.minimumBalance | number:'1.0-0') : '—' }}
              </td>
              <td class="text-right text-sm text-slate-500 font-mono">
                {{ p.minimumOpeningAmount > 0 ? '₹' + (p.minimumOpeningAmount | number:'1.0-0') : '—' }}
              </td>
              <td class="text-sm text-slate-500">
                <span *ngIf="p.defaultTenureMonths">{{ p.defaultTenureMonths }}m</span>
                <span *ngIf="!p.defaultTenureMonths">—</span>
              </td>
              <td (click)="$event.stopPropagation()">
                <div class="flex items-center gap-2.5">
                  <ng-container *appHasPermission="['banks', 'update']">
                    <button type="button" (click)="toggleStatus(p)" [disabled]="p.isUpdatingStatus"
                            class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60"
                            [class.bg-green-500]="p.isActive" [class.dark:bg-green-600]="p.isActive"
                            [class.bg-gray-300]="!p.isActive" [class.dark:bg-gray-700]="!p.isActive">
                      <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200"
                            [class.translate-x-4]="p.isActive" [class.translate-x-0]="!p.isActive">
                        <i *ngIf="p.isUpdatingStatus" class="pi pi-spinner pi-spin text-[8px] text-blue-600"></i>
                      </span>
                    </button>
                  </ng-container>
                  <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                        [class.text-green-600]="p.isActive" [class.dark:text-green-400]="p.isActive"
                        [class.text-gray-500]="!p.isActive">
                    {{ p.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </td>
              <td class="text-right">
                <button class="h-8 w-8 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors focus:outline-none">
                  <i class="pi pi-chevron-right text-xs"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══ 3-STEP WIZARD DIALOG ══════════════════════════════════════════ -->
    <p-dialog [(visible)]="showDialog" [modal]="true" appendTo="body" position="center"
              [style]="{ width: '98vw', maxWidth: '1600px', height: '94vh', maxHeight: '94vh' }"
              [showHeader]="false" contentStyleClass="p-0 bg-transparent h-full">
      <div *ngIf="showDialog" class="flex gap-0 h-full"
           style="border-radius:1rem; overflow:hidden; box-shadow:0 32px 80px -12px rgb(0 0 0 / .35)">

        <!-- ── MAIN WIZARD PANE ── always 520px, never shrinks ─────────── -->
        <div class="bg-white dark:bg-slate-900 flex flex-col border-r border-slate-200 dark:border-slate-700 h-full"
             style="width:520px; min-width:520px; flex-shrink:0;">

        <!-- Dialog Header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <i class="pi pi-th-large text-primary-600 dark:text-primary-400"></i>
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white leading-none">
                {{ editing ? 'Edit Account Product' : 'Create Account Product' }}
              </h3>
              <p class="text-[11px] text-slate-400 mt-0.5">Step {{ currentStep + 1 }} of 3</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Simulate toggle — always visible on Step 2 -->
            <button *ngIf="currentStep === 1"
                    type="button" (click)="toggleSimPanel()"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    [class.bg-violet-600]="showSimPanel"
                    [class.text-white]="showSimPanel"
                    [class.shadow-md]="showSimPanel"
                    [class.bg-violet-50]="!showSimPanel"
                    [class.dark:bg-violet-900\/30]="!showSimPanel"
                    [class.text-violet-700]="!showSimPanel"
                    [class.dark:text-violet-400]="!showSimPanel">
              <i class="pi" [class.pi-calculator]="!showSimPanel" [class.pi-times]="showSimPanel" style="font-size:11px"></i>
              {{ showSimPanel ? 'Hide Simulator' : '▶ Simulate' }}
            </button>
            <button (click)="showDialog = false; showSimPanel = false"
                    class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>
        </div>

        <!-- Step indicator -->
        <div class="px-6 pt-5 pb-1 shrink-0">
          <div class="flex items-center">
            <ng-container *ngFor="let s of steps; let i = index; let last = last">
              <div class="flex flex-col items-center gap-1.5">
                <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300"
                     [class.border-primary-600]="currentStep >= i"
                     [class.bg-primary-600]="currentStep > i"
                     [class.text-white]="currentStep > i"
                     [class.text-primary-600]="currentStep === i"
                     [class.bg-white]="currentStep === i"
                     [class.dark:bg-slate-900]="currentStep === i"
                     [class.border-slate-200]="currentStep < i"
                     [class.dark:border-slate-700]="currentStep < i"
                     [class.text-slate-400]="currentStep < i">
                  <i *ngIf="currentStep > i" class="pi pi-check text-[11px]"></i>
                  <span *ngIf="currentStep <= i">{{ i + 1 }}</span>
                </div>
                <span class="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap"
                      [class.text-primary-600]="currentStep >= i"
                      [class.dark:text-primary-400]="currentStep >= i"
                      [class.text-slate-400]="currentStep < i">
                  {{ s }}
                </span>
              </div>
              <div *ngIf="!last" class="flex-1 h-[2px] mx-2 mb-5 rounded-full transition-all duration-500"
                   [class.bg-primary-500]="currentStep > i"
                   [class.bg-slate-200]="currentStep <= i"
                   [class.dark:bg-slate-700]="currentStep <= i"></div>
            </ng-container>
          </div>
        </div>

        <!-- Form body -->
        <div class="overflow-y-auto flex-1 custom-scrollbar">
          <form [formGroup]="form" class="p-6 space-y-4">

            <!-- ── STEP 1: Product Identity ─────────────────────────────── -->
            <ng-container *ngIf="currentStep === 0">

              <!-- Account Type -->
              <div class="form-group">
                <label>Account Type <span class="text-red-500">*</span></label>
                <div class="grid grid-cols-2 gap-2">
                  <ng-container *ngFor="let grp of typeGroups">
                    <div class="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {{ grp.label }}
                    </div>
                    <button *ngFor="let t of grp.types" type="button"
                            (click)="!editing && selectType(t.value)"
                            class="flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all"
                            [class.border-primary-500]="!customTypeActive && form.get('accountType')?.value === t.value"
                            [class.bg-primary-50]="!customTypeActive && form.get('accountType')?.value === t.value"
                            [class.dark:bg-primary-900\/20]="!customTypeActive && form.get('accountType')?.value === t.value"
                            [class.border-slate-200]="customTypeActive || form.get('accountType')?.value !== t.value"
                            [class.dark:border-slate-700]="customTypeActive || form.get('accountType')?.value !== t.value"
                            [class.hover:border-primary-300]="!editing && (customTypeActive || form.get('accountType')?.value !== t.value)"
                            [class.cursor-not-allowed]="!!editing"
                            [class.opacity-70]="!!editing && form.get('accountType')?.value !== t.value">
                      <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                           [class.bg-primary-100]="!customTypeActive && form.get('accountType')?.value === t.value"
                           [class.bg-slate-100]="customTypeActive || form.get('accountType')?.value !== t.value"
                           [class.dark:bg-slate-800]="customTypeActive || form.get('accountType')?.value !== t.value">
                        <i class="pi text-sm"
                           [class]="getTypeIcon(t.value)"
                           [class.text-primary-600]="!customTypeActive && form.get('accountType')?.value === t.value"
                           [class.text-slate-400]="customTypeActive || form.get('accountType')?.value !== t.value"></i>
                      </div>
                      <span class="text-xs font-semibold"
                            [class.text-primary-700]="!customTypeActive && form.get('accountType')?.value === t.value"
                            [class.text-slate-600]="customTypeActive || form.get('accountType')?.value !== t.value"
                            [class.dark:text-slate-300]="customTypeActive || form.get('accountType')?.value !== t.value">
                        {{ t.label }}
                      </span>
                    </button>

                    <!-- ── + Custom type card for this group ── -->
                    <ng-container *ngIf="!editing">
                      <!-- Selected custom card — only in the matching group -->
                      <div *ngIf="customTypeActive === grp.types[0].category"
                           class="flex items-center gap-2.5 p-3 rounded-xl border-2 border-violet-500 bg-violet-50 dark:bg-violet-900/20 col-span-2">
                        <div class="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                          <i class="pi pi-sparkles text-violet-600 text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-bold text-violet-700 dark:text-violet-300 truncate">
                            {{ customTypeSlug.replace(/_/g, ' ') }}
                          </p>
                          <p class="text-[10px] text-violet-500 mt-0.5">
                            Custom {{ grp.types[0].category === 'LOAN' ? 'Loan' : 'Deposit' }}
                          </p>
                        </div>
                        <button type="button" (click)="clearCustomType()"
                                class="w-5 h-5 rounded-full bg-violet-200 dark:bg-violet-800 flex items-center justify-center text-violet-600 hover:bg-violet-300 transition-colors shrink-0">
                          <i class="pi pi-times text-[8px]"></i>
                        </button>
                      </div>

                      <!-- Input mode — active for this group -->
                      <div *ngIf="showCustomTypeInput[grp.types[0].category]"
                           class="col-span-2 flex items-center gap-2 p-2.5 rounded-xl border-2 border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20">
                        <i class="pi pi-tag text-violet-500 text-sm shrink-0"></i>
                        <input type="text"
                               [(ngModel)]="customTypeInput[grp.types[0].category]"
                               [ngModelOptions]="{ standalone: true }"
                               (keydown.enter)="selectCustomType(grp.types[0].category)"
                               (keydown.escape)="showCustomTypeInput[grp.types[0].category] = false; customTypeInput[grp.types[0].category] = ''"
                               [placeholder]="grp.types[0].category === 'LOAN' ? 'e.g. Microfinance Loan' : 'e.g. Youth Savings'"
                               maxlength="50"
                               autofocus
                               class="flex-1 bg-transparent text-xs font-semibold text-violet-700 dark:text-violet-300
                                      outline-none placeholder:text-violet-300 font-mono" />
                        <button type="button" (click)="selectCustomType(grp.types[0].category)"
                                class="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors shrink-0">✓</button>
                        <button type="button"
                                (click)="showCustomTypeInput[grp.types[0].category] = false; customTypeInput[grp.types[0].category] = ''"
                                class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-300 transition-colors shrink-0">✕</button>
                      </div>

                      <!-- + Custom button — show when no input open AND this group not already selected -->
                      <button *ngIf="!showCustomTypeInput[grp.types[0].category] && customTypeActive !== grp.types[0].category"
                              type="button"
                              (click)="clearCustomType(); showCustomTypeInput[grp.types[0].category] = true"
                              class="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed text-left transition-all
                                     border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20
                                     text-violet-600 dark:text-violet-400">
                        <div class="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                          <i class="pi pi-plus text-violet-500 text-sm"></i>
                        </div>
                        <span class="text-xs font-semibold">Custom {{ grp.types[0].category === 'LOAN' ? 'Loan' : 'Deposit' }}</span>
                      </button>
                    </ng-container>

                  </ng-container>
                </div>
                <p *ngIf="editing" class="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <i class="pi pi-lock text-[9px]"></i> Account type is locked after creation.
                </p>
              </div>

              <!-- Sub-type (dynamic based on type) -->
              <div class="form-group" *ngIf="availableSubtypes.length > 0">
                <label>
                  Sub-type
                  <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional — defines the product variant)</span>
                </label>
                <div class="flex flex-wrap gap-2">
                  <button *ngFor="let sub of availableSubtypes" type="button"
                          (click)="form.get('accountSubtype')?.setValue(form.get('accountSubtype')?.value === sub ? '' : sub)"
                          class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
                          [class.border-primary-500]="form.get('accountSubtype')?.value === sub"
                          [class.bg-primary-50]="form.get('accountSubtype')?.value === sub"
                          [class.text-primary-700]="form.get('accountSubtype')?.value === sub"
                          [class.border-slate-200]="form.get('accountSubtype')?.value !== sub"
                          [class.dark:border-slate-700]="form.get('accountSubtype')?.value !== sub"
                          [class.text-slate-500]="form.get('accountSubtype')?.value !== sub"
                          [class.hover:border-primary-300]="form.get('accountSubtype')?.value !== sub">
                    {{ sub.replace(/_/g, ' ') | titlecase }}
                  </button>

                  <!-- Custom subtype input pill -->
                  <ng-container *ngIf="!showCustomSubtypeInput">
                    <button type="button" (click)="showCustomSubtypeInput = true"
                            class="px-3 py-1.5 rounded-xl border-2 border-dashed text-xs font-semibold transition-all
                                   border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400
                                   hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-1">
                      <i class="pi pi-plus text-[10px]"></i> Custom
                    </button>
                  </ng-container>

                  <!-- Custom subtype text input -->
                  <ng-container *ngIf="showCustomSubtypeInput">
                    <div class="flex items-center gap-1.5">
                      <input type="text" [(ngModel)]="customSubtypeInput"
                             [ngModelOptions]="{ standalone: true }"
                             (keydown.enter)="selectCustomSubtype()"
                             (keydown.escape)="showCustomSubtypeInput = false; customSubtypeInput = ''"
                             placeholder="e.g. WOMENS_SAVINGS"
                             maxlength="50"
                             style="text-transform:uppercase"
                             autofocus
                             class="px-3 py-1.5 rounded-xl border-2 border-violet-400 dark:border-violet-600
                                    bg-violet-50 dark:bg-violet-900/20 text-xs font-semibold text-violet-700 dark:text-violet-300
                                    outline-none w-40 font-mono" />
                      <button type="button" (click)="selectCustomSubtype()"
                              class="px-2.5 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors">
                        ✓
                      </button>
                      <button type="button" (click)="showCustomSubtypeInput = false; customSubtypeInput = ''"
                              class="px-2 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-300 transition-colors">
                        ✕
                      </button>
                    </div>
                  </ng-container>

                  <!-- Show currently selected custom subtype as a purple pill if it's not in the predefined list -->
                  <span *ngIf="form.get('accountSubtype')?.value && !availableSubtypes.includes(form.get('accountSubtype')?.value ?? '')"
                        class="px-3 py-1.5 rounded-xl border-2 border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                    <i class="pi pi-sparkles text-[9px]"></i>
                    {{ (form.get('accountSubtype')?.value ?? '').replace(/_/g, ' ') | titlecase }}
                    <button type="button" (click)="form.get('accountSubtype')?.setValue('')"
                            class="ml-1 text-violet-400 hover:text-violet-700 focus:outline-none">
                      <i class="pi pi-times text-[9px]"></i>
                    </button>
                  </span>

                </div>
              </div>

              <!-- Product Code preview (read-only) -->
              <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <i class="pi pi-tag text-slate-400 shrink-0"></i>
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Product Code (auto-generated)</p>
                  <p class="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm mt-0.5">
                    {{ previewProductCode() }}
                  </p>
                </div>
                <span *ngIf="editing"
                      class="ml-auto font-mono text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg">
                  {{ editing.productCode }}
                </span>
              </div>

              <!-- Product Name + Description -->
              <div class="form-group">
                <label>Product Name <span class="text-red-500">*</span></label>
                <input type="text" formControlName="productName"
                       placeholder="e.g. Prime Savings Account, Home Loan Flexi" maxlength="100"
                       [class.border-red-400]="isInvalid('productName')" />
                <p *ngIf="isInvalid('productName')" class="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <i class="pi pi-exclamation-circle text-[10px]"></i>Required.
                </p>
              </div>

              <div class="form-group">
                <label>Description <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional)</span></label>
                <textarea formControlName="description" rows="2"
                          placeholder="Brief description for branch staff..."
                          class="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700
                                 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100
                                 placeholder:text-slate-400 resize-none outline-none
                                 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"></textarea>
              </div>

              <div class="form-group">
                <label>Currency</label>
                <div class="relative">
                  <input type="text" [(ngModel)]="currencySearch" [ngModelOptions]="{standalone:true}"
                         (focus)="showCurrencyDropdown=true"
                         (blur)="onCurrencyBlur()"
                         [placeholder]="(form.get('currency')?.value || 'INR') + ' — search currencies...'"
                         class="w-full" />
                  <div *ngIf="showCurrencyDropdown && filteredCurrencies().length > 0"
                       class="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    <button *ngFor="let c of filteredCurrencies()" type="button"
                            (mousedown)="selectCurrency(c)"
                            class="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
                            [class.bg-primary-50]="form.get('currency')?.value === c.code"
                            [class.text-primary-700]="form.get('currency')?.value === c.code">
                      <span class="font-bold">{{ c.code }}</span>
                      <span class="text-slate-400 text-xs">{{ c.name }} {{ c.symbol }}</span>
                    </button>
                  </div>
                </div>
              </div>

            </ng-container>

            <!-- ── STEP 2: Financial Configuration ────────────────────── -->
            <ng-container *ngIf="currentStep === 1">

              <!-- Balance Rules -->
              <div class="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/40 space-y-3">
                <p class="text-[11px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  <i class="pi pi-wallet text-[10px]"></i> Balance Rules
                </p>
                <div class="grid grid-cols-3 gap-3">
                  <div class="form-group">
                    <label>Min Opening (₹)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                      <input type="number" formControlName="minimumOpeningAmount" min="0" style="padding-left:1.8rem!important" placeholder="0" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Min Balance / MAB (₹)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                      <input type="number" formControlName="minimumBalance" min="0" style="padding-left:1.8rem!important" placeholder="0" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Max Balance (₹) <span class="text-slate-400 text-[10px] ml-1">(Opt)</span></label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                      <input type="number" formControlName="maximumBalance" min="0" style="padding-left:1.8rem!important" placeholder="No cap" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Interest Configuration -->
              <div class="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/40 space-y-3">
                <p class="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <i class="pi pi-percentage text-[10px]"></i> Interest Configuration
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group">
                    <label>Annual Rate (% p.a.)</label>
                    <input type="number" formControlName="interestRate" min="0" max="100" step="0.0001" placeholder="e.g. 3.5" />
                  </div>
                  <div class="form-group">
                    <label>Rate Type</label>
                    <select formControlName="interestRateType">
                      <option value="FIXED">Fixed Rate</option>
                      <option value="FLOATING">Floating (MCLR-linked)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Payout Frequency</label>
                    <select formControlName="interestPayoutFreq">
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half-Yearly</option>
                      <option value="YEARLY">Yearly</option>
                      <option value="AT_MATURITY">At Maturity</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Compounding Frequency</label>
                    <select formControlName="compoundingFreq">
                      <option value="DAILY">Daily</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half-Yearly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                  <div class="form-group flex items-center gap-3 pt-4">
                    <p-inputSwitch formControlName="autoInterestCredit"></p-inputSwitch>
                    <label class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-0">
                      Auto-Credit Interest
                    </label>
                  </div>
                  <div class="form-group">
                    <label>Credit Day of Month (1–28)</label>
                    <input type="number" formControlName="creditDayOfMonth" min="1" max="28" placeholder="1" />
                  </div>
                  <div class="form-group">
                    <label>Senior Citizen Extra (%)</label>
                    <input type="number" formControlName="seniorCitizenExtraRate" min="0" max="5" step="0.25" placeholder="e.g. 0.5" />
                  </div>
                </div>
              </div>

              <!-- Tenure (FD / Loan) -->
              <div class="grid grid-cols-3 gap-3" *ngIf="isDepositWithTenure || isLoanType">
                <div class="form-group">
                  <label>Min Tenure (months) <span class="text-slate-400 text-[10px] ml-1">(Opt)</span></label>
                  <input type="number" formControlName="minTenureMonths" min="1" placeholder="e.g. 6" />
                </div>
                <div class="form-group">
                  <label>Max Tenure (months) <span class="text-slate-400 text-[10px] ml-1">(Opt)</span></label>
                  <input type="number" formControlName="maxTenureMonths" min="1" placeholder="e.g. 360" />
                </div>
                <div class="form-group">
                  <label>Default Tenure (months)</label>
                  <input type="number" formControlName="defaultTenureMonths" min="1" placeholder="e.g. 24" />
                </div>
              </div>

              <!-- Loan-specific fields -->
              <div *ngIf="isLoanType" class="bg-red-50/50 dark:bg-red-900/10 rounded-2xl p-4 border border-red-100 dark:border-red-900/40 space-y-3">
                <p class="text-[11px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                  <i class="pi pi-credit-card text-[10px]"></i> Loan Parameters
                </p>
                <div class="grid grid-cols-2 gap-3">
                  <div class="form-group">
                    <label>Min Loan Amount (₹)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                      <input type="number" formControlName="minLoanAmount" min="0" style="padding-left:1.8rem!important" placeholder="e.g. 50000" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Max Loan Amount (₹)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                      <input type="number" formControlName="maxLoanAmount" min="0" style="padding-left:1.8rem!important" placeholder="e.g. 5000000" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Processing Fee (%)</label>
                    <input type="number" formControlName="processingFeePercent" min="0" max="10" step="0.01" placeholder="e.g. 0.5" />
                  </div>
                  <div class="form-group">
                    <label>Foreclosure Charge (%)</label>
                    <input type="number" formControlName="foreclosureChargePercent" min="0" max="10" step="0.01" placeholder="e.g. 2.0" />
                  </div>
                  <div class="form-group">
                    <label>Penal Interest Rate (extra %)</label>
                    <input type="number" formControlName="penalInterestRate" min="0" max="30" step="0.01" placeholder="e.g. 2.0" />
                  </div>
                </div>
              </div>

            </ng-container>

            <!-- ── STEP 3: Limits & Eligibility ───────────────────────── -->
            <ng-container *ngIf="currentStep === 2">

              <!-- Transaction Limits -->
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Transaction Limits</p>
                <div class="grid grid-cols-3 gap-3">
                  <div class="form-group">
                    <label>Daily Withdrawal (₹)</label>
                    <input type="number" formControlName="dailyWithdrawalLimit" min="0" />
                  </div>
                  <div class="form-group">
                    <label>ATM Daily Limit (₹)</label>
                    <input type="number" formControlName="atmDailyLimit" min="0" />
                  </div>
                  <div class="form-group">
                    <label>Online Txn Limit (₹)</label>
                    <input type="number" formControlName="onlineTxnDailyLimit" min="0" />
                  </div>
                </div>
                <div class="form-group" *ngIf="isLoanType">
                  <label>Overdraft / Sanction Limit (₹) <span class="text-slate-400 text-[10px] ml-1">(OD/CC)</span></label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                    <input type="number" formControlName="overdraftLimit" min="0" style="padding-left:1.8rem!important" />
                  </div>
                </div>
              </div>

              <!-- Eligibility -->
              <div class="space-y-3">
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Eligibility Restrictions</p>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:border-primary-300 transition-colors">
                    <input type="checkbox" [checked]="form.get('seniorCitizenOnly')?.value"
                           (change)="form.get('seniorCitizenOnly')?.setValue($any($event.target).checked)"
                           class="w-4 h-4 rounded accent-primary-600" />
                    <div>
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">Senior Citizens Only</p>
                      <p class="text-[11px] text-slate-400">Age 60+ accounts only</p>
                    </div>
                  </label>
                  <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:border-primary-300 transition-colors">
                    <input type="checkbox" [checked]="form.get('nriOnly')?.value"
                           (change)="form.get('nriOnly')?.setValue($any($event.target).checked)"
                           class="w-4 h-4 rounded accent-primary-600" />
                    <div>
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">NRI Only</p>
                      <p class="text-[11px] text-slate-400">Non-Resident Indians only</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Features -->
              <div class="space-y-3">
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Product Features</p>
                <div class="grid grid-cols-2 gap-2">
                  <label *ngFor="let feat of featuresList"
                         class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:border-primary-300 transition-colors">
                    <input type="checkbox"
                           [checked]="getFeature(feat.key)"
                           (change)="setFeature(feat.key, $any($event.target).checked)"
                           class="w-3.5 h-3.5 rounded accent-primary-600 shrink-0" />
                    <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ feat.label }}</span>
                  </label>
                </div>
              </div>

            </ng-container>

          </form>
        </div>

        <!-- Dialog Footer -->
        <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
          <button type="button" (click)="prevStep()" [disabled]="currentStep === 0"
                  class="btn-secondary px-4 py-2 text-sm gap-1.5 disabled:opacity-40">
            <i class="pi pi-chevron-left text-xs"></i> Back
          </button>

          <!-- Progress dots -->
          <div class="flex items-center gap-1.5">
            <div *ngFor="let s of steps; let i = index"
                 class="rounded-full h-1.5 transition-all duration-300"
                 [class.w-5]="currentStep === i" [class.w-1.5]="currentStep !== i"
                 [class.bg-primary-600]="currentStep === i"
                 [class.bg-slate-300]="currentStep !== i"
                 [class.dark:bg-slate-600]="currentStep !== i"></div>
          </div>

          <div class="flex items-center gap-2">
            <button *ngIf="currentStep < 2" type="button" (click)="nextStep()"
                    class="btn-primary px-5 py-2 text-sm gap-1.5">
              Next <i class="pi pi-chevron-right text-xs"></i>
            </button>
            <button *ngIf="currentStep === 2" type="button" (click)="save()"
                    [disabled]="saving()" class="btn-primary px-5 py-2 text-sm gap-2">
              <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
              <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
              {{ saving() ? 'Saving...' : (editing ? 'Save Changes' : 'Create Product') }}
            </button>
          </div>
        </div>
        </div><!-- end main wizard pane -->

        <!-- ── SIMULATION PANEL — takes all remaining width ──────────────── -->
        <div class="flex flex-col h-full"
             style="flex:1; min-width:0; background:#f8fafc; border-left:1px solid #e2e8f0;">


          <!-- ── PLACEHOLDER when hidden ── -->
          <ng-container *ngIf="!showSimPanel">
            <div class="flex flex-col items-center justify-center h-full gap-5 text-center px-12">
              <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <i class="pi pi-calculator text-violet-500 text-4xl"></i>
              </div>
              <div>
                <p class="text-xl font-bold text-slate-700 dark:text-slate-300">Financial Simulator</p>
                <p class="text-sm text-slate-400 mt-2">Configure Step 2 values and click<br><strong class="text-violet-600">&#9658; Simulate</strong> to see bank-grade calculations</p>
              </div>
              <div class="w-full max-w-sm space-y-2 text-left mt-2">
                <div *ngIf="!isLoanType" class="space-y-2 text-sm text-slate-500">
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>Maturity: compound vs simple interest comparison</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>Effective Annual Rate — compounding boost</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>Interest payout per period (monthly/quarterly/at maturity)</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-teal-500 shrink-0"></span>Senior citizen extra benefit side-by-side</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>Year-by-year growth bar chart</p>
                </div>
                <div *ngIf="isLoanType" class="space-y-2 text-sm text-slate-500">
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>Monthly EMI by reducing balance method</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>Principal vs interest breakdown with bar chart</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>Processing fee, foreclosure charge totals</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>Year-by-year repayment chart</p>
                  <p class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>Full amortization table with reducing balance note</p>
                </div>
              </div>
            </div>
          </ng-container>

          <!-- ── FULL SIMULATOR when visible ── -->
          <ng-container *ngIf="showSimPanel">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <i class="pi pi-calculator text-violet-600 dark:text-violet-400 text-lg"></i>
                </div>
                <div>
                  <p class="font-bold text-slate-900 dark:text-white text-base">Financial Simulator</p>
                  <p class="text-xs text-slate-400">Updates live as you change values in the form</p>
                </div>
              </div>
              <button type="button" (click)="toggleSimPanel()"
                      class="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600">
                <i class="pi pi-times text-xs"></i> Close
              </button>
            </div>

            <!-- Config badges -->
            <div class="flex flex-wrap gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                <i class="pi pi-percentage text-[10px]"></i>{{ form.get('interestRate')?.value || '0' }}% p.a.
              </span>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    [class.bg-amber-100]="form.get('interestRateType')?.value === 'FLOATING'"
                    [class.text-amber-700]="form.get('interestRateType')?.value === 'FLOATING'"
                    [class.bg-blue-100]="form.get('interestRateType')?.value !== 'FLOATING'"
                    [class.text-blue-700]="form.get('interestRateType')?.value !== 'FLOATING'">
                {{ form.get('interestRateType')?.value === 'FLOATING' ? 'Floating Rate' : 'Fixed Rate' }}
              </span>
              <span *ngIf="!isLoanType" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                Compound: {{ form.get('compoundingFreq')?.value }}
              </span>
              <span *ngIf="!isLoanType" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                Payout: {{ form.get('interestPayoutFreq')?.value }}
              </span>
              <span *ngIf="!isLoanType && form.get('autoInterestCredit')?.value" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                Auto-credit Day {{ form.get('creditDayOfMonth')?.value }}
              </span>
              <span *ngIf="(form.get('seniorCitizenExtraRate')?.value || 0) > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-700">
                +{{ form.get('seniorCitizenExtraRate')?.value }}% Senior
              </span>
              <span *ngIf="isLoanType && (form.get('processingFeePercent')?.value || 0) > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                {{ form.get('processingFeePercent')?.value }}% Processing Fee
              </span>
              <span *ngIf="isLoanType && (form.get('penalInterestRate')?.value || 0) > 0" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                +{{ form.get('penalInterestRate')?.value }}% Penal
              </span>
            </div>

            <!-- Scrollable body -->
            <div class="overflow-y-auto flex-1 custom-scrollbar" style="padding:24px; display:flex; flex-direction:column; gap:20px">

              <!-- Sim inputs -->
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Simulation Inputs</p>
                <div class="grid grid-cols-2 gap-5">
                  <div class="form-group !mb-0">
                    <label>{{ isLoanType ? 'Loan Amount' : 'Principal Amount' }} (&#8377;)</label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none z-10">&#8377;</span>
                      <input type="number" [(ngModel)]="simAmount" (ngModelChange)="computeSimulation()"
                             [ngModelOptions]="{ standalone: true }" style="padding-left:1.8rem!important"
                             [placeholder]="isLoanType ? '500000' : '100000'" min="1" />
                    </div>
                    <p *ngIf="isLoanType && (form.get('minLoanAmount')?.value || form.get('maxLoanAmount')?.value)" class="text-xs text-slate-400 mt-1">
                      Range: &#8377;{{ (form.get('minLoanAmount')?.value || 0) | number:'1.0-0' }} &#8211; &#8377;{{ (form.get('maxLoanAmount')?.value || 0) | number:'1.0-0' }}
                    </p>
                  </div>
                  <div class="form-group !mb-0">
                    <label>Tenure (months)</label>
                    <input type="number" [(ngModel)]="simTenure" (ngModelChange)="computeSimulation()"
                           [ngModelOptions]="{ standalone: true }" placeholder="12" min="1" />
                    <p *ngIf="simResults?.minTenure || simResults?.maxTenure" class="text-xs text-slate-400 mt-1">
                      <ng-container *ngIf="simResults.minTenure">Min: {{ simResults.minTenure }}m</ng-container>
                      <ng-container *ngIf="simResults.minTenure && simResults.maxTenure"> &middot; </ng-container>
                      <ng-container *ngIf="simResults.maxTenure">Max: {{ simResults.maxTenure }}m</ng-container>
                    </p>
                  </div>
                </div>
              </div>

              <!-- No rate prompt -->
              <div *ngIf="!form.get('interestRate')?.value" class="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                <i class="pi pi-percentage text-5xl text-slate-200 block mb-4"></i>
                <p class="text-base font-semibold text-slate-500">Enter Annual Interest Rate in the form</p>
                <p class="text-sm text-slate-400 mt-1">Results appear instantly as you type</p>
              </div>

              <!-- ======================== DEPOSIT ======================== -->
              <ng-container *ngIf="!isLoanType && form.get('interestRate')?.value && simResults">

                <!-- Floating warning -->
                <div *ngIf="simResults.rateType === 'FLOATING'" class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
                  <i class="pi pi-exclamation-triangle text-amber-500 text-lg shrink-0"></i>
                  <span><strong>Floating Rate Product</strong> — figures are indicative. Returns vary with MCLR/Repo changes.</span>
                </div>

                <!-- Hero -->
                <div class="rounded-2xl overflow-hidden shadow-sm">
                  <div class="bg-gradient-to-r from-emerald-600 to-teal-600 p-6">
                    <p class="text-emerald-100 text-xs font-bold uppercase tracking-widest">{{ simResults.payFreq === 'AT_MATURITY' ? 'Cumulative Maturity Amount' : 'Total Amount Received' }}</p>
                    <p class="text-5xl font-black text-white mt-2">&#8377;{{ simResults.maturityAmount | number:'1.0-0' }}</p>
                    <p class="text-emerald-100 mt-2">Principal &#8377;{{ simAmount | number:'1.0-0' }} + Interest &#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</p>
                  </div>
                  <div class="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-2xl">
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compound Interest</p>
                      <p class="text-lg font-black text-emerald-600 mt-1">&#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</p>
                      <p class="text-[10px] text-slate-400 mt-0.5">{{ simResults.compFreq }}</p>
                    </div>
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Simple Interest</p>
                      <p class="text-lg font-black text-blue-600 mt-1">&#8377;{{ simResults.simpleInterest | number:'1.0-0' }}</p>
                      <p class="text-[10px] text-slate-400 mt-0.5">flat {{ form.get('interestRate')?.value }}%</p>
                    </div>
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Eff. Annual Rate</p>
                      <p class="text-lg font-black text-violet-600 mt-1">{{ simResults.effectiveRate | number:'1.3-3' }}%</p>
                      <p class="text-[10px] text-slate-400 mt-0.5">vs {{ form.get('interestRate')?.value }}% nominal</p>
                    </div>
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compounding Bonus</p>
                      <p class="text-lg font-black text-teal-600 mt-1">+&#8377;{{ (simResults.compoundInterest - simResults.simpleInterest) | number:'1.0-0' }}</p>
                      <p class="text-[10px] text-slate-400 mt-0.5">extra earned</p>
                    </div>
                  </div>
                </div>

                <!-- Compound vs Simple bar chart -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                  <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Compounding vs Simple Interest</p>
                  <div class="space-y-4">
                    <div>
                      <div class="flex justify-between text-sm mb-2">
                        <span class="font-semibold text-slate-700 flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>With {{ simResults.compFreq }} Compounding</span>
                        <span class="font-black text-emerald-700">&#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</span>
                      </div>
                      <div class="h-8 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-xl flex items-center justify-end px-3" style="width:100%">
                          <span class="text-xs font-bold text-white">&#8377;{{ simResults.compoundInterest | number:'1.0-0' }}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div class="flex justify-between text-sm mb-2">
                        <span class="font-semibold text-slate-700 flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-400 inline-block"></span>Without Compounding (Flat Rate)</span>
                        <span class="font-black text-blue-700">&#8377;{{ simResults.simpleInterest | number:'1.0-0' }}</span>
                      </div>
                      <div class="h-8 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-blue-300 to-blue-500 rounded-xl flex items-center justify-end px-3 transition-all duration-700"
                             [style.width]="((simResults.simpleInterest / simResults.compoundInterest) * 100) + '%'">
                          <span class="text-xs font-bold text-white">&#8377;{{ simResults.simpleInterest | number:'1.0-0' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="mt-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-4 py-3 text-sm text-emerald-700 text-center">
                    <strong>{{ simResults.compFreq }} compounding</strong> earns <strong>&#8377;{{ (simResults.compoundInterest - simResults.simpleInterest) | number:'1.0-0' }} more</strong> than simple interest over {{ simResults.N }} months
                  </div>
                </div>

                <!-- Payout schedule -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Interest Payout Schedule</p>
                      <p class="text-xs text-slate-400 mt-1">{{ simResults.payFreq === 'AT_MATURITY' ? 'Cumulative — interest compounds internally, paid at maturity' : 'Non-cumulative — bank credits interest to account each period' }}</p>
                    </div>
                    <span class="text-xs font-bold px-3 py-1 rounded-full"
                          [class.bg-emerald-100]="simResults.payFreq === 'AT_MATURITY'"
                          [class.text-emerald-700]="simResults.payFreq === 'AT_MATURITY'"
                          [class.bg-blue-100]="simResults.payFreq !== 'AT_MATURITY'"
                          [class.text-blue-700]="simResults.payFreq !== 'AT_MATURITY'">
                      {{ form.get('interestPayoutFreq')?.value }}
                    </span>
                  </div>
                  <div class="divide-y divide-slate-100 dark:divide-slate-800">
                    <div *ngFor="let row of simResults.payoutSchedule"
                         class="flex items-center justify-between px-5 py-4"
                         [class.bg-emerald-50]="row.highlight"
                         [class.dark:bg-emerald-900\/10]="row.highlight">
                      <span class="text-sm text-slate-600 dark:text-slate-400">{{ row.label }}</span>
                      <span class="text-lg font-black font-mono ml-4"
                            [class.text-emerald-700]="row.highlight"
                            [class.text-slate-700]="!row.highlight">
                        &#8377;{{ row.amount | number:'1.2-2' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Auto-credit -->
                <div class="flex items-center gap-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 rounded-2xl px-5 py-4">
                  <i class="pi pi-calendar text-blue-500 text-xl shrink-0"></i>
                  <div>
                    <p class="font-semibold text-blue-700 dark:text-blue-300">{{ simResults.autoCreditInfo }}</p>
                    <p class="text-xs text-blue-500 mt-0.5">System auto-posts interest credit transaction on this day</p>
                  </div>
                </div>

                <!-- Senior citizen -->
                <div *ngIf="simResults.seniorExtra > 0" class="bg-teal-50 dark:bg-teal-900/20 rounded-2xl border border-teal-200 overflow-hidden">
                  <div class="px-5 py-3 bg-teal-100/60 border-b border-teal-200">
                    <p class="text-xs font-black text-teal-700 uppercase tracking-widest">Senior Citizen Special Rate (+{{ simResults.seniorExtra }}% extra)</p>
                  </div>
                  <div class="grid grid-cols-3 divide-x divide-teal-100">
                    <div class="p-5 text-center">
                      <p class="text-xs text-teal-600 font-semibold mb-1">Regular Rate</p>
                      <p class="text-2xl font-black text-slate-700">{{ form.get('interestRate')?.value }}%</p>
                      <p class="text-sm text-slate-500 mt-1">&#8377;{{ simResults.maturityAmount | number:'1.0-0' }}</p>
                    </div>
                    <div class="p-5 text-center bg-teal-50">
                      <p class="text-xs text-teal-600 font-semibold mb-1">Senior Rate</p>
                      <p class="text-2xl font-black text-teal-700">{{ (+(form.get('interestRate')?.value || 0) + simResults.seniorExtra).toFixed(2) }}%</p>
                      <p class="text-sm font-bold text-teal-600 mt-1">&#8377;{{ simResults.seniorMaturity | number:'1.0-0' }}</p>
                    </div>
                    <div class="p-5 text-center">
                      <p class="text-xs text-teal-600 font-semibold mb-1">Extra Earned</p>
                      <p class="text-2xl font-black text-emerald-600">+&#8377;{{ simResults.seniorExtra2 | number:'1.0-0' }}</p>
                      <p class="text-xs text-slate-500 mt-1">senior benefit</p>
                    </div>
                  </div>
                </div>

                <!-- Year-by-year growth chart -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                  <div class="flex items-center justify-between mb-5">
                    <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Year-by-Year Growth ({{ simResults.compFreq }} Compounding)</p>
                    <span class="text-xs text-slate-400">Max: &#8377;{{ simResults.maturityAmount | number:'1.0-0' }}</span>
                  </div>
                  <div class="space-y-3">
                    <ng-container *ngFor="let row of simResults.yearGrowth">
                      <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-slate-500 w-10 shrink-0 text-right">Yr {{ row.year }}</span>
                        <div class="flex-1 relative h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                          <div class="absolute inset-y-0 left-0 bg-blue-200 rounded-lg" [style.width]="((simAmount / simResults.maturityAmount) * 100) + '%'"></div>
                          <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-emerald-500 rounded-lg transition-all duration-700"
                               [style.width]="((row.amount / simResults.maturityAmount) * 100) + '%'"></div>
                          <div class="absolute inset-0 flex items-center px-3">
                            <span class="text-xs font-bold text-white drop-shadow">&#8377;{{ row.amount | number:'1.0-0' }}</span>
                            <span *ngIf="simResults.seniorExtra > 0 && row.seniorAmount" class="ml-auto text-[11px] font-bold text-teal-100">&#8377;{{ row.seniorAmount | number:'1.0-0' }}</span>
                          </div>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 w-20 shrink-0 text-right">+&#8377;{{ row.interest | number:'1.0-0' }}</span>
                      </div>
                    </ng-container>
                  </div>
                  <div class="flex items-center gap-5 mt-4 text-xs">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-200 inline-block"></span>Principal</span>
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-emerald-400 inline-block"></span>Interest accrued</span>
                    <span *ngIf="simResults.seniorExtra > 0" class="flex items-center gap-2 text-teal-600">Senior value</span>
                  </div>
                </div>

              </ng-container>

              <!-- ======================== LOAN ======================== -->
              <ng-container *ngIf="isLoanType && form.get('interestRate')?.value && simResults">

                <!-- Hero EMI -->
                <div class="rounded-2xl overflow-hidden shadow-sm">
                  <div class="bg-gradient-to-r from-red-600 to-rose-600 p-6">
                    <p class="text-red-100 text-xs font-bold uppercase tracking-widest">Monthly EMI — Reducing Balance Method</p>
                    <p class="text-5xl font-black text-white mt-2">&#8377;{{ simResults.emi | number:'1.2-2' }}</p>
                    <p class="text-red-100 mt-1">{{ simResults.N }} months at {{ form.get('interestRate')?.value }}% p.a.</p>
                  </div>
                  <div class="grid grid-cols-3 divide-x divide-slate-100 bg-white dark:bg-slate-900 border border-t-0 border-slate-200 rounded-b-2xl">
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loan Amount</p>
                      <p class="text-xl font-black text-blue-600 mt-1">&#8377;{{ simAmount | number:'1.0-0' }}</p>
                    </div>
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Interest</p>
                      <p class="text-xl font-black text-red-600 mt-1">&#8377;{{ simResults.totalInterest | number:'1.0-0' }}</p>
                    </div>
                    <div class="p-4 text-center">
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Payable</p>
                      <p class="text-xl font-black text-slate-800 dark:text-white mt-1">&#8377;{{ simResults.totalPayable | number:'1.0-0' }}</p>
                    </div>
                  </div>
                </div>

                <!-- Cost breakdown bars -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                  <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Cost Breakdown — What You Actually Pay</p>
                  <div class="space-y-4">
                    <div>
                      <div class="flex justify-between text-sm mb-2">
                        <span class="font-semibold text-blue-600 flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span>Principal (amount borrowed)</span>
                        <span class="font-black text-blue-700">&#8377;{{ simAmount | number:'1.0-0' }} ({{ (100 - simResults.interestPercent) | number:'1.1-1' }}%)</span>
                      </div>
                      <div class="h-8 bg-slate-100 rounded-xl overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl transition-all duration-700" [style.width]="(100 - simResults.interestPercent) + '%'"></div>
                      </div>
                    </div>
                    <div>
                      <div class="flex justify-between text-sm mb-2">
                        <span class="font-semibold text-red-600 flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>Interest (cost of borrowing)</span>
                        <span class="font-black text-red-700">&#8377;{{ simResults.totalInterest | number:'1.0-0' }} ({{ simResults.interestPercent | number:'1.1-1' }}%)</span>
                      </div>
                      <div class="h-8 bg-slate-100 rounded-xl overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-xl transition-all duration-700" [style.width]="simResults.interestPercent + '%'"></div>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-base font-bold">
                    <span class="text-slate-600">Total outflow over {{ simResults.N }} months</span>
                    <span class="text-slate-900 dark:text-white text-lg">&#8377;{{ simResults.totalPayable | number:'1.0-0' }}</span>
                  </div>
                </div>

                <!-- Charges -->
                <div *ngIf="simResults.processingFee > 0 || simResults.forecloseFee > 0"
                     class="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden">
                  <div class="px-5 py-3 bg-amber-100/60 border-b border-amber-200">
                    <p class="text-xs font-black text-amber-700 uppercase tracking-widest">Charges &amp; Fees</p>
                  </div>
                  <div class="p-5 space-y-4">
                    <div *ngIf="simResults.processingFee > 0" class="flex items-center justify-between">
                      <div>
                        <p class="font-semibold text-amber-800">Processing Fee</p>
                        <p class="text-xs text-amber-600 mt-0.5">{{ simResults.procFeePct }}% of loan — paid upfront</p>
                      </div>
                      <p class="text-lg font-black text-amber-700">&#8377;{{ simResults.processingFee | number:'1.0-0' }}</p>
                    </div>
                    <div *ngIf="simResults.forecloseFee > 0" class="flex items-center justify-between border-t border-amber-200 pt-4">
                      <div>
                        <p class="font-semibold text-amber-800">Foreclosure Charge</p>
                        <p class="text-xs text-amber-600 mt-0.5">{{ simResults.foreclosePct }}% if closed before tenure</p>
                      </div>
                      <p class="text-lg font-black text-amber-700">&#8377;{{ simResults.forecloseFee | number:'1.0-0' }}</p>
                    </div>
                    <div class="flex items-center justify-between border-t border-amber-300 pt-4">
                      <p class="font-bold text-amber-900">Total Cost incl. fees</p>
                      <p class="text-xl font-black text-amber-900">&#8377;{{ (simResults.totalPayable + simResults.processingFee) | number:'1.0-0' }}</p>
                    </div>
                  </div>
                </div>

                <!-- Penal -->
                <div *ngIf="simResults.penalRate > 0" class="flex items-start gap-4 bg-red-50 border border-red-200 rounded-2xl p-5">
                  <i class="pi pi-exclamation-circle text-red-500 text-2xl shrink-0 mt-0.5"></i>
                  <div>
                    <p class="font-bold text-red-700">Penal Interest: +{{ simResults.penalRate }}% on overdue EMIs</p>
                    <p class="text-sm text-red-600 mt-1">If EMI &#8377;{{ simResults.emi | number:'1.0-0' }} overdue 1 month &rarr; extra &#8776; <strong>&#8377;{{ simResults.penalOnEmi | number:'1.2-2' }}</strong></p>
                    <p class="text-xs text-red-500 mt-1">Charged over regular EMI until overdue is cleared.</p>
                  </div>
                </div>

                <!-- Year-by-year repayment chart -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 p-5">
                  <p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Year-by-Year Repayment Chart</p>
                  <div class="space-y-3">
                    <ng-container *ngFor="let row of simResults.yearSummary">
                      <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-slate-500 w-10 shrink-0 text-right">Yr {{ row.year }}</span>
                        <div class="flex-1 h-8 rounded-lg overflow-hidden flex">
                          <div class="bg-blue-400 flex items-center justify-center transition-all duration-500"
                               [style.width]="((row.principal / (row.principal + row.interest)) * 100) + '%'">
                            <span class="text-[10px] font-bold text-white px-1 truncate">P &#8377;{{ row.principal | number:'1.0-0' }}</span>
                          </div>
                          <div class="bg-red-400 flex items-center justify-center transition-all duration-500"
                               [style.width]="((row.interest / (row.principal + row.interest)) * 100) + '%'">
                            <span class="text-[10px] font-bold text-white px-1 truncate">I &#8377;{{ row.interest | number:'1.0-0' }}</span>
                          </div>
                        </div>
                        <span class="text-xs text-slate-400 w-24 shrink-0 text-right">&#8377;{{ row.balance | number:'1.0-0' }}</span>
                      </div>
                    </ng-container>
                  </div>
                  <div class="flex items-center gap-5 mt-4 text-xs">
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-blue-400 inline-block"></span>Principal paid</span>
                    <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-red-400 inline-block"></span>Interest paid</span>
                  </div>
                </div>

                <!-- Amortization table -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 overflow-hidden">
                  <div class="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Monthly Amortization Schedule</p>
                    <span class="text-xs text-slate-400 bg-slate-200 px-3 py-1 rounded-full">{{ simResults.N > 24 ? 'Key months' : 'All ' + simResults.N + ' months' }}</span>
                  </div>
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-slate-100 bg-slate-50/50">
                        <th class="text-left px-5 py-3 text-xs font-bold text-slate-500">Month</th>
                        <th class="text-right px-5 py-3 text-xs font-bold text-blue-500">Principal &#8593;</th>
                        <th class="text-right px-5 py-3 text-xs font-bold text-red-500">Interest &#8595;</th>
                        <th class="text-right px-5 py-3 text-xs font-bold text-slate-400">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ng-container *ngFor="let row of simResults.amortization; let i = index">
                        <tr *ngIf="i > 0 && simResults.amortization[i-1].month + 1 < row.month">
                          <td colspan="4" class="px-5 py-2 text-center text-xs text-slate-300">&bull; &bull; &bull; months skipped &bull; &bull; &bull;</td>
                        </tr>
                        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                            [class.bg-amber-50]="row.isLast" [class.bg-slate-50]="row.isMid">
                          <td class="px-5 py-3 text-sm font-semibold text-slate-700">
                            {{ row.isLast ? 'Month ' + row.month + ' (Final)' : row.isMid ? 'Month ' + row.month + ' (Mid)' : 'Month ' + row.month }}
                          </td>
                          <td class="px-5 py-3 text-right font-mono font-bold text-blue-600">&#8377;{{ row.principal | number:'1.0-0' }}</td>
                          <td class="px-5 py-3 text-right font-mono font-bold text-red-500">&#8377;{{ row.interest | number:'1.0-0' }}</td>
                          <td class="px-5 py-3 text-right font-mono text-slate-600">&#8377;{{ row.balance | number:'1.0-0' }}</td>
                        </tr>
                      </ng-container>
                    </tbody>
                  </table>
                  <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
                    Reducing balance: Principal portion &#8593; increases each month, Interest portion &#8595; decreases — EMI stays constant.
                  </div>
                </div>

              </ng-container>

            </div><!-- end scrollable body -->
          </ng-container><!-- end showSimPanel -->
        </div><!-- end simulation panel -->

      </div><!-- end outer dual-pane wrapper -->
    </p-dialog>
  `,
})
export class BankAccountProductsComponent implements OnInit, OnDestroy, OnChanges {
  @Input() bankId!: string;

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private cdr  = inject(ChangeDetectorRef);
  private msg  = inject(MessageService);  private destroy$ = new Subject<void>();

  loading  = signal(true);
  saving   = signal(false);
  products = signal<any[]>([]);

  showDialog   = false;
  editing: any = null;
  currentStep  = 0;
  activeCategory = 'ALL';

  // ── Simulation panel ───────────────────────────────────────────────────
  showSimPanel   = false;
  simAmount      = 100000;
  simTenure      = 12;
  simResults: any = null;

  // ── Custom subtype ─────────────────────────────────────────────────────
  showCustomSubtypeInput = false;
  customSubtypeInput     = '';

  // ── Custom account type per group ──────────────────────────────────────
  showCustomTypeInput: Record<string, boolean> = { DEPOSIT: false, LOAN: false };
  customTypeInput: Record<string, string>      = { DEPOSIT: '', LOAN: '' };
  // Which category has a custom type active (null = none, 'DEPOSIT' or 'LOAN')
  customTypeActive: string | null = null;
  // The slug entered for the active custom type (used as product code prefix)
  customTypeSlug = '';

  // ── Currencies from API ─────────────────────────────────────────────────
  currencies: any[] = [];
  currencySearch = '';
  showCurrencyDropdown = false;

  readonly steps = ['Product Identity', 'Financial Config', 'Limits & Eligibility'];

  readonly typeGroups = [
    { label: '💰 Deposit Products', types: ACCOUNT_TYPES.filter(t => t.category === 'DEPOSIT') },
    { label: '🏦 Loan Products',    types: ACCOUNT_TYPES.filter(t => t.category === 'LOAN') },
  ];

  readonly featuresList = [
    { key: 'debitCard',        label: 'Debit Card' },
    { key: 'chequebook',       label: 'Cheque Book' },
    { key: 'sweepFacility',    label: 'Sweep Facility' },
    { key: 'autoRenewal',      label: 'Auto Renewal' },
    { key: 'tdsApplicable',    label: 'TDS Applicable' },
    { key: 'form15gAllowed',   label: 'Form 15G/H Allowed' },
    { key: 'netBanking',       label: 'Net Banking' },
    { key: 'upiEnabled',       label: 'UPI Enabled' },
    { key: 'taxBenefit80C',    label: 'Tax Benefit (80C)' },
    { key: 'dematLinked',      label: 'Demat Linked' },
  ];

  form = this.fb.group({
    accountType:    ['SAVINGS', Validators.required],
    accountSubtype: [''],
    productName:    ['', [Validators.required, Validators.maxLength(100)]],
    description:    [''],
    currency:       ['INR'],
    // Balance
    minimumOpeningAmount: [0],
    minimumBalance:       [0],
    maximumBalance:       [null],
    // Interest
    interestRate:         [null],
    interestRateType:     ['FIXED'],
    interestPayoutFreq:   ['QUARTERLY'],
    compoundingFreq:      ['QUARTERLY'],
    autoInterestCredit:   [true],
    creditDayOfMonth:     [1],
    seniorCitizenExtraRate: [null],
    // Tenure
    minTenureMonths:     [null],
    maxTenureMonths:     [null],
    defaultTenureMonths: [null],
    // Loan
    minLoanAmount:           [null],
    maxLoanAmount:           [null],
    processingFeePercent:    [null],
    foreclosureChargePercent:[null],
    penalInterestRate:       [null],
    // Limits
    dailyWithdrawalLimit:  [25000],
    atmDailyLimit:         [10000],
    onlineTxnDailyLimit:   [200000],
    overdraftLimit:        [null],
    // Eligibility
    seniorCitizenOnly: [false],
    nriOnly:           [false],
  });

  // Track features separately (not in FormGroup — stored as JSON)
  features: Record<string, any> = {};

  ngOnInit() {
    this.load();
    this.loadCurrencies();
    // Reactive simulation — recompute when form financial fields change
    this.form.valueChanges.pipe(
      debounceTime(200), takeUntil(this.destroy$)
    ).subscribe(() => { if (this.showSimPanel) this.computeSimulation(); });
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
  ngOnChanges(c: SimpleChanges) { if (c['bankId'] && !c['bankId'].firstChange) this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>(`/banks/${this.bankId}/account-products`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => { this.products.set(r.data ?? r ?? []); this.cdr.detectChanges(); } });
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

  get availableSubtypes(): string[] {
    const type = this.form.get('accountType')?.value;
    return type ? (SUBTYPE_MAP[type] ?? []) : [];
  }

  get dialogStyle() {
    return { width: this.showSimPanel ? '1280px' : '780px', maxWidth: '99vw' };
  }

  get isLoanType(): boolean {
    return LOAN_TYPES.includes(this.form.get('accountType')?.value ?? '');
  }
  get isDepositWithTenure(): boolean {
    return DEPOSIT_WITH_TENURE.includes(this.form.get('accountType')?.value ?? '');
  }

  selectType(value: string) {
    this.customTypeActive = null; this.customTypeSlug = '';
    this.form.patchValue({ accountType: value, accountSubtype: '' });
  }

  previewProductCode(): string {
    if (this.customTypeActive) {
      // Custom type: prefix = slug they typed, suffix = subtype (if selected)
      const prefix = this.customTypeSlug || 'CUSTOM';
      const sub    = this.form.get('accountSubtype')?.value || '';
      return sub ? `${prefix}_${sub.toUpperCase()}` : prefix;
    }
    // Predefined type: prefix = accountType enum, suffix = subtype
    const type = this.form.get('accountType')?.value || '';
    const sub  = this.form.get('accountSubtype')?.value || '';
    return sub ? `${type}_${sub.toUpperCase()}` : type || 'SELECT_TYPE';
  }

  getCategoryCount(cat: string): number {
    if (cat === 'ALL') return this.products().length;
    return this.products().filter((p: any) => p.productCategory === cat).length;
  }

  filteredProducts(): any[] {
    if (this.activeCategory === 'ALL') return this.products();
    return this.products().filter((p: any) => p.productCategory === this.activeCategory);
  }

  getTypeLabel(type: string): string {
    return ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;
  }

  getTypeIcon(type: string): string {
    const m: Record<string, string> = {
      SAVINGS: 'pi-wallet', SAVINGS_BASIC: 'pi-wallet', CURRENT: 'pi-building',
      FIXED_DEPOSIT: 'pi-lock', RECURRING_DEPOSIT: 'pi-calendar',
      NRE_SAVINGS: 'pi-globe', NRO_SAVINGS: 'pi-globe',
      HOME_LOAN: 'pi-home', PERSONAL_LOAN: 'pi-user', AUTO_LOAN: 'pi-car',
      GOLD_LOAN: 'pi-star', EDUCATION_LOAN: 'pi-book',
      CASH_CREDIT: 'pi-credit-card', OVERDRAFT: 'pi-arrows-h',
    };
    return m[type] ?? 'pi-wallet';
  }

  getFeature(key: string): boolean { return !!this.features[key]; }
  setFeature(key: string, val: boolean) { this.features = { ...this.features, [key]: val }; }

  toggleSimPanel() {
    this.showSimPanel = !this.showSimPanel;
    if (this.showSimPanel) {
      this.seedSimInputs();
      this.computeSimulation();
    }
    this.cdr.detectChanges();
  }

  // Wizard
  nextStep() {
    if (this.currentStep === 0) {
      this.form.get('productName')?.markAsTouched();
      if (!this.form.get('accountType')?.value || !this.form.get('productName')?.value) {
        this.cdr.detectChanges(); return;
      }
    }
    if (this.currentStep < 2) {
      this.currentStep++;
      this.cdr.detectChanges();
    }
  }
  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      if (this.currentStep !== 1) this.showSimPanel = false;
      this.cdr.detectChanges();
    }
  }

  openCreateDialog() {
    this.editing    = null;
    this.currentStep = 0;
    this.features   = {};
    this.showSimPanel = false;
    this.simResults   = null;
    this.simAmount    = 100000;
    this.simTenure    = 12;
    this.showCustomSubtypeInput = false;
    this.customSubtypeInput = '';
    this.showCustomTypeInput = { DEPOSIT: false, LOAN: false };
    this.customTypeInput     = { DEPOSIT: '', LOAN: '' };
    this.customTypeActive = null; this.customTypeSlug = '';
    this.form.reset({
      accountType: 'SAVINGS', currency: 'INR', interestRateType: 'FIXED',
      interestPayoutFreq: 'QUARTERLY', compoundingFreq: 'QUARTERLY',
      autoInterestCredit: true, creditDayOfMonth: 1,
      minimumOpeningAmount: 0, minimumBalance: 0,
      dailyWithdrawalLimit: 25000, atmDailyLimit: 10000, onlineTxnDailyLimit: 200000,
      seniorCitizenOnly: false, nriOnly: false,
    });
    this.showDialog = true;
  }

  openEditDialog(p: any) {
    this.editing    = p;
    this.currentStep = 0;
    this.features   = p.features ?? {};
    this.showSimPanel = false;
    this.simResults   = null;
    this.simAmount    = p.minimumOpeningAmount || 100000;
    this.simTenure    = p.defaultTenureMonths || 12;
    this.showCustomSubtypeInput = false;
    this.customSubtypeInput = '';
    this.showCustomTypeInput = { DEPOSIT: false, LOAN: false };
    this.customTypeInput     = { DEPOSIT: '', LOAN: '' };
    this.customTypeActive = null; this.customTypeSlug = '';
    this.form.patchValue({ ...p });
    this.showDialog = true;
  }

  save() {
    if (this.form.get('accountType')?.invalid || this.form.get('productName')?.invalid) {
      this.form.markAllAsTouched(); this.cdr.detectChanges(); return;
    }
    this.saving.set(true);
    const val = { ...this.form.getRawValue(), features: this.features };
    const base = `/banks/${this.bankId}/account-products`;

    const req = this.editing
      ? this.http.patch(`${base}/${this.editing.id}`, val)
      : this.http.post(base, val);

    req.pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (r: any) => {
          const product = r.data ?? r;
          this.msg.add({ severity: 'success', summary: this.editing ? 'Updated' : 'Product Created',
            detail: this.editing
              ? `${product.productName} updated.`
              : `${product.productName} (${product.productCode}) created.` });
          this.showDialog = false;
          this.load();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Failed.' });
        },
      });
  }

  toggleStatus(p: any) {
    p.isUpdatingStatus = true;
    this.cdr.detectChanges();
    this.http.patch(`/banks/${this.bankId}/account-products/${p.id}/status`, { isActive: !p.isActive })
      .pipe(takeUntil(this.destroy$), finalize(() => { p.isUpdatingStatus = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          p.isActive = !p.isActive;
          this.msg.add({ severity: 'success', summary: 'Updated',
            detail: `${p.productName} ${p.isActive ? 'activated' : 'deactivated'}.` });
          this.cdr.detectChanges();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  deleteProduct(p: any) {
    if (!confirm(`Delete "${p.productName}" (${p.productCode})?`)) return;
    this.http.delete(`/banks/${this.bankId}/account-products/${p.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${p.productName} removed.` }); this.load(); },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  // ── Custom subtype ────────────────────────────────────────────────────

  selectCustomSubtype() {
    const val = this.customSubtypeInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (val) {
      this.form.get('accountSubtype')?.setValue(val);
    }
    this.showCustomSubtypeInput = false;
    this.customSubtypeInput = '';
    this.cdr.detectChanges();
  }

  clearCustomType() {
    this.customTypeActive = null; this.customTypeSlug = '';
    this.form.patchValue({ accountSubtype: '' });
    this.cdr.detectChanges();
  }

  /** Select a custom product type label — stored as accountSubtype, no base type card highlighted */
  selectCustomType(category: string) {
    const raw = this.customTypeInput[category]?.trim();
    if (!raw) { this.showCustomTypeInput[category] = false; return; }

    const slug = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Close any other group's custom input
    this.showCustomTypeInput = { DEPOSIT: false, LOAN: false };

    // Mark this category as active, store the slug as the product code prefix
    this.customTypeActive = category;
    this.customTypeSlug   = slug;

    // Set nearest valid base type for API enum + clear subtype ready for new selection
    const defaultBase = category === 'LOAN' ? 'PERSONAL_LOAN' : 'SAVINGS';
    this.form.patchValue({ accountType: defaultBase, accountSubtype: '' });

    this.customTypeInput[category] = '';
    this.cdr.detectChanges();
  }

  // ── Financial Simulation ──────────────────────────────────────────────

  /** Seed simulation inputs from the form's current financial values */
  seedSimInputs() {
    const isLoan = this.isLoanType;
    if (isLoan) {
      const minL = parseFloat(String(this.form.get('minLoanAmount')?.value ?? '')) || 0;
      const maxL = parseFloat(String(this.form.get('maxLoanAmount')?.value ?? '')) || 0;
      // Use midpoint of min/max range, fallback to 500000
      this.simAmount = minL && maxL ? Math.round((minL + maxL) / 2) : (minL || maxL || 500000);
    } else {
      const minOp = parseFloat(String(this.form.get('minimumOpeningAmount')?.value ?? '')) || 0;
      this.simAmount = minOp >= 1000 ? minOp : 100000;
    }
    const defTenure = parseInt(String(this.form.get('defaultTenureMonths')?.value ?? '')) || 0;
    const minTenure = parseInt(String(this.form.get('minTenureMonths')?.value ?? '')) || 0;
    const maxTenure = parseInt(String(this.form.get('maxTenureMonths')?.value ?? '')) || 0;
    if (defTenure > 0) {
      this.simTenure = defTenure;
    } else if (minTenure > 0 && maxTenure > 0) {
      this.simTenure = Math.round((minTenure + maxTenure) / 2);
    } else if (maxTenure > 0) {
      this.simTenure = maxTenure;
    } else if (minTenure > 0) {
      this.simTenure = minTenure;
    } else {
      this.simTenure = 12;
    }
  }

  computeSimulation() {
    const r         = parseFloat(String(this.form.get('interestRate')?.value ?? '')) || 0;
    const rateType  = this.form.get('interestRateType')?.value || 'FIXED';
    const compFreq  = this.form.get('compoundingFreq')?.value  || 'QUARTERLY';
    const payFreq   = this.form.get('interestPayoutFreq')?.value || 'AT_MATURITY';
    const autoCredit = !!this.form.get('autoInterestCredit')?.value;
    const creditDay  = parseInt(String(this.form.get('creditDayOfMonth')?.value ?? '')) || 1;
    const seniorExtra = parseFloat(String(this.form.get('seniorCitizenExtraRate')?.value ?? '')) || 0;
    const procFeePct  = parseFloat(String(this.form.get('processingFeePercent')?.value ?? '')) || 0;
    const foreclosePct = parseFloat(String(this.form.get('foreclosureChargePercent')?.value ?? '')) || 0;
    const penalRate   = parseFloat(String(this.form.get('penalInterestRate')?.value ?? '')) || 0;
    const minTenure   = parseInt(String(this.form.get('minTenureMonths')?.value ?? '')) || 0;
    const maxTenure   = parseInt(String(this.form.get('maxTenureMonths')?.value ?? '')) || 0;

    const P = this.simAmount || 0;
    let   N = this.simTenure || 12;

    // Clamp tenure to product's min/max
    if (minTenure > 0 && N < minTenure) N = minTenure;
    if (maxTenure > 0 && N > maxTenure) N = maxTenure;

    if (!r || !P) { this.simResults = null; this.cdr.detectChanges(); return; }

    const compPerYear: Record<string, number> = {
      DAILY: 365, MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1
    };
    const payPerYear: Record<string, number> = {
      MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, YEARLY: 1, AT_MATURITY: 0
    };

    const n = compPerYear[compFreq] ?? 4;
    const t = N / 12;
    const pp = payPerYear[payFreq] ?? 0;

    // ── LOAN products ────────────────────────────────────────────────────
    if (this.isLoanType) {
      const monthlyRate = r / 100 / 12;
      let emi = 0;
      if (monthlyRate > 0) {
        const pow = Math.pow(1 + monthlyRate, N);
        emi = P * monthlyRate * pow / (pow - 1);
      } else {
        emi = P / N;
      }
      const totalPayable   = emi * N;
      const totalInterest  = totalPayable - P;
      const interestPercent = Math.round((totalInterest / totalPayable) * 100 * 10) / 10;
      const processingFee  = procFeePct > 0 ? (P * procFeePct / 100) : 0;
      const forecloseFee   = foreclosePct > 0 ? (P * foreclosePct / 100) : 0;

      // Full amortization table (all months, up to 360)
      const amortization: any[] = [];
      let balance = P;
      const displayMonths = N <= 24
        ? Array.from({ length: N }, (_, i) => i + 1)
        : [...Array.from({ length: 6 }, (_, i) => i + 1),
           ...(N > 12 ? [Math.ceil(N / 2)] : []),
           N - 1, N];
      const displaySet = new Set(displayMonths);

      for (let m = 1; m <= N; m++) {
        const interestPart  = balance * monthlyRate;
        const principalPart = Math.min(emi - interestPart, balance);
        balance -= principalPart;
        if (displaySet.has(m)) {
          amortization.push({
            month: m, principal: Math.round(principalPart),
            interest: Math.round(interestPart),
            balance: Math.max(0, Math.round(balance)),
            isLast: m === N,
            isMid: m === Math.ceil(N / 2) && N > 12,
          });
        }
      }

      // Penal interest example (1 month overdue)
      const penalOnEmi = penalRate > 0 ? (emi * penalRate / 100 / 12) : 0;

      // Year-by-year summary
      const yearSummary: any[] = [];
      let bal2 = P;
      for (let y = 1; y <= Math.ceil(N / 12); y++) {
        let yInt = 0, yPrin = 0;
        const months = Math.min(12, N - (y - 1) * 12);
        for (let m = 0; m < months; m++) {
          const ip = bal2 * monthlyRate;
          const pp2 = Math.min(emi - ip, bal2);
          yInt += ip; yPrin += pp2; bal2 -= pp2;
        }
        yearSummary.push({ year: y, interest: Math.round(yInt), principal: Math.round(yPrin), balance: Math.max(0, Math.round(bal2)) });
      }

      this.simResults = {
        // core
        emi, totalPayable, totalInterest, interestPercent, processingFee, forecloseFee,
        // penal
        penalRate, penalOnEmi,
        // amortization
        amortization, yearSummary,
        // meta
        rateType, procFeePct, foreclosePct, N, minTenure, maxTenure,
      };

    // ── DEPOSIT products ─────────────────────────────────────────────────
    } else {
      // Compound maturity
      const maturityAmount  = P * Math.pow(1 + (r / 100) / n, n * t);
      const compoundInterest = maturityAmount - P;
      const simpleInterest   = P * r / 100 * t;
      const effectiveRate    = (Math.pow(1 + (r / 100) / n, n) - 1) * 100;
      const growthPercent    = Math.round((compoundInterest / P) * 100 * 10) / 10;

      // Payout schedule based on interestPayoutFreq
      // For non-cumulative (payout ≠ AT_MATURITY): simple interest per period
      const payoutSchedule: any[] = [];
      if (pp > 0) {
        // Non-cumulative: bank pays out simple interest every period
        const periodsInTenure = t * pp;
        const perPeriod = P * (r / 100) / pp;
        const totalPaidOut = perPeriod * periodsInTenure;
        const periodLabel: Record<string, string> = {
          MONTHLY: 'Per Month', QUARTERLY: 'Per Quarter',
          HALF_YEARLY: 'Per 6 Months', YEARLY: 'Per Year'
        };
        payoutSchedule.push({ label: periodLabel[payFreq] || 'Per Period', amount: perPeriod, highlight: true });
        payoutSchedule.push({ label: `Total over ${N} months (${periodsInTenure.toFixed(0)} payouts)`, amount: totalPaidOut, highlight: false });
        payoutSchedule.push({ label: 'Principal returned at maturity', amount: P, highlight: false });
        payoutSchedule.push({ label: 'Net total received', amount: P + totalPaidOut, highlight: true });
      } else {
        // Cumulative / AT_MATURITY — compound growth
        payoutSchedule.push({ label: 'Interest accrued at maturity', amount: compoundInterest, highlight: false });
        payoutSchedule.push({ label: 'Maturity amount (Principal + Interest)', amount: maturityAmount, highlight: true });
      }

      // Senior citizen scenario
      let seniorMaturity = 0, seniorInterest = 0, seniorExtra2 = 0;
      if (seniorExtra > 0) {
        const sRate = r + seniorExtra;
        seniorMaturity  = P * Math.pow(1 + (sRate / 100) / n, n * t);
        seniorInterest  = seniorMaturity - P;
        seniorExtra2    = seniorInterest - compoundInterest;
      }

      // Year-by-year growth table
      const yearGrowth: any[] = [];
      for (let y = 1; y <= Math.ceil(t); y++) {
        const yt = Math.min(y, t);
        const amt = P * Math.pow(1 + (r / 100) / n, n * yt);
        const sAmt = seniorExtra > 0 ? P * Math.pow(1 + ((r + seniorExtra) / 100) / n, n * yt) : null;
        yearGrowth.push({ year: y, amount: Math.round(amt), interest: Math.round(amt - P), seniorAmount: sAmt ? Math.round(sAmt) : null });
      }

      // Auto-credit info: which day of month will interest be credited
      const autoCreditInfo = autoCredit
        ? `Interest credited on day ${creditDay} of every ${
            payFreq === 'MONTHLY' ? 'month' :
            payFreq === 'QUARTERLY' ? '3rd month' :
            payFreq === 'HALF_YEARLY' ? '6th month' :
            payFreq === 'YEARLY' ? 'year' : 'period'}`
        : 'Manual credit (auto-credit off)';

      this.simResults = {
        // core
        maturityAmount, compoundInterest, simpleInterest, effectiveRate, growthPercent,
        // payout
        payFreq, payoutSchedule,
        // senior
        seniorExtra, seniorMaturity, seniorInterest, seniorExtra2,
        // year growth
        yearGrowth,
        // meta
        compFreq, n, rateType, autoCredit, autoCreditInfo, creditDay,
        N, minTenure, maxTenure,
      };
    }

    this.cdr.detectChanges();
  }

  isInvalid(f: string) { const c = this.form.get(f); return !!(c?.invalid && (c.dirty || c.touched)); }
}