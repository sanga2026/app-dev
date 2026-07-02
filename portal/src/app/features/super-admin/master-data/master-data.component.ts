import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { ConfirmModalComponent } from '../../../shared/components/modals/confirm-modal/confirm-modal.component';

const CATEGORIES = ['IDENTITY', 'ADDRESS', 'BUSINESS', 'INCOME'];

@Component({
  selector: 'app-master-data',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TitleCasePipe,
    DialogModule, HasPermissionDirective, LoadingSkeletonComponent, ConfirmModalComponent,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="max-w-[1400px] mx-auto space-y-5 animate-fade-in-up">

  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Document Types</h1>
      <p class="text-sm text-slate-400 mt-0.5">Manage document types used for KYC verification across all banks</p>
    </div>
    <ng-container *appHasPermission="['master-data', 'create']">
      <button type="button" (click)="openDialog()"
              class="btn-primary px-4 py-2 text-sm gap-2 shrink-0">
        <i class="pi pi-plus text-xs"></i> Add Document Type
      </button>
    </ng-container>
  </div>

  <!-- Search + category filter + status filter -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3 items-center">
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
             placeholder="Search by code or name..."
             style="padding-left:2.5rem!important"
             class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
    <!-- Category tabs -->
    <div class="flex gap-1 shrink-0 flex-wrap">
      <button type="button" (click)="activeCat = ''; applyFilter()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeCat === ''" [class.text-white]="activeCat === ''"
              [class.bg-slate-100]="activeCat !== ''" [class.dark:bg-slate-800]="activeCat !== ''"
              [class.text-slate-500]="activeCat !== ''">All</button>
      <button *ngFor="let cat of categories" type="button" (click)="activeCat = cat; applyFilter()"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
              [class.bg-primary-600]="activeCat === cat" [class.text-white]="activeCat === cat"
              [class.bg-slate-100]="activeCat !== cat" [class.dark:bg-slate-800]="activeCat !== cat"
              [class.text-slate-500]="activeCat !== cat">{{ cat | titlecase }}</button>
    </div>
    <!-- Status filter -->
    <div class="flex gap-1 shrink-0">
      <button *ngFor="let f of statusFilters" type="button"
              (click)="activeStatus = f.value; applyFilter()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeStatus === f.value" [class.text-white]="activeStatus === f.value"
              [class.bg-slate-100]="activeStatus !== f.value" [class.dark:bg-slate-800]="activeStatus !== f.value"
              [class.text-slate-500]="activeStatus !== f.value">{{ f.label }}</button>
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
          <th>Category</th>
          <th>Regex</th>
          <th>Mandatory</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngIf="filtered().length === 0">
          <td colspan="7" class="py-16 text-center">
            <i class="pi pi-file-edit text-3xl text-slate-300 block mb-3"></i>
            <p class="font-bold text-slate-500">No document types found</p>
          </td>
        </tr>
        <tr *ngFor="let doc of filtered()"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">

          <td><span class="font-mono font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded text-xs">{{ doc.id }}</span></td>
          <td class="font-semibold text-slate-900 dark:text-white text-sm">{{ doc.name }}</td>

          <td>
            <span class="badge text-[10px]"
                  [class.badge-blue]="doc.category === 'IDENTITY'"
                  [class.badge-green]="doc.category === 'ADDRESS'"
                  [class.badge-amber]="doc.category === 'BUSINESS'"
                  [class.badge-purple]="doc.category === 'INCOME'"
                  [class.badge-gray]="!['IDENTITY','ADDRESS','BUSINESS','INCOME'].includes(doc.category)">
              {{ doc.category | titlecase }}
            </span>
          </td>

          <td class="font-mono text-xs text-slate-400 max-w-[160px] truncate" [title]="doc.validationRegex">
            {{ doc.validationRegex }}
          </td>

          <td>
            <span *ngIf="doc.isMandatory" class="badge badge-red text-[10px]">Required</span>
            <span *ngIf="!doc.isMandatory" class="badge badge-gray text-[10px]">Optional</span>
          </td>

          <!-- Status toggle -->
          <td (click)="$event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <ng-container *appHasPermission="['master-data', 'update']">
                <button type="button" (click)="toggleStatus(doc)" [disabled]="doc.isUpdating"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60"
                        [class.bg-green-500]="doc.isActive" [class.dark:bg-green-600]="doc.isActive"
                        [class.bg-slate-300]="!doc.isActive" [class.dark:bg-slate-700]="!doc.isActive">
                  <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200"
                        [class.translate-x-4]="doc.isActive" [class.translate-x-0]="!doc.isActive">
                    <i *ngIf="doc.isUpdating" class="pi pi-spin pi-spinner text-[8px] text-primary-600"></i>
                  </span>
                </button>
              </ng-container>
              <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                    [class.text-green-600]="doc.isActive" [class.dark:text-green-400]="doc.isActive"
                    [class.text-slate-400]="!doc.isActive">
                {{ doc.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </td>

          <!-- Actions -->
          <td class="text-right" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ng-container *appHasPermission="['master-data', 'update']">
                <button type="button" (click)="openDialog(doc)"
                        class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  <i class="pi pi-pencil text-sm"></i>
                </button>
              </ng-container>
              <ng-container *appHasPermission="['master-data', 'delete']">
                <button type="button" (click)="confirmDelete(doc)"
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
          [style]="{ width: '580px', maxWidth: '98vw', maxHeight: '92vh' }"
          [showHeader]="false" contentStyleClass="p-0 bg-transparent">
  <div *ngIf="showDialog"
       class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col animate-scale-in"
       style="max-height:88vh">

    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi pi-file-edit text-primary-600 dark:text-primary-400"></i>
        </div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ editing ? 'Edit Document Type' : 'Add Document Type' }}</h3>
          <p *ngIf="editing" class="text-xs text-slate-400">{{ editing.id }}</p>
        </div>
      </div>
      <button (click)="showDialog = false"
              class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
        <i class="pi pi-times text-sm"></i>
      </button>
    </div>

    <form [formGroup]="form" (ngSubmit)="save()" class="overflow-y-auto flex-1 custom-scrollbar p-6 space-y-4">

      <div class="grid grid-cols-2 gap-4">
        <div class="form-group !mb-0">
          <label>Code (ID) <span class="text-red-500">*</span></label>
          <input type="text" formControlName="id" placeholder="PAN"
                 style="text-transform:uppercase"
                 [class.border-red-400]="isInvalid('id')"
                 [attr.readonly]="!!editing ? true : null" [class.!opacity-50]="!!editing" />
          <p *ngIf="isInvalid('id')" class="text-xs text-red-500 mt-1">
            Uppercase letters and underscores only (e.g. PAN, VOTER_ID)
          </p>
        </div>
        <div class="form-group !mb-0">
          <label>Category <span class="text-red-500">*</span></label>
          <select formControlName="category" [class.border-red-400]="isInvalid('category')">
            <option value="">Select...</option>
            <option *ngFor="let cat of categories" [value]="cat">{{ cat | titlecase }}</option>
          </select>
        </div>
      </div>

      <div class="form-group !mb-0">
        <label>Display Name <span class="text-red-500">*</span></label>
        <input type="text" formControlName="name" placeholder="Permanent Account Number"
               [class.border-red-400]="isInvalid('name')" />
        <p *ngIf="isInvalid('name')" class="text-xs text-red-500 mt-1">Required</p>
      </div>

      <div class="form-group !mb-0">
        <label>Validation Regex <span class="text-red-500">*</span></label>
        <input type="text" formControlName="validationRegex" placeholder="^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
               [class.border-red-400]="isInvalid('validationRegex')" />
        <p class="text-[11px] text-slate-400 mt-1">Used to validate the document number on both frontend and backend.</p>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-group !mb-0">
          <label>Placeholder <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
          <input type="text" formControlName="placeholder" placeholder="ABCDE1234F" />
        </div>
        <div class="form-group !mb-0">
          <label>Country <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
          <input type="text" formControlName="country" placeholder="INDIA" style="text-transform:uppercase" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" formControlName="isMandatory" class="w-4 h-4 rounded accent-primary-600" />
          <div>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Required for KYC</p>
            <p class="text-[10px] text-slate-400">Customers must provide this document</p>
          </div>
        </label>
        <label *ngIf="editing" class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" formControlName="isActive" class="w-4 h-4 rounded accent-emerald-600" />
          <div>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Active</p>
            <p class="text-[10px] text-slate-400">Show in document selection</p>
          </div>
        </label>
      </div>

      <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 -mx-6 px-6 pb-1 mt-2">
        <button type="button" (click)="showDialog = false" class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="submit" [disabled]="saving() || form.invalid" class="btn-primary px-5 py-2 text-sm gap-2">
          <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
          <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
          {{ saving() ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </form>
  </div>
</p-dialog>

<!-- Delete Confirmation -->
<app-confirm-modal
  [(visible)]="showDeleteModal"
  [isProcessing]="deleting()"
  title="Delete Document Type?"
  confirmText="Delete"
  processingText="Deleting..."
  (confirm)="executeDelete()">
  Are you sure you want to permanently delete document type
  <strong>{{ deletingItem?.id }}</strong> ({{ deletingItem?.name }})?
  This may affect KYC validation across all banks.
</app-confirm-modal>
  `,
})
export class MasterDataComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private fb      = inject(FormBuilder);
  private msg     = inject(MessageService);
  readonly cdr    = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  loading  = signal(true);
  saving   = signal(false);
  deleting = signal(false);

  allDocs  = signal<any[]>([]);
  filtered = signal<any[]>([]);

  showDialog      = false;
  showDeleteModal = false;
  editing: any    = null;
  deletingItem: any = null;

  searchQuery   = '';
  activeCat     = '';
  activeStatus  = 'ALL';

  readonly categories = CATEGORIES;
  readonly statusFilters = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  form = this.fb.group({
    id:              ['', [Validators.required, Validators.pattern(/^[A-Z_]+$/)]],
    name:            ['', Validators.required],
    category:        ['IDENTITY', Validators.required],
    validationRegex: ['', Validators.required],
    placeholder:     [''],
    country:         ['INDIA'],
    isMandatory:     [false],
    isActive:        [true],
  });

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  load() {
    this.loading.set(true);
    this.http.get<any>('/master-data/document-types?active=false')
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => { this.allDocs.set(res.data ?? res ?? []); this.applyFilter(); },
      });
  }

  applyFilter() {
    let list = this.allDocs();
    if (this.activeCat) list = list.filter(d => d.category === this.activeCat);
    if (this.activeStatus === 'active')   list = list.filter(d => d.isActive);
    if (this.activeStatus === 'inactive') list = list.filter(d => !d.isActive);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(d => d.id?.toLowerCase().includes(q) || d.name?.toLowerCase().includes(q));
    }
    this.filtered.set(list);
    this.cdr.detectChanges();
  }

  openDialog(doc?: any) {
    this.editing = doc ?? null;
    this.form.reset({ category: 'IDENTITY', country: 'INDIA', isMandatory: false, isActive: true });
    if (doc) { this.form.patchValue(doc); this.form.get('id')?.disable(); }
    else { this.form.get('id')?.enable(); }
    this.showDialog = true;
    this.cdr.detectChanges();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const val = this.form.getRawValue();
    const req = this.editing
      ? this.http.patch(`/master-data/document-types/${this.editing.id}`, val)
      : this.http.post('/master-data/document-types', { ...val, id: val.id?.toUpperCase() });

    req.pipe(takeUntil(this.destroy$), finalize(() => { this.saving.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Document type saved.' });
          this.showDialog = false;
          this.load();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m ?? 'Failed.' });
        },
      });
  }

  toggleStatus(doc: any) {
    doc.isUpdating = true;
    this.cdr.detectChanges();
    this.http.patch(`/master-data/document-types/${doc.id}/status`, { isActive: !doc.isActive })
      .pipe(takeUntil(this.destroy$), finalize(() => { doc.isUpdating = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          doc.isActive = !doc.isActive;
          this.msg.add({ severity: 'success', summary: 'Updated', detail: `${doc.id} ${doc.isActive ? 'activated' : 'deactivated'}.` });
          this.applyFilter();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message }),
      });
  }

  confirmDelete(doc: any) {
    this.deletingItem = doc;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.deletingItem) return;
    this.deleting.set(true);
    this.http.delete(`/master-data/document-types/${this.deletingItem.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.deleting.set(false); this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: `${this.deletingItem.id} deleted.` });
          this.showDeleteModal = false;
          this.deletingItem = null;
          this.load();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message }),
      });
  }

  isInvalid(f: string) { const c = this.form.get(f); return !!(c?.invalid && (c.dirty || c.touched)); }
}
