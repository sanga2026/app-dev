import { Component, Input, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { MessageService } from 'primeng/api';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { StatusBadgeComponent }   from '../../../../../shared/components/ui/status-badge/status-badge.component';
import { EmptyStateComponent }    from '../../../../../shared/components/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { ConfirmModalComponent }  from '../../../../../shared/components/modals/confirm-modal/confirm-modal.component';

// ─── Types ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: 'SAVINGS',           label: 'Savings Account'         },
  { value: 'SAVINGS_BASIC',     label: 'Basic Savings (PMJDY)'   },
  { value: 'CURRENT',           label: 'Current Account'         },
  { value: 'FIXED_DEPOSIT',     label: 'Fixed Deposit'           },
  { value: 'RECURRING_DEPOSIT', label: 'Recurring Deposit'       },
  { value: 'NRE_SAVINGS',       label: 'NRE Savings'             },
  { value: 'NRO_SAVINGS',       label: 'NRO Savings'             },
  { value: 'CASH_CREDIT',       label: 'Cash Credit'             },
  { value: 'OVERDRAFT',         label: 'Overdraft'               },
  { value: 'HOME_LOAN',         label: 'Home Loan'               },
  { value: 'PERSONAL_LOAN',     label: 'Personal Loan'           },
  { value: 'AUTO_LOAN',         label: 'Auto / Vehicle Loan'     },
  { value: 'GOLD_LOAN',         label: 'Gold Loan'               },
  { value: 'EDUCATION_LOAN',    label: 'Education Loan'          },
];

