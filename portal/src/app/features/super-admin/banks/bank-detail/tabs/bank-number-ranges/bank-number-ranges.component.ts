import { Component, Input, OnInit, OnDestroy, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';

import { StatusBadgeComponent } from '../../../../../../shared/components/ui/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../../../../../shared/components/ui/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';

const SEQUENCE_TYPES = [
  { value: 'CUSTOMER',    label: 'Customer Number'     },
  { value: 'LOAN',        label: 'Loan Application'    },
  { value: 'SAVINGS',     label: 'Savings Account'     },
  { value: 'TRANSACTION', label: 'Transaction Reference'},
  { value: 'INVOICE',     label: 'Invoice Number'      },
  { value: 'BRANCH',      label: 'Branch Code'         },
];

@Component({
  selector: 'app-bank-number-ranges',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
    ToastModule, DialogModule,
    StatusBadgeComponent, EmptyStateComponent, LoadingSkeletonComponent, HasPermissionDirective,
  ],
  template: `
    <p-toast></p-toast>

    <!-- Header -->
    <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
      <div>
        <h3 class="text-base font-bold text-slate-900 dark:text-white">Number Range Sequences</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Configure ID generation sequences for this bank's branches and operations.
        </p>
      </div>
      <button *appHasPermission="['master-data', 'create']"
              (click)="openDialog()" class="btn-primary px-4 py-2 text-sm gap-2">
        <i class="pi pi-plus text-xs"></i> Add Sequence
      </button>
    </div>

    <app-loading-skeleton *ngIf="loading()" [lines]="5"></app-loading-skeleton>

    <app-empty-state *ngIf="!loading() && ranges().length === 0"
                     icon="pi-hashtag"
                     title="No Sequences Configured"
                     message="Set up number ranges so this bank's branches can generate formatted IDs for customers, loans, and accounts.">
    </app-empty-state>

    <!-- Sequence cards grid -->
    <div *ngIf="!loading() && ranges().length > 0"
         class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

      <div *ngFor="let r of ranges()"
           class="card p-5 flex flex-col gap-4 hover:shadow-card-md transition-shadow">

        <!-- Card header -->
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <i class="pi pi-hashtag text-primary-600 dark:text-primary-400"></i>
            </div>
            <div>
              <p class="text-sm font-bold text-slate-900 dark:text-white">{{ getTypeLabel(r.type) }}</p>
              <p class="text-[11px] font-mono text-slate-400 dark:text-slate-500">{{ r.type }}</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <app-status-badge *ngIf="r.isExhausted"
                              status="rejected" label="Exhausted"></app-status-badge>
            <app-status-badge *ngIf="!r.isExhausted"
                              [status]="r.isActive ? 'active' : 'inactive'"
                              [label]="r.isActive ? 'COMMON.ACTIVE' : 'COMMON.INACTIVE'">
            </app-status-badge>
          </div>
        </div>

        <!-- Progress bar -->
        <div>
          <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Progress</span>
            <span class="font-mono">{{ r.currentNumber }} / {{ r.endNumber }}</span>
          </div>
          <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500"
                 [style.width]="getProgress(r) + '%'"
                 [class.bg-emerald-500]="getProgress(r) < 70"
                 [class.bg-amber-500]="getProgress(r) >= 70 && getProgress(r) < 90"
                 [class.bg-red-500]="getProgress(r) >= 90">
            </div>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {{ getProgress(r) }}% used · {{ r.endNumber - r.currentNumber }} remaining
          </p>
        </div>

        <!-- Format preview -->
        <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span class="text-[11px] text-slate-500 dark:text-slate-400">Sample Output</span>
          <span class="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
            {{ getSampleOutput(r) }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <button *appHasPermission="['master-data', 'update']"
                  (click)="openDialog(r)"
                  class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
            <i class="pi pi-pencil text-sm"></i>
          </button>
          <button *appHasPermission="['master-data', 'update']"
                  (click)="toggleStatus(r)"
                  [title]="r.isActive ? 'Suspend sequence' : 'Activate sequence'"
                  class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400"
                  [class.hover:text-red-500]="r.isActive"
                  [class.hover:text-emerald-500]="!r.isActive">
            <i class="pi text-sm" [class.pi-pause-circle]="r.isActive" [class.pi-play-circle]="!r.isActive"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Create / Edit Dialog -->
    <p-dialog [(visible)]="showDialog" [modal]="true" appendTo="body" position="center"
              [style]="{ width: '520px' }" [showHeader]="false" contentStyleClass="p-0 bg-transparent">
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">

        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <i class="pi pi-hashtag text-primary-600 dark:text-primary-400"></i>
            </div>
            <h3 class="font-bold text-slate-900 dark:text-white text-base">
              {{ editing ? 'Edit Sequence' : 'New Number Sequence' }}
            </h3>
          </div>
          <button (click)="showDialog = false"
                  class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
            <i class="pi pi-times text-sm"></i>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()" class="p-6 space-y-4">

          <!-- Type -->
          <div class="form-group">
            <label>Sequence Type <span class="text-red-500">*</span></label>
            <select formControlName="type" [class.border-red-400]="isInvalid('type')"
                    [attr.disabled]="editing ? true : null">
              <option value="">Select type...</option>
              <option *ngFor="let t of sequenceTypes" [value]="t.value">{{ t.label }}</option>
            </select>
            <p *ngIf="isInvalid('type')" class="text-xs text-red-500 mt-1 flex items-center gap-1">
              <i class="pi pi-exclamation-circle text-[10px]"></i>Required
            </p>
            <p *ngIf="editing" class="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <i class="pi pi-info-circle text-[10px]"></i>Type cannot be changed after creation.
            </p>
          </div>

          <!-- Prefix + Separator -->
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label>Prefix <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional)</span></label>
              <input type="text" formControlName="prefix" placeholder="CUS, LOAN, ACC..."
                     style="text-transform:uppercase" maxlength="10" />
              <p class="text-[11px] text-slate-400 mt-1">Prepended to every generated ID.</p>
            </div>
            <div class="form-group">
              <label>Separator <span class="text-slate-400 font-normal text-[10px] ml-1">(Optional)</span></label>
              <input type="text" formControlName="separator" placeholder="-" maxlength="5" />
              <p class="text-[11px] text-slate-400 mt-1">Between prefix and number (e.g. -)</p>
            </div>
          </div>

          <!-- Start + End + Padding -->
          <div class="grid grid-cols-3 gap-3">
            <div class="form-group">
              <label>Start Number <span class="text-red-500">*</span></label>
              <input type="number" formControlName="startNumber" min="1"
                     [class.border-red-400]="isInvalid('startNumber')" />
            </div>
            <div class="form-group">
              <label>End Number <span class="text-red-500">*</span></label>
              <input type="number" formControlName="endNumber" min="1"
                     [class.border-red-400]="isInvalid('endNumber')" />
            </div>
            <div class="form-group">
              <label>Zero Padding</label>
              <input type="number" formControlName="padding" min="1" max="12" />
              <p class="text-[11px] text-slate-400 mt-1">e.g. 6 → 000001</p>
            </div>
          </div>

          <!-- Live preview -->
          <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-center justify-between">
            <span class="text-xs text-slate-500 dark:text-slate-400">Preview</span>
            <span class="font-mono text-base font-bold text-primary-600 dark:text-primary-400">
              {{ previewOutput() }}
            </span>
          </div>

          <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" (click)="showDialog = false" class="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" [disabled]="saving()" class="btn-primary px-5 py-2 text-sm gap-2">
              <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
              <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
              {{ saving() ? 'Saving...' : 'Save Sequence' }}
            </button>
          </div>
        </form>
      </div>
    </p-dialog>
  `,
})
export class BankNumberRangesComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private cdr  = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  loading  = signal(true);
  saving   = signal(false);
  ranges   = signal<any[]>([]);
  showDialog = false;
  editing: any = null;

  readonly sequenceTypes = SEQUENCE_TYPES;

  form = this.fb.group({
    type:        ['', Validators.required],
    prefix:      [''],
    separator:   ['-'],
    startNumber: [1000, [Validators.required, Validators.min(1)]],
    endNumber:   [99999999, [Validators.required, Validators.min(1)]],
    padding:     [6],
  });

  ngOnInit() { this.loadRanges(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadRanges() {
    this.loading.set(true);
    this.http.get<any>(`/number-ranges?bankId=${this.bankId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => { this.ranges.set(res.data ?? res ?? []); },
        error: () => this.loading.set(false),
      });
  }

  openDialog(range?: any) {
    this.editing = range ?? null;
    this.form.reset({ separator: '-', startNumber: 1000, endNumber: 99999999, padding: 6 });
    if (range) {
      this.form.patchValue(range);
      this.form.get('type')?.disable();
    } else {
      this.form.get('type')?.enable();
    }
    this.showDialog = true;
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const val = this.form.getRawValue();

    const req = this.editing
      ? this.http.patch(`/number-ranges/${this.editing.id}`, val)
      : this.http.post('/number-ranges', { ...val, bankId: this.bankId });

    req.pipe(takeUntil(this.destroy$), finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Sequence saved.' });
          this.showDialog = false;
          this.loadRanges();
        },
        error: (err) => {
          const msg = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg ?? 'Failed.' });
        },
      });
  }

  toggleStatus(r: any) {
    this.http.patch(`/number-ranges/${r.id}/status`, { isActive: !r.isActive })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          r.isActive = !r.isActive;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Sequence ${r.isActive ? 'activated' : 'suspended'}.` });
          this.cdr.detectChanges();
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  getTypeLabel(type: string): string {
    return SEQUENCE_TYPES.find(t => t.value === type)?.label ?? type;
  }

  getProgress(r: any): number {
    const total = r.endNumber - r.startNumber;
    if (total <= 0) return 100;
    const used = r.currentNumber - r.startNumber;
    return Math.min(100, Math.round((used / total) * 100));
  }

  getSampleOutput(r: any): string {
    const num = String(r.currentNumber).padStart(r.padding ?? 6, '0');
    const sep = r.separator ?? '';
    return r.prefix ? `${r.prefix}${sep}${num}` : num;
  }

  previewOutput(): string {
    const val = this.form.getRawValue();
    const num = String(val.startNumber ?? 1000).padStart(val.padding ?? 6, '0');
    const sep = val.separator ?? '';
    return val.prefix ? `${val.prefix?.toUpperCase()}${sep}${num}` : num;
  }

  isInvalid(f: string) {
    const c = this.form.get(f);
    return !!(c?.invalid && (c.dirty || c.touched));
  }
}
