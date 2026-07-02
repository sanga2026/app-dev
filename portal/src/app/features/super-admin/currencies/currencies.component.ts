import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { ConfirmModalComponent } from '../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { CurrenciesService } from '../../../shared/services/currencies.service';

@Component({
  selector: 'app-currencies',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    DialogModule, InputSwitchModule,
    HasPermissionDirective, LoadingSkeletonComponent, ConfirmModalComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Currencies</h1>
      <p class="text-sm text-slate-400 mt-0.5">Manage ISO 4217 currencies supported across the platform</p>
    </div>
    <ng-container *appHasPermission="['currencies', 'create']">
      <button type="button" (click)="openDialog()"
              class="btn-primary px-4 py-2 text-sm gap-2 shrink-0">
        <i class="pi pi-plus text-xs"></i> Add Currency
      </button>
    </ng-container>
  </div>

  <!-- Search + status filter -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3 items-center">
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
             placeholder="Search by code, name or symbol..."
             style="padding-left:2.5rem!important"
             class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
    <div class="flex gap-1 shrink-0">
      <button *ngFor="let f of statusFilters" type="button"
              (click)="activeStatus = f.value; applyFilter()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeStatus === f.value" [class.text-white]="activeStatus === f.value"
              [class.bg-slate-100]="activeStatus !== f.value" [class.dark:bg-slate-800]="activeStatus !== f.value"
              [class.text-slate-500]="activeStatus !== f.value">
        {{ f.label }}
      </button>
    </div>
  </div>

  <!-- Loading -->
  <app-loading-skeleton *ngIf="loading()" [lines]="6"></app-loading-skeleton>

  <!-- Table -->
  <div *ngIf="!loading()" class="card overflow-hidden">
    <table class="w-full data-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Symbol</th>
          <th>Decimals</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngIf="filtered().length === 0">
          <td colspan="6" class="py-16 text-center">
            <i class="pi pi-dollar text-3xl text-slate-300 block mb-3"></i>
            <p class="font-bold text-slate-500">No currencies found</p>
          </td>
        </tr>
        <tr *ngFor="let c of filtered()"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">

          <td><span class="font-mono font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-lg text-sm">{{ c.code }}</span></td>
          <td class="font-semibold text-slate-900 dark:text-white">{{ c.name }}</td>
          <td class="text-2xl font-bold text-slate-700 dark:text-slate-300">{{ c.symbol }}</td>
          <td class="text-slate-500 text-sm font-mono">{{ c.decimalPlaces }}</td>

          <!-- Status toggle -->
          <td (click)="$event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <ng-container *appHasPermission="['currencies', 'update']">
                <button type="button" (click)="toggleStatus(c)" [disabled]="c.isUpdating"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60"
                        [class.bg-green-500]="c.isActive" [class.dark:bg-green-600]="c.isActive"
                        [class.bg-slate-300]="!c.isActive" [class.dark:bg-slate-700]="!c.isActive">
                  <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200"
                        [class.translate-x-4]="c.isActive" [class.translate-x-0]="!c.isActive">
                    <i *ngIf="c.isUpdating" class="pi pi-spin pi-spinner text-[8px] text-primary-600"></i>
                  </span>
                </button>
              </ng-container>
              <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                    [class.text-green-600]="c.isActive" [class.dark:text-green-400]="c.isActive"
                    [class.text-slate-400]="!c.isActive">
                {{ c.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </td>

          <!-- Actions -->
          <td class="text-right" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ng-container *appHasPermission="['currencies', 'update']">
                <button type="button" (click)="openDialog(c)"
                        class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  <i class="pi pi-pencil text-sm"></i>
                </button>
              </ng-container>
              <ng-container *appHasPermission="['currencies', 'delete']">
                <button type="button" (click)="confirmDelete(c)"
                        class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <i class="pi pi-trash text-sm"></i>
                </button>
              </ng-container>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<!-- Create / Edit Modal -->
<p-dialog [(visible)]="showDialog" [modal]="true" appendTo="body" position="center"
          [style]="{ width: '520px', maxWidth: '98vw' }"
          [showHeader]="false" contentStyleClass="p-0 bg-transparent">
  <div *ngIf="showDialog"
       class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">

    <!-- Modal header -->
    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-dollar text-primary-600 dark:text-primary-400"></i>
        </div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ editing ? 'Edit Currency' : 'Add Currency' }}</h3>
          <p class="text-xs text-slate-400">{{ editing ? editing.code + ' · ' + editing.name : 'ISO 4217 currency' }}</p>
        </div>
      </div>
      <button (click)="showDialog = false"
              class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
        <i class="pi pi-times text-sm"></i>
      </button>
    </div>

    <!-- Form -->
    <form [formGroup]="form" (ngSubmit)="save()" class="p-6 space-y-4">

      <div class="grid grid-cols-3 gap-4">
        <div class="form-group !mb-0">
          <label>Code <span class="text-red-500">*</span> <span class="text-[10px] text-slate-400 font-normal ml-1">ISO 3-letter</span></label>
          <input type="text" formControlName="code" placeholder="INR" maxlength="3"
                 style="text-transform:uppercase"
                 [class.!opacity-50]="!!editing" [attr.readonly]="!!editing ? true : null"
                 [class.border-red-400]="isInvalid('code')" />
        </div>
        <div class="form-group !mb-0">
          <label>Symbol <span class="text-red-500">*</span></label>
          <input type="text" formControlName="symbol" placeholder="₹" maxlength="10"
                 [class.border-red-400]="isInvalid('symbol')" />
        </div>
        <div class="form-group !mb-0">
          <label>Decimals</label>
          <input type="number" formControlName="decimalPlaces" min="0" max="6" placeholder="2" />
        </div>
      </div>

      <div class="form-group !mb-0">
        <label>Name <span class="text-red-500">*</span></label>
        <input type="text" formControlName="name" placeholder="Indian Rupee"
               [class.border-red-400]="isInvalid('name')" />
        <p *ngIf="isInvalid('name')" class="text-xs text-red-500 mt-1">Required</p>
      </div>

      <div *ngIf="editing" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
        <p-inputSwitch formControlName="isActive"></p-inputSwitch>
        <div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Active</p>
          <p class="text-[11px] text-slate-400">Inactive currencies are hidden from dropdowns</p>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button type="button" (click)="showDialog = false" class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="submit" [disabled]="saving() || form.invalid" class="btn-primary px-5 py-2 text-sm gap-2">
          <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
          <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
          {{ saving() ? 'Saving...' : 'Save Currency' }}
        </button>
      </div>
    </form>
  </div>
</p-dialog>

<!-- Delete Confirmation -->
<app-confirm-modal
  [(visible)]="showDeleteModal"
  [isProcessing]="deleting()"
  title="Delete Currency?"
  confirmText="Delete"
  processingText="Deleting..."
  (confirm)="executeDelete()">
  Are you sure you want to delete currency
  <strong>{{ deletingItem?.code }}</strong> ({{ deletingItem?.name }})?
  This action cannot be undone.
</app-confirm-modal>
  `,
})
export class CurrenciesComponent implements OnInit, OnDestroy {
  private http         = inject(HttpClient);
  private currService  = inject(CurrenciesService);
  private fb           = inject(FormBuilder);
  private msg          = inject(MessageService);
  readonly cdr         = inject(ChangeDetectorRef);
  private destroy$     = new Subject<void>();

  all      = signal<any[]>([]);
  filtered = signal<any[]>([]);
  loading  = signal(true);
  saving   = signal(false);
  deleting = signal(false);

  showDialog     = false;
  showDeleteModal = false;
  editing: any   = null;
  deletingItem: any = null;

  searchQuery  = '';
  activeStatus = 'ALL';

  readonly statusFilters = [
    { label: 'All',      value: 'ALL'    },
    { label: 'Active',   value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  form = this.fb.group({
    code:          ['', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    name:          ['', Validators.required],
    symbol:        ['', Validators.required],
    decimalPlaces: [2, [Validators.min(0), Validators.max(6)]],
    isActive:      [true],
  });

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  load() {
    this.loading.set(true);
    this.currService.getAll(false).subscribe({
      next: (data) => { this.all.set(data); this.applyFilter(); this.loading.set(false); this.cdr.detectChanges(); },
      error: () => { this.loading.set(false); this.cdr.detectChanges(); },
    });
  }

  applyFilter() {
    let list = this.all();
    if (this.activeStatus === 'active')   list = list.filter(c => c.isActive);
    if (this.activeStatus === 'inactive') list = list.filter(c => !c.isActive);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(c =>
        c.code?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.symbol?.toLowerCase().includes(q)
      );
    }
    this.filtered.set(list);
    this.cdr.detectChanges();
  }

  openDialog(c?: any) {
    this.editing = c ?? null;
    this.form.reset({ decimalPlaces: 2, isActive: true });
    if (c) this.form.patchValue(c);
    this.showDialog = true;
    this.cdr.detectChanges();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const val = this.form.getRawValue();
    const obs = this.editing
      ? this.http.patch(`/currencies/${this.editing.code}`, val)
      : this.http.post('/currencies', { ...val, code: (val.code || '').toUpperCase() });

    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Currency saved successfully.' });
          this.showDialog = false;
          this.currService.clearCache();
          this.load();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Failed to save.' });
        },
      });
  }

  toggleStatus(c: any) {
    c.isUpdating = true;
    this.cdr.detectChanges();
    this.http.patch(`/currencies/${c.code}/status`, {})
      .pipe(takeUntil(this.destroy$), finalize(() => { c.isUpdating = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          c.isActive = !c.isActive;
          this.msg.add({ severity: 'success', summary: 'Updated', detail: `${c.code} ${c.isActive ? 'activated' : 'deactivated'}.` });
          this.applyFilter();
          this.currService.clearCache();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message }),
      });
  }

  confirmDelete(c: any) {
    this.deletingItem = c;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.deletingItem) return;
    this.deleting.set(true);
    this.http.delete(`/currencies/${this.deletingItem.code}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.deleting.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${this.deletingItem.code} deleted.` });
          this.showDeleteModal = false;
          this.deletingItem = null;
          this.currService.clearCache();
          this.load();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message }),
      });
  }

  isInvalid(f: string) { const c = this.form.get(f); return !!(c?.invalid && (c.dirty || c.touched)); }
}