const ACCOUNT_STATUSES = [
  { value: 'ACTIVE',          label: 'Active'            },
  { value: 'DORMANT',         label: 'Dormant'           },
  { value: 'INOPERATIVE',     label: 'Inoperative'       },
  { value: 'FROZEN',          label: 'Frozen'            },
  { value: 'BLOCKED',         label: 'Blocked'           },
  { value: 'CLOSED',          label: 'Closed'            },
  { value: 'NPA',             label: 'NPA'               },
  { value: 'UNDER_LITIGATION','label': 'Under Litigation' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'active', DORMANT: 'pending', INOPERATIVE: 'pending',
  FROZEN: 'rejected', BLOCKED: 'rejected', CLOSED: 'inactive',
  NPA: 'rejected', UNDER_LITIGATION: 'rejected',
};

@Component({
  selector: 'app-customer-accounts',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    DialogModule, InputSwitchModule, DecimalPipe,
    HasPermissionDirective, StatusBadgeComponent, EmptyStateComponent, LoadingSkeletonComponent,
    ConfirmModalComponent,
  ],
  providers: [MessageService],
  template: `
    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
      <div>
        <h3 class="text-base font-bold text-slate-900 dark:text-white">
          {{ filterCategory === 'LOAN' ? 'Loan Facilities' : 'Bank Accounts' }}
        </h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {{ filterCategory === 'LOAN' ? 'All loan accounts and credit facilities for this customer.' : 'All accounts linked to this customer across account types.' }}
        </p>
      </div>
      <ng-container *appHasPermission="['accounting', 'create']">
        <button *ngIf="!filterCategory" (click)="openCreateDialog()" class="btn-primary px-4 py-2 text-sm gap-2">
          <i class="pi pi-plus text-xs"></i> Open Account
        </button>
      </ng-container>
    </div>

    <app-loading-skeleton *ngIf="loading()" [lines]="4"></app-loading-skeleton>

    <app-empty-state *ngIf="!loading() && displayAccounts.length === 0"
                     icon="pi-wallet"
                     title="No Accounts"
                     message="This customer has no bank accounts. Open one using the button above.">
    </app-empty-state>

    <!-- Account cards grid -->
    <div *ngIf="!loading() && displayAccounts.length > 0"
         class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      <div *ngFor="let acc of displayAccounts"
           class="card p-5 flex flex-col gap-3 cursor-pointer hover:shadow-card-md transition-all duration-200"
           (click)="openDetail(acc)">

        <!-- Card header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                 [class]="getTypeIconBg(acc.accountType)">
              <i class="pi text-base" [class]="getTypeIcon(acc.accountType)"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white leading-none">
                {{ getTypeLabel(acc.accountType) }}
              </p>
              <p class="text-[11px] font-mono text-slate-400 mt-0.5">{{ acc.accountNumber }}</p>
            </div>
          </div>
          <app-status-badge [status]="STATUS_BADGE[acc.status] || 'custom'"
                            [label]="acc.status"></app-status-badge>
        </div>

        <!-- Balance -->
        <div class="bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-3">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Available Balance</p>
          <p class="text-2xl font-black text-slate-900 dark:text-white">
            <span class="text-base font-semibold mr-1">{{ acc.currency || 'INR' }}</span>
            {{ acc.availableBalance | number:'1.2-2' }}
          </p>
          <p *ngIf="acc.lienAmount > 0" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <i class="pi pi-lock text-[9px]"></i> Lien: {{ acc.currency }} {{ acc.lienAmount | number:'1.2-2' }}
          </p>
        </div>

        <!-- Key details -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div *ngIf="acc.interestRate">
            <p class="text-slate-400 font-medium">Interest Rate</p>
            <p class="font-bold text-slate-800 dark:text-slate-200">{{ acc.interestRate }}% p.a.</p>
          </div>
          <div *ngIf="acc.minimumBalance > 0">
            <p class="text-slate-400 font-medium">Min Balance</p>
            <p class="font-bold text-slate-800 dark:text-slate-200">₹ {{ acc.minimumBalance | number:'1.0-0' }}</p>
          </div>
          <div *ngIf="acc.maturityDate">
            <p class="text-slate-400 font-medium">Maturity</p>
            <p class="font-bold text-slate-800 dark:text-slate-200">{{ acc.maturityDate | date:'mediumDate' }}</p>
          </div>
          <div *ngIf="acc.ifscCode">
            <p class="text-slate-400 font-medium">IFSC</p>
            <p class="font-bold font-mono text-slate-800 dark:text-slate-200">{{ acc.ifscCode }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
          <ng-container *appHasPermission="['accounting', 'update']">
            <button type="button" (click)="openEditDialog(acc); $event.stopPropagation()"
                    class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400
                           hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
              <i class="pi pi-pencil text-sm"></i>
            </button>
            <button type="button" (click)="openStatusDialog(acc); $event.stopPropagation()"
                    class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400
                           hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    title="Change Status">
              <i class="pi pi-sliders-h text-sm"></i>
            </button>
          </ng-container>
          <ng-container *appHasPermission="['accounting', 'delete']">
            <button *ngIf="acc.status === 'CLOSED' && acc.currentBalance === 0"
                    type="button" (click)="deleteAccount(acc); $event.stopPropagation()"
                    class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400
                           hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete (closed zero-balance only)">
              <i class="pi pi-trash text-sm"></i>
            </button>
          </ng-container>
        </div>
      </div>
    </div>

    <!-- ── CREATE / EDIT DIALOG ──────────────────────────────────────── -->
    <p-dialog [(visible)]="showFormDialog" [modal]="true" appendTo="body" position="center"
              [style]="{ width: '600px', maxWidth: '98vw', maxHeight: '92vh' }"
              [showHeader]="false" contentStyleClass="p-0 bg-transparent">
      <div *ngIf="showFormDialog"
           class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-scale-in flex flex-col"
           style="max-height:90vh">

        <!-- Fixed header -->
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0 rounded-t-2xl">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <i class="pi pi-wallet text-primary-600 dark:text-primary-400"></i>
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              {{ editing ? 'Edit Account' : 'Open New Account' }}
            </h3>
          </div>
          <button (click)="showFormDialog = false"
                  class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>

        <!-- Scrollable form body -->
        <form [formGroup]="form" (ngSubmit)="saveAccount()"
              class="overflow-y-auto flex-1 custom-scrollbar p-6 space-y-4">

          <!-- ── CREATE: Product selector (REQUIRED) ─── -->
          <ng-container *ngIf="!editing">

            <div class="form-group">
              <label class="flex items-center gap-1.5 mb-2">
                <i class="pi pi-th-large text-primary-500 text-xs"></i>
                Account Product <span class="text-red-500">*</span>
              </label>

              <!-- Product cards grid -->
              <div *ngIf="products().length === 0"
                   class="text-center py-6 text-slate-400 text-sm">
                <i class="pi pi-th-large text-2xl mb-2 block"></i>
                No active products defined for this bank. Ask the Bank Admin to create products first.
              </div>

              <div *ngIf="products().length > 0" class="space-y-2">
                <!-- Category filter mini-tabs -->
                <div class="flex gap-1 mb-3">
                  <button *ngFor="let cat of ['ALL','DEPOSIT','LOAN']" type="button"
                          (click)="filterCat = cat"
                          class="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                          [class.bg-primary-600]="filterCat === cat"
                          [class.text-white]="filterCat === cat"
                          [class.bg-slate-100]="filterCat !== cat"
                          [class.dark:bg-slate-800]="filterCat !== cat"
                          [class.text-slate-500]="filterCat !== cat">
                    {{ cat === 'ALL' ? 'All' : cat === 'DEPOSIT' ? '💰 Deposits' : '🏦 Loans' }}
                  </button>
                </div>

                <div class="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  <button *ngFor="let p of getFilteredProducts()" type="button"
                          (click)="onProductSelect(p.id)"
                          class="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all"
                          [class.border-primary-500]="form.get('productId')?.value === p.id"
                          [class.bg-primary-50]="form.get('productId')?.value === p.id"
                          [class.dark:bg-primary-900\/20]="form.get('productId')?.value === p.id"
                          [class.border-slate-200]="form.get('productId')?.value !== p.id"
                          [class.dark:border-slate-700]="form.get('productId')?.value !== p.id"
                          [class.hover:border-primary-300]="form.get('productId')?.value !== p.id">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                         [class]="getTypeIconBg(p.accountType)">
                      <i class="pi text-sm" [class]="getTypeIcon(p.accountType)"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{{ p.productName }}</p>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class="font-mono text-[10px] text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">{{ p.productCode }}</span>
                        <span *ngIf="p.interestRate" class="text-[10px] text-slate-400">{{ p.interestRate }}% p.a.</span>
                        <span *ngIf="p.minimumBalance > 0" class="text-[10px] text-slate-400">MAB ₹{{ p.minimumBalance | number:'1.0-0' }}</span>
                      </div>
                    </div>
                    <i *ngIf="form.get('productId')?.value === p.id"
                       class="pi pi-check-circle text-primary-500 text-lg shrink-0"></i>
                  </button>
                </div>
              </div>

              <p *ngIf="!form.get('productId')?.value && form.get('productId')?.touched"
                 class="text-xs text-red-500 mt-1 flex items-center gap-1">
                <i class="pi pi-exclamation-circle text-[10px]"></i>Please select a product.
              </p>
            </div>

            <!-- Selected product summary card -->
            <div *ngIf="selectedProduct"
                 class="rounded-2xl border border-primary-200 dark:border-primary-800/50
                        bg-primary-50/60 dark:bg-primary-900/10 p-4 animate-fade-in-up">
              <p class="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <i class="pi pi-info-circle text-[10px]"></i> Product Configuration (from {{ selectedProduct.productCode }})
              </p>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div *ngIf="selectedProduct.interestRate">
                  <p class="text-slate-400 font-medium">Interest Rate</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">{{ selectedProduct.interestRate }}% p.a.</p>
                </div>
                <div *ngIf="selectedProduct.interestPayoutFreq">
                  <p class="text-slate-400 font-medium">Payout</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">{{ selectedProduct.interestPayoutFreq }}</p>
                </div>
                <div *ngIf="selectedProduct.minimumBalance > 0">
                  <p class="text-slate-400 font-medium">Min Balance</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">₹{{ selectedProduct.minimumBalance | number:'1.0-0' }}</p>
                </div>
                <div *ngIf="selectedProduct.minimumOpeningAmount > 0">
                  <p class="text-slate-400 font-medium">Min Opening</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">₹{{ selectedProduct.minimumOpeningAmount | number:'1.0-0' }}</p>
                </div>
                <div *ngIf="selectedProduct.dailyWithdrawalLimit">
                  <p class="text-slate-400 font-medium">Daily Withdrawal</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">₹{{ selectedProduct.dailyWithdrawalLimit | number:'1.0-0' }}</p>
                </div>
                <div *ngIf="selectedProduct.defaultTenureMonths">
                  <p class="text-slate-400 font-medium">Default Tenure</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">{{ selectedProduct.defaultTenureMonths }} months</p>
                </div>
                <div *ngIf="selectedProduct.maxLoanAmount">
                  <p class="text-slate-400 font-medium">Max Loan</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">₹{{ selectedProduct.maxLoanAmount | number:'1.0-0' }}</p>
                </div>
                <div *ngIf="selectedProduct.currency !== 'INR'">
                  <p class="text-slate-400 font-medium">Currency</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">{{ selectedProduct.currency }}</p>
                </div>
              </div>
              <p class="text-[11px] text-primary-600 dark:text-primary-400 mt-3 flex items-center gap-1">
                <i class="pi pi-check-circle text-[10px]"></i>
                These values will be applied to the account. You can override maturity date and risk below.
              </p>
            </div>

            <!-- Account-specific overrides (only shown after product is selected) -->
            <ng-container *ngIf="selectedProduct">

              <!-- Opening Date + Maturity Date (for FD/Loans) -->
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                  <label>Account Opening Date</label>
                  <input type="date" formControlName="openedAt" />
                </div>
                <div class="form-group">
                  <label>
                    Maturity Date
                    <span *ngIf="selectedProduct.defaultTenureMonths" class="text-slate-400 font-normal text-[10px] ml-1">
                      (default {{ selectedProduct.defaultTenureMonths }}m from today)
                    </span>
                    <span *ngIf="!selectedProduct.defaultTenureMonths" class="text-slate-400 font-normal text-[10px] ml-1">(FD/Loan)</span>
                  </label>
                  <input type="date" formControlName="maturityDate" />
                </div>
              </div>

              <!-- Risk Category + PEP -->
              <div class="grid grid-cols-2 gap-3">
                <div class="form-group">
                  <label>Risk Category</label>
                  <select formControlName="riskCategory">
                    <option value="">— Not Set —</option>
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>
                <div class="form-group flex items-center gap-3 pt-6">
                  <p-inputSwitch formControlName="pepFlag"></p-inputSwitch>
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-0">
                    PEP Flag <span class="text-[10px] text-slate-400">(Politically Exposed)</span>
                  </label>
                </div>
              </div>

            </ng-container>
          </ng-container>

          <!-- ── EDIT: only override-able fields ─── -->
          <ng-container *ngIf="editing">

            <!-- Product info (read-only reminder) -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <i class="pi pi-th-large text-slate-400 shrink-0"></i>
              <div>
                <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Account</p>
                <p class="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">{{ editing.accountNumber }}</p>
              </div>
              <span class="ml-auto badge badge-blue">{{ getTypeLabel(editing.accountType) }}</span>
            </div>

            <!-- Editable fields -->
            <div class="grid grid-cols-2 gap-3">
              <div class="form-group">
                <label>Maturity Date <span class="text-slate-400 font-normal text-[10px] ml-1">(FD/Loan)</span></label>
                <input type="date" formControlName="maturityDate" />
              </div>
              <div class="form-group">
                <label>Risk Category</label>
                <select formControlName="riskCategory">
                  <option value="">— Not Set —</option>
                  <option value="LOW">Low Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="HIGH">High Risk</option>
                </select>
              </div>
              <div class="form-group">
                <label>Overdraft Limit (₹) <span class="text-slate-400 font-normal text-[10px] ml-1">(OD/CC)</span></label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold z-10 pointer-events-none">₹</span>
                  <input type="number" formControlName="overdraftLimit" min="0" style="padding-left:1.8rem!important" />
                </div>
              </div>
              <div class="form-group flex items-center gap-3 pt-6">
                <p-inputSwitch formControlName="pepFlag"></p-inputSwitch>
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-0">PEP Flag</label>
              </div>
            </div>

          </ng-container>

          <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 -mx-6 px-6 pb-1 mt-2">
            <button type="button" (click)="showFormDialog = false" class="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" [disabled]="saving() || (!editing && !form.get('productId')?.value)"
                    class="btn-primary px-5 py-2 text-sm gap-2">
              <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
              <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
              {{ saving() ? 'Saving...' : (editing ? 'Save Changes' : 'Open Account') }}
            </button>
          </div>
        </form>
      </div>
    </p-dialog>

    <!-- ── STATUS DIALOG ──────────────────────────────────────────────── -->
    <p-dialog [(visible)]="showStatusDialog" [modal]="true" appendTo="body" position="center"
              [style]="{ width: '420px' }" [showHeader]="false" contentStyleClass="p-0 bg-transparent">
      <div *ngIf="showStatusDialog"
           class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in p-6 space-y-4">
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Update Account Status</h3>
        <p class="text-sm text-slate-500">
          Account: <span class="font-mono font-bold">{{ selectedAccount?.accountNumber }}</span>
        </p>

        <div class="form-group">
          <label>New Status <span class="text-red-500">*</span></label>
          <select [(ngModel)]="newStatus">
            <option *ngFor="let s of accountStatuses" [value]="s.value">{{ s.label }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Reason Code <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional)</span></label>
          <input type="text" [(ngModel)]="statusReason" placeholder="COURT_ORDER, AML_FLAG, CUSTOMER_REQUEST..." maxlength="30" />
        </div>

        <div *ngIf="newStatus === 'FROZEN' || newStatus === 'BLOCKED'" class="form-group">
          <label>Authority / Reference <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional)</span></label>
          <input type="text" [(ngModel)]="freezeRef" placeholder="Court order no. or authority name" maxlength="100" />
        </div>

        <div class="flex gap-3 pt-2">
          <button type="button" (click)="showStatusDialog = false" class="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button type="button" (click)="updateStatus()" [disabled]="saving()"
                  class="btn-primary flex-1 py-2.5 text-sm gap-2">
            <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
            Update Status
          </button>
        </div>
      </div>
    </p-dialog>

    <!-- ── ACCOUNT DETAIL DIALOG ─────────────────────────────────────── -->
    <p-dialog [(visible)]="showDetailDialog" [modal]="true" appendTo="body" position="center"
              [style]="{ width: '500px' }" [showHeader]="false" contentStyleClass="p-0 bg-transparent">
      <div *ngIf="selectedAccount"
           class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Account Details</h3>
          <button (click)="showDetailDialog = false"
                  class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <ng-container *ngFor="let row of getDetailRows(selectedAccount)">
              <div *ngIf="row.value">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{{ row.label }}</p>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-200"
                   [class.font-mono]="row.mono">{{ row.value }}</p>
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    </p-dialog>

    <!-- ── DELETE CONFIRM MODAL ── matches admin-general / account-product-detail pattern ── -->
    <app-confirm-modal
      [(visible)]="showDeleteDialog"
      [isProcessing]="isDeleting"
      title="Delete Account?"
      confirmText="Delete"
      processingText="Deleting..."
      (confirm)="executeDeleteAccount()">
      Are you sure you want to permanently delete account
      <span class="font-bold text-slate-900 dark:text-white">{{ deletingAccount?.accountNumber }}</span>?
      This action cannot be undone.
    </app-confirm-modal>
  `,
})
export class CustomerAccountsComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() branchId!: string;
  @Input() customerId!: string;
  /** When set, pre-filters the account list and hides the category tabs (e.g. 'LOAN' for Loan Facilities tab) */
  @Input() filterCategory: string | null = null;

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private cdr  = inject(ChangeDetectorRef);
  private msg  = inject(MessageService);
  private destroy$ = new Subject<void>();

  loading  = signal(true);
  saving   = signal(false);
  accounts = signal<any[]>([]);
  products = signal<any[]>([]);

  showFormDialog   = false;
  showStatusDialog = false;
  showDetailDialog = false;
  showDeleteDialog = false;
  deletingAccount: any = null;
  isDeleting = false;
  editing: any     = null;
  selectedAccount: any = null;
  selectedProduct: any = null;   // currently chosen product in create form
  filterCat = 'ALL';             // category filter in product selector

  newStatus   = 'ACTIVE';
  statusReason = '';
  freezeRef    = '';

  readonly accountTypes   = ACCOUNT_TYPES;
  readonly accountStatuses = ACCOUNT_STATUSES;
  readonly STATUS_BADGE   = STATUS_BADGE;

  form = this.fb.group({
    productId:           [''],    // selected product (auto-fills below fields)
    accountType:         ['SAVINGS', Validators.required],
    accountSubtype:      [''],
    currency:            ['INR'],
    interestRate:        [null],
    interestRateType:    ['FIXED'],
    interestPayoutFreq:  ['QUARTERLY'],
    maturityDate:        [''],
    minimumBalance:      [0],
    dailyWithdrawalLimit:  [25000],
    atmDailyLimit:         [10000],
    onlineTxnDailyLimit:   [200000],
    overdraftLimit:        [null],
    riskCategory:          [''],
    pepFlag:               [false],
    openedAt:              [''],
  });

  ngOnInit() {
    if (this.filterCategory) this.filterCat = this.filterCategory;
    this.loadAccounts();
    this.loadProducts();
  }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadAccounts() {
    this.loading.set(true);
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/accounts`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => { this.accounts.set(r.data ?? r ?? []); this.cdr.detectChanges(); } });
  }

  /** Returns accounts filtered by filterCategory (if set as Input) */
  get displayAccounts(): any[] {
    const all = this.accounts();
    if (!this.filterCategory) return all;
    const cat = this.filterCategory.toUpperCase();
    const loanTypes = ['HOME_LOAN','PERSONAL_LOAN','AUTO_LOAN','GOLD_LOAN','EDUCATION_LOAN','CASH_CREDIT','OVERDRAFT'];
    if (cat === 'LOAN') return all.filter((a: any) => loanTypes.includes(a.accountType));
    if (cat === 'DEPOSIT') return all.filter((a: any) => !loanTypes.includes(a.accountType));
    return all;
  }

  loadProducts() {
    this.http.get<any>(`/banks/${this.bankId}/account-products?activeOnly=true`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => { this.products.set(r.data ?? r ?? []); this.cdr.detectChanges(); } });
  }

  /** Product selected — auto-fill ALL account fields from the product config */
  onProductSelect(productId: string) {
    const product = this.products().find((p: any) => p.id === productId);
    this.selectedProduct = product ?? null;
    if (!product) return;

    // Auto-fill form with product values
    this.form.patchValue({
      productId:            productId,
      accountType:          product.accountType,
      accountSubtype:       product.accountSubtype ?? '',
      currency:             product.currency       ?? 'INR',
      interestRate:         product.interestRate,
      interestRateType:     product.interestRateType    ?? 'FIXED',
      interestPayoutFreq:   product.interestPayoutFreq  ?? 'QUARTERLY',
      minimumBalance:       product.minimumBalance      ?? 0,
      dailyWithdrawalLimit: product.dailyWithdrawalLimit ?? 25000,
      atmDailyLimit:        product.atmDailyLimit        ?? 10000,
      onlineTxnDailyLimit:  product.onlineTxnDailyLimit  ?? 200000,
      overdraftLimit:       product.overdraftLimit       ?? null,
    });

    // Auto-set maturity date if default tenure is configured
    if (product.defaultTenureMonths) {
      const maturity = new Date();
      maturity.setMonth(maturity.getMonth() + product.defaultTenureMonths);
      this.form.patchValue({ maturityDate: maturity.toISOString().split('T')[0] });
    }

    this.cdr.detectChanges();
  }

  getFilteredProducts(): any[] {
    if (this.filterCat === 'ALL') return this.products();
    return this.products().filter((p: any) => p.productCategory === this.filterCat);
  }

  openCreateDialog() {
    this.editing        = null;
    this.selectedProduct = null;
    this.filterCat      = 'ALL';
    this.form.reset({ pepFlag: false, riskCategory: '' });
    this.form.get('accountType')?.enable();
    this.showFormDialog = true;
  }

  openEditDialog(acc: any) {
    this.editing         = acc;
    this.selectedProduct = null;
    this.form.patchValue({ ...acc });
    this.form.get('accountType')?.disable();
    this.showFormDialog = true;
  }

  openStatusDialog(acc: any) {
    this.selectedAccount = acc;
    this.newStatus    = acc.status;
    this.statusReason = acc.statusReasonCode ?? '';
    this.freezeRef    = acc.freezeReference  ?? '';
    this.showStatusDialog = true;
  }

  openDetail(acc: any) {
    this.selectedAccount = acc;
    this.showDetailDialog = true;
  }

  saveAccount() {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.saving.set(true);
    const { productId, ...val } = this.form.getRawValue();  // strip productId from payload
    const base = `/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/accounts`;

    const req = this.editing
      ? this.http.patch(`${base}/${this.editing.id}`, val)
      : this.http.post(base, val);

    req.pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (r: any) => {
          this.msg.add({ severity: 'success', summary: this.editing ? 'Updated' : 'Account Opened',
            detail: this.editing ? 'Account updated.' : `Account ${(r.data ?? r).accountNumber} opened.` });
          this.showFormDialog = false;
          this.loadAccounts();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Operation failed.' });
        },
      });
  }

  updateStatus() {
    if (!this.selectedAccount) return;
    this.saving.set(true);
    const payload = { status: this.newStatus, statusReasonCode: this.statusReason || null, freezeReference: this.freezeRef || null };
    this.http.patch(
      `/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/accounts/${this.selectedAccount.id}/status`,
      payload
    ).pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Status Updated', detail: `Account is now ${this.newStatus}.` });
          this.showStatusDialog = false;
          this.loadAccounts();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  deleteAccount(acc: any) {
    this.deletingAccount = acc;
    this.showDeleteDialog = true;
    this.cdr.detectChanges();
  }

  executeDeleteAccount() {
    if (!this.deletingAccount) return;
    this.isDeleting = true;
    const acc = this.deletingAccount;
    this.http.delete(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/accounts/${acc.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `Account ${acc.accountNumber} deleted.` });
          this.showDeleteDialog = false;
          this.deletingAccount = null;
          this.loadAccounts();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  isInvalid(f: string) { const c = this.form.get(f); return !!(c?.invalid && (c.dirty || c.touched)); }

  getTypeLabel(type: string)  { return ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type; }

  getTypeIcon(type: string): string {
    const map: Record<string, string> = {
      SAVINGS: 'pi-wallet', SAVINGS_BASIC: 'pi-wallet', CURRENT: 'pi-building',
      FIXED_DEPOSIT: 'pi-lock', RECURRING_DEPOSIT: 'pi-calendar',
      NRE_SAVINGS: 'pi-globe', NRO_SAVINGS: 'pi-globe',
      CASH_CREDIT: 'pi-credit-card', OVERDRAFT: 'pi-arrows-h',
      HOME_LOAN: 'pi-home', PERSONAL_LOAN: 'pi-user', AUTO_LOAN: 'pi-car',
      GOLD_LOAN: 'pi-star', EDUCATION_LOAN: 'pi-book',
    };
    return map[type] ?? 'pi-wallet';
  }

  getTypeIconBg(type: string): string {
    const isLoan = ['HOME_LOAN','PERSONAL_LOAN','AUTO_LOAN','GOLD_LOAN','EDUCATION_LOAN','CASH_CREDIT','OVERDRAFT'].includes(type);
    const isDeposit = ['FIXED_DEPOSIT','RECURRING_DEPOSIT'].includes(type);
    const isNri  = ['NRE_SAVINGS','NRO_SAVINGS'].includes(type);
    if (isLoan)    return 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    if (isDeposit) return 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
    if (isNri)     return 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
    return 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';
  }

  getDetailRows(acc: any): { label: string; value: string; mono?: boolean }[] {
    return [
      { label: 'Account Number',    value: acc.accountNumber,  mono: true  },
      { label: 'Account Type',      value: this.getTypeLabel(acc.accountType) },
      { label: 'Currency',          value: acc.currency || 'INR' },
      { label: 'Status',            value: acc.status },
      { label: 'Current Balance',   value: `${acc.currency || 'INR'} ${Number(acc.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, mono: true },
      { label: 'Available Balance', value: `${acc.currency || 'INR'} ${Number(acc.availableBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, mono: true },
      { label: 'Lien Amount',       value: acc.lienAmount > 0 ? `${acc.currency || 'INR'} ${Number(acc.lienAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '', mono: true },
      { label: 'Minimum Balance',   value: acc.minimumBalance > 0 ? `₹ ${Number(acc.minimumBalance).toLocaleString('en-IN')}` : '' },
      { label: 'Interest Rate',     value: acc.interestRate ? `${acc.interestRate}% p.a.` : '' },
      { label: 'Payout Frequency',  value: acc.interestPayoutFreq ?? '' },
      { label: 'Maturity Date',     value: acc.maturityDate ? new Date(acc.maturityDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '' },
      { label: 'IFSC Code',         value: acc.ifscCode ?? '', mono: true },
      { label: 'Daily Withdrawal',  value: acc.dailyWithdrawalLimit > 0 ? `₹ ${Number(acc.dailyWithdrawalLimit).toLocaleString('en-IN')}` : '' },
      { label: 'ATM Daily Limit',   value: acc.atmDailyLimit > 0 ? `₹ ${Number(acc.atmDailyLimit).toLocaleString('en-IN')}` : '' },
      { label: 'Risk Category',     value: acc.riskCategory ?? '' },
      { label: 'Opened On',         value: acc.openedAt ? new Date(acc.openedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '' },
      { label: 'PEP Flag',          value: acc.pepFlag ? 'Yes — Politically Exposed Person' : '' },
      { label: 'Status Reason',     value: acc.statusReasonCode ?? '' },
      { label: 'Freeze Reference',  value: acc.freezeReference  ?? '' },
    ].filter(r => !!r.value);
  }
}
