import { Component, OnInit, OnDestroy, inject, signal, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GeographyService } from '../../../shared/services/geography.service';
import { Country, State, Town, Village } from '../../../shared/models/geography.model';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { LoadingSkeletonComponent } from '../../../shared/components/ui/loading-skeleton/loading-skeleton.component';
import { ConfirmModalComponent } from '../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { HttpClient } from '@angular/common/http';

type GeoTab = 'countries' | 'states' | 'towns' | 'villages';

/** Generic helper to build status-toggle button classes */
const TOGGLE_ON  = 'bg-green-500 dark:bg-green-600';
const TOGGLE_OFF = 'bg-slate-300 dark:bg-slate-700';

@Component({
  selector: 'app-geography',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TranslateModule,
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
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">Geography</h1>
      <p class="text-sm text-slate-400 mt-0.5">Manage countries, states, towns and villages for address validation</p>
    </div>
    <ng-container *appHasPermission="['geography', 'create']">
      <button type="button" (click)="openDialog()"
              class="btn-primary px-4 py-2 text-sm gap-2 shrink-0"
              [disabled]="activeTab !== 'countries' && !canAddCurrent()">
        <i class="pi pi-plus text-xs"></i> Add {{ tabLabel() }}
      </button>
    </ng-container>
  </div>

  <!-- Tab navigation -->
  <div class="border-b border-slate-200 dark:border-slate-800">
    <nav class="flex items-center overflow-x-auto no-scrollbar gap-1 px-1">
      <button *ngFor="let t of tabs" type="button" (click)="loadTab(t.key)"
              class="relative whitespace-nowrap font-semibold transition-all duration-200 flex items-center gap-2 border-b-[2px] -mb-[1px] outline-none py-3 px-4 text-sm"
              [class.text-primary-600]="activeTab === t.key" [class.border-primary-600]="activeTab === t.key"
              [class.text-slate-500]="activeTab !== t.key" [class.border-transparent]="activeTab !== t.key">
        <i class="pi {{ t.icon }} text-sm"></i>{{ t.label | translate }}
      </button>
    </nav>
  </div>

  <!-- Hierarchy filters (States→Towns→Villages) -->
  <div *ngIf="activeTab !== 'countries'" class="card p-4 flex flex-wrap gap-3 items-end">
    <div *ngIf="['states','towns','villages'].includes(activeTab)" class="form-group !mb-0 min-w-[200px]">
      <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Country</label>
      <select [(ngModel)]="selectedCountryCode" (ngModelChange)="onCountryChange()"
              class="w-full">
        <option value="">Select country...</option>
        <option *ngFor="let c of allCountries()" [value]="c.code">{{ c.flag }} {{ c.name }}</option>
      </select>
    </div>
    <div *ngIf="['towns','villages'].includes(activeTab)" class="form-group !mb-0 min-w-[200px]">
      <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">State</label>
      <select [(ngModel)]="selectedStateId" (ngModelChange)="onStateChange()"
              [disabled]="!selectedCountryCode" class="w-full">
        <option value="">Select state...</option>
        <option *ngFor="let s of states()" [value]="s.id">{{ s.name }}</option>
      </select>
    </div>
    <div *ngIf="activeTab === 'villages'" class="form-group !mb-0 min-w-[200px]">
      <label class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Town</label>
      <select [(ngModel)]="selectedTownId" (ngModelChange)="loadVillages()"
              [disabled]="!selectedStateId" class="w-full">
        <option value="">Select town...</option>
        <option *ngFor="let t of towns()" [value]="t.id">{{ t.name }}</option>
      </select>
    </div>
  </div>

  <!-- Search + status filter -->
  <div class="card p-4 flex flex-col sm:flex-row gap-3 items-center">
    <div class="relative flex-1">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none z-10"></i>
      <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()"
             [placeholder]="'Search ' + (activeTab | titlecase) + '...'"
             style="padding-left:2.5rem!important"
             class="w-full pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm
                    outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all" />
    </div>
    <div class="flex gap-1 shrink-0">
      <button *ngFor="let f of statusFilters" type="button" (click)="activeStatus = f.value; applyFilter()"
              class="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              [class.bg-primary-600]="activeStatus === f.value" [class.text-white]="activeStatus === f.value"
              [class.bg-slate-100]="activeStatus !== f.value" [class.dark:bg-slate-800]="activeStatus !== f.value"
              [class.text-slate-500]="activeStatus !== f.value">{{ f.label }}</button>
    </div>
  </div>

  <!-- Loading -->
  <app-loading-skeleton *ngIf="loading()" [lines]="6"></app-loading-skeleton>

  <!-- Data table — shared template for all tabs -->
  <div *ngIf="!loading()" class="card overflow-hidden">
    <table class="w-full data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th *ngIf="activeTab === 'countries'">Code</th>
          <th *ngIf="activeTab === 'countries'">Dial Code</th>
          <th *ngIf="activeTab === 'countries'">Currency</th>
          <th *ngIf="activeTab === 'states'">Code</th>
          <th *ngIf="activeTab === 'towns' || activeTab === 'villages'">PIN Code</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <!-- Empty state -->
        <tr *ngIf="filtered().length === 0">
          <td [attr.colspan]="activeTab === 'countries' ? 6 : 4" class="py-16 text-center">
            <i class="pi pi-map text-3xl text-slate-300 block mb-3"></i>
            <p class="font-bold text-slate-500">
              {{ !canSeeList() ? 'Select a ' + parentLabel() + ' first' : 'No ' + activeTab + ' found' }}
            </p>
          </td>
        </tr>

        <tr *ngFor="let item of filtered()"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">

          <!-- Name -->
          <td>
            <div class="flex items-center gap-2">
              <span *ngIf="activeTab === 'countries' && item.flag" class="text-lg">{{ item.flag }}</span>
              <div>
                <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ item.name }}</p>
                <p *ngIf="activeTab === 'countries'" class="text-[10px] font-mono text-slate-400">{{ item.code }}</p>
              </div>
            </div>
          </td>

          <td *ngIf="activeTab === 'countries'">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded text-xs">{{ item.code }}</span>
          </td>
          <td *ngIf="activeTab === 'countries'" class="font-mono text-sm text-slate-500">{{ item.dialCode || '—' }}</td>
          <td *ngIf="activeTab === 'countries'" class="font-mono text-sm text-slate-500">{{ item.currencyCode || '—' }}</td>
          <td *ngIf="activeTab === 'states'" class="font-mono text-sm text-slate-500">{{ item.code || '—' }}</td>
          <td *ngIf="activeTab === 'towns' || activeTab === 'villages'" class="font-mono text-sm text-slate-500">{{ item.pinCode || '—' }}</td>

          <!-- Status toggle -->
          <td (click)="$event.stopPropagation()">
            <div class="flex items-center gap-2.5">
              <ng-container *appHasPermission="['geography', 'update']">
                <button type="button" (click)="toggleItemStatus(item)" [disabled]="item.isUpdating"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60"
                        [class.bg-green-500]="item.isActive" [class.dark:bg-green-600]="item.isActive"
                        [class.bg-slate-300]="!item.isActive" [class.dark:bg-slate-700]="!item.isActive">
                  <span class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow flex items-center justify-center transition-transform duration-200"
                        [class.translate-x-4]="item.isActive" [class.translate-x-0]="!item.isActive">
                    <i *ngIf="item.isUpdating" class="pi pi-spin pi-spinner text-[8px] text-primary-600"></i>
                  </span>
                </button>
              </ng-container>
              <span class="text-[10px] font-bold uppercase tracking-widest w-16"
                    [class.text-green-600]="item.isActive" [class.dark:text-green-400]="item.isActive"
                    [class.text-slate-400]="!item.isActive">
                {{ item.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </td>

          <!-- Actions -->
          <td class="text-right" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <ng-container *appHasPermission="['geography', 'update']">
                <button type="button" (click)="openDialog(item)"
                        class="btn-ghost btn-icon w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  <i class="pi pi-pencil text-sm"></i>
                </button>
              </ng-container>
              <ng-container *appHasPermission="['geography', 'delete']">
                <button type="button" (click)="confirmDelete(item)"
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

<!-- Unified Create/Edit Modal -->
<p-dialog [(visible)]="showDialog" [modal]="true" appendTo="body" position="center"
          [style]="{ width: '480px', maxWidth: '98vw' }"
          [showHeader]="false" contentStyleClass="p-0 bg-transparent">
  <div *ngIf="showDialog"
       class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in">

    <!-- Modal header -->
    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <i class="pi" [class]="tabIcon()"></i>
        </div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white text-base">
            {{ editingItem ? 'Edit' : 'Add' }} {{ tabLabel() }}
          </h3>
          <p *ngIf="editingItem" class="text-xs text-slate-400">{{ editingItem.name }}</p>
        </div>
      </div>
      <button (click)="showDialog = false"
              class="btn-icon w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
        <i class="pi pi-times text-sm"></i>
      </button>
    </div>

    <!-- Form -->
    <form [formGroup]="getActiveForm()" (ngSubmit)="save()" class="p-6 space-y-4">

      <!-- Country-specific fields -->
      <ng-container *ngIf="activeTab === 'countries'">
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group !mb-0">
            <label>ISO Code <span class="text-red-500">*</span> <span class="text-[10px] text-slate-400 font-normal">(2 letters)</span></label>
            <input type="text" formControlName="code" placeholder="IN" maxlength="2"
                   style="text-transform:uppercase"
                   [attr.readonly]="!!editingItem ? true : null" [class.!opacity-50]="!!editingItem" />
          </div>
          <div class="form-group !mb-0">
            <label>Currency Code <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
            <input type="text" formControlName="currencyCode" placeholder="INR" maxlength="3" style="text-transform:uppercase" />
          </div>
        </div>
        <div class="form-group !mb-0">
          <label>Country Name <span class="text-red-500">*</span></label>
          <input type="text" formControlName="name" placeholder="India"
                 [class.border-red-400]="isNameInvalid()" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group !mb-0">
            <label>Dial Code <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
            <input type="text" formControlName="dialCode" placeholder="+91" />
          </div>
          <div class="form-group !mb-0">
            <label>Flag Emoji <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
            <input type="text" formControlName="flag" placeholder="🇮🇳" />
          </div>
        </div>
      </ng-container>

      <!-- State-specific fields -->
      <ng-container *ngIf="activeTab === 'states'">
        <div class="form-group !mb-0">
          <label>State Name <span class="text-red-500">*</span></label>
          <input type="text" formControlName="name" placeholder="Karnataka" />
        </div>
        <div class="form-group !mb-0">
          <label>State Code <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
          <input type="text" formControlName="code" placeholder="IN-KA" />
        </div>
      </ng-container>

      <!-- Town-specific fields -->
      <ng-container *ngIf="activeTab === 'towns'">
        <div class="form-group !mb-0">
          <label>Town / City Name <span class="text-red-500">*</span></label>
          <input type="text" formControlName="name" placeholder="Bengaluru" />
        </div>
        <div class="form-group !mb-0">
          <label>PIN Code <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
          <input type="text" formControlName="pinCode" placeholder="560001" maxlength="10" class="font-mono" />
        </div>
      </ng-container>

      <!-- Village-specific fields -->
      <ng-container *ngIf="activeTab === 'villages'">
        <div class="form-group !mb-0">
          <label>Village / Locality Name <span class="text-red-500">*</span></label>
          <input type="text" formControlName="name" placeholder="Koramangala" />
        </div>
        <div class="form-group !mb-0">
          <label>PIN Code <span class="text-[10px] text-slate-400 font-normal">(optional)</span></label>
          <input type="text" formControlName="pinCode" placeholder="560034" maxlength="10" class="font-mono" />
        </div>
      </ng-container>

      <!-- Active toggle (edit only) -->
      <div *ngIf="editingItem" class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
        <p-inputSwitch formControlName="isActive"></p-inputSwitch>
        <div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Active</p>
          <p class="text-[11px] text-slate-400">Inactive entries are hidden from address selection</p>
        </div>
      </div>

      <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button type="button" (click)="showDialog = false" class="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="submit" [disabled]="saving() || getActiveForm().invalid" class="btn-primary px-5 py-2 text-sm gap-2">
          <i *ngIf="saving()" class="pi pi-spin pi-spinner text-xs"></i>
          <i *ngIf="!saving()" class="pi pi-check text-xs"></i>
          {{ saving() ? 'Saving...' : 'Save ' + tabLabel() }}
        </button>
      </div>
    </form>
  </div>
</p-dialog>

<!-- Delete Confirmation -->
<app-confirm-modal
  [(visible)]="showDeleteModal"
  [isProcessing]="deleting()"
  title="Delete {{ tabLabel() }}?"
  confirmText="Delete"
  processingText="Deleting..."
  (confirm)="executeDelete()">
  Are you sure you want to permanently delete
  <strong>{{ deletingItem?.name }}</strong>?
  <span *ngIf="activeTab === 'countries' || activeTab === 'states'"> All associated {{ activeTab === 'countries' ? 'states, towns and villages' : 'towns and villages' }} may also be affected.</span>
</app-confirm-modal>
  `,
})
export class GeographyComponent implements OnInit, OnDestroy {
  private geoService     = inject(GeographyService);
  private http           = inject(HttpClient);
  private messageService = inject(MessageService);
  private fb             = inject(FormBuilder);
  readonly cdr           = inject(ChangeDetectorRef);
  private destroy$       = new Subject<void>();

  activeTab: GeoTab = 'countries';
  tabs = [
    { key: 'countries' as GeoTab, label: 'GEOGRAPHY.COUNTRIES', icon: 'pi-globe'      },
    { key: 'states'    as GeoTab, label: 'GEOGRAPHY.STATES',    icon: 'pi-map-marker' },
    { key: 'towns'     as GeoTab, label: 'GEOGRAPHY.TOWNS',     icon: 'pi-building'   },
    { key: 'villages'  as GeoTab, label: 'GEOGRAPHY.VILLAGES',  icon: 'pi-home'       },
  ];

  allCountries = signal<Country[]>([]);  // always loaded for cascade dropdowns
  countries    = signal<Country[]>([]);
  states       = signal<State[]>([]);
  towns        = signal<Town[]>([]);
  villages     = signal<Village[]>([]);
  filtered     = signal<any[]>([]);
  loading      = signal(false);
  saving       = signal(false);
  deleting     = signal(false);

  selectedCountryCode = '';
  selectedStateId     = '';
  selectedTownId      = '';

  showDialog      = false;
  showDeleteModal = false;
  editingItem: any  = null;
  deletingItem: any = null;

  searchQuery  = '';
  activeStatus = 'ALL';

  readonly statusFilters = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  // Forms per entity
  countryForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    name: ['', Validators.required],
    dialCode: [''], currencyCode: [''], flag: [''], isActive: [true],
  });
  stateForm   = this.fb.group({ name: ['', Validators.required], code: [''], isActive: [true] });
  townForm    = this.fb.group({ name: ['', Validators.required], pinCode: [''], isActive: [true] });
  villageForm = this.fb.group({ name: ['', Validators.required], pinCode: [''], isActive: [true] });

  // Returns the currently active form group (typed as FormGroup for template safety)
  getActiveForm() {
    switch (this.activeTab) {
      case 'states':   return this.stateForm;
      case 'towns':    return this.townForm;
      case 'villages': return this.villageForm;
      default:         return this.countryForm;
    }
  }
  // Keep getter for TS class usage
  get activeForm() { return this.getActiveForm(); }

  isNameInvalid() {
    const form = this.getActiveForm();
    const c = (form as any).get('name');
    return !!(c?.invalid && c.touched);
  }

  tabLabel()  { return { countries:'Country', states:'State', towns:'Town', villages:'Village' }[this.activeTab]; }
  tabIcon()   { return { countries:'pi-globe', states:'pi-map-marker', towns:'pi-building', villages:'pi-home' }[this.activeTab]; }
  parentLabel() { return { states:'country', towns:'state', villages:'town' }[this.activeTab as 'states'|'towns'|'villages'] || ''; }

  canAddCurrent() {
    if (this.activeTab === 'states')   return !!this.selectedCountryCode;
    if (this.activeTab === 'towns')    return !!this.selectedStateId;
    if (this.activeTab === 'villages') return !!this.selectedTownId;
    return true;
  }
  canSeeList() {
    if (this.activeTab === 'states')   return !!this.selectedCountryCode;
    if (this.activeTab === 'towns')    return !!this.selectedStateId;
    if (this.activeTab === 'villages') return !!this.selectedTownId;
    return true;
  }

  ngOnInit() { this.loadTab('countries'); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  loadTab(tab: GeoTab) {
    this.activeTab   = tab;
    this.searchQuery = '';
    this.activeStatus = 'ALL';
    if (this.allCountries().length === 0) this.loadAllCountries();
    if (tab === 'countries') this.loadCountries();
    this.cdr.detectChanges();
  }

  loadAllCountries() {
    this.geoService.getCountries(false).subscribe({ next: (d) => { this.allCountries.set(d); this.cdr.detectChanges(); } });
  }

  loadCountries() {
    this.loading.set(true);
    this.geoService.getCountries(false).subscribe({
      next: (d) => { this.countries.set(d); this.applyFilter(); this.loading.set(false); this.cdr.detectChanges(); },
      error: () => { this.loading.set(false); this.cdr.detectChanges(); },
    });
  }

  onCountryChange() {
    this.states.set([]); this.towns.set([]); this.villages.set([]);
    this.selectedStateId = ''; this.selectedTownId = '';
    this.filtered.set([]);
    if (this.selectedCountryCode) {
      this.loading.set(true);
      this.geoService.getStates(this.selectedCountryCode, false).subscribe({
        next: (d) => { this.states.set(d); this.applyFilter(); this.loading.set(false); this.cdr.detectChanges(); },
        error: () => { this.loading.set(false); this.cdr.detectChanges(); },
      });
    }
    this.cdr.detectChanges();
  }

  onStateChange() {
    this.towns.set([]); this.villages.set([]);
    this.selectedTownId = '';
    this.filtered.set([]);
    if (this.selectedStateId) {
      this.loading.set(true);
      this.geoService.getTowns(this.selectedStateId, false).subscribe({
        next: (d) => { this.towns.set(d); this.applyFilter(); this.loading.set(false); this.cdr.detectChanges(); },
        error: () => { this.loading.set(false); this.cdr.detectChanges(); },
      });
    }
    this.cdr.detectChanges();
  }

  loadVillages() {
    if (!this.selectedTownId) return;
    this.loading.set(true);
    this.geoService.getVillages(this.selectedTownId, false).subscribe({
      next: (d) => { this.villages.set(d); this.applyFilter(); this.loading.set(false); this.cdr.detectChanges(); },
      error: () => { this.loading.set(false); this.cdr.detectChanges(); },
    });
  }

  getCurrentList(): any[] {
    switch (this.activeTab) {
      case 'countries': return this.countries();
      case 'states':    return this.states();
      case 'towns':     return this.towns();
      case 'villages':  return this.villages();
    }
  }

  applyFilter() {
    let list = this.getCurrentList();
    if (this.activeStatus === 'active')   list = list.filter(i => i.isActive);
    if (this.activeStatus === 'inactive') list = list.filter(i => !i.isActive);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(i => i.name?.toLowerCase().includes(q) || i.code?.toLowerCase().includes(q) || i.pinCode?.includes(q));
    }
    this.filtered.set(list);
    this.cdr.detectChanges();
  }

  openDialog(item?: any) {
    this.editingItem = item ?? null;
    this.activeForm.reset({ isActive: true });
    if (item) {
      this.activeForm.patchValue(item);
      if (this.activeTab === 'countries') this.countryForm.get('code')?.disable();
    } else {
      if (this.activeTab === 'countries') this.countryForm.get('code')?.enable();
    }
    this.showDialog = true;
    this.cdr.detectChanges();
  }

  save() {
    if (this.activeForm.invalid) { this.activeForm.markAllAsTouched(); return; }
    this.saving.set(true);
    const val = this.activeForm.getRawValue();

    let obs: any;
    switch (this.activeTab) {
      case 'countries':
        obs = this.editingItem
          ? this.geoService.updateCountry(this.editingItem.code, val as any)
          : this.geoService.createCountry(val as any);
        break;
      case 'states':
        obs = this.editingItem
          ? this.geoService.updateState(this.editingItem.id, val as any)
          : this.geoService.createState(this.selectedCountryCode, val as any);
        break;
      case 'towns':
        obs = this.editingItem
          ? this.geoService.updateTown(this.editingItem.id, val as any)
          : this.geoService.createTown(this.selectedStateId, val as any);
        break;
      case 'villages':
        obs = this.editingItem
          ? this.geoService.updateVillage(this.editingItem.id, val as any)
          : this.geoService.createVillage(this.selectedTownId, val as any);
        break;
    }

    obs.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: `${this.tabLabel()} saved.` });
        this.showDialog = false;
        this.saving.set(false);
        if (this.activeTab === 'countries') { this.geoService.clearCountriesCache(); this.loadCountries(); }
        else if (this.activeTab === 'states')   this.onCountryChange();
        else if (this.activeTab === 'towns')    this.onStateChange();
        else this.loadVillages();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message ?? 'Failed.' });
        this.saving.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  toggleItemStatus(item: any) {
    item.isUpdating = true;
    this.cdr.detectChanges();
    // Use the general geography update endpoint for each type
    const endpoint = this.getUpdateEndpoint(item);
    this.http.patch(endpoint, { isActive: !item.isActive })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          item.isActive = !item.isActive;
          item.isUpdating = false;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `${item.name} ${item.isActive ? 'activated' : 'deactivated'}.` });
          this.applyFilter();
          this.cdr.detectChanges();
        },
        error: (err) => {
          item.isUpdating = false;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message });
          this.cdr.detectChanges();
        },
      });
  }

  private getUpdateEndpoint(item: any): string {
    switch (this.activeTab) {
      case 'countries': return `/geography/countries/${item.code}`;
      case 'states':    return `/geography/states/${item.id}`;
      case 'towns':     return `/geography/towns/${item.id}`;
      case 'villages':  return `/geography/villages/${item.id}`;
    }
  }

  private getDeleteEndpoint(item: any): string {
    switch (this.activeTab) {
      case 'countries': return `/geography/countries/${item.code}`;
      case 'states':    return `/geography/states/${item.id}`;
      case 'towns':     return `/geography/towns/${item.id}`;
      case 'villages':  return `/geography/villages/${item.id}`;
    }
  }

  confirmDelete(item: any) {
    this.deletingItem = item;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.deletingItem) return;
    this.deleting.set(true);
    this.http.delete(this.getDeleteEndpoint(this.deletingItem))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${this.deletingItem.name} deleted.` });
          this.showDeleteModal = false;
          this.deletingItem = null;
          this.deleting.set(false);
          // Reload the current list
          if (this.activeTab === 'countries') { this.geoService.clearCountriesCache(); this.loadCountries(); }
          else if (this.activeTab === 'states')   this.onCountryChange();
          else if (this.activeTab === 'towns')    this.onStateChange();
          else this.loadVillages();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Delete failed.' });
          this.deleting.set(false);
          this.cdr.detectChanges();
        },
      });
  }
}
