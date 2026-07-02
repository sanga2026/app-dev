import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AppValidators } from '../../../../../../core/utils/validators.util';
import { DROPDOWN_OPTIONS } from '../../../../../../shared/constants/dropdown-options.constant';
import { GeographyService } from '../../../../../../shared/services/geography.service';
import { State, Town, Village } from '../../../../../../shared/models/geography.model';

import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-branch-general',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, TranslateModule,
    DialogModule, InputSwitchModule, HasPermissionDirective,
  ],
  templateUrl: './branch-general.component.html'
})
export class BranchGeneralComponent implements OnInit, OnDestroy {
  @Input() branch: any;
  @Input() bankId!: string;
  @Input() branchId!: string;          // needed to scope manager search to this branch
  @Input() currentLayout: string = 'standard';
  @Output() refreshData = new EventEmitter<void>();

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private cdr  = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router  = inject(Router);
  private geoService = inject(GeographyService);
  private destroy$   = new Subject<void>();

  public isEditing  = false;
  public isSaving   = false;
  public isDeleting = false;
  public showDeleteModal = false;
  public editForm!: FormGroup;

  public branchTypes  = DROPDOWN_OPTIONS.BRANCH_TYPES;
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;
  public tiers        = DROPDOWN_OPTIONS.TIERS;

  // Geography from API — full cascade
  public countries:        any[]     = [];
  public branchStates:     State[]   = [];
  public filteredCities:   Town[]    = [];
  public filteredVillages: Village[] = [];
  public isLoadingCountries = false;
  public isLoadingStates    = false;
  public isLoadingCities    = false;
  public isLoadingVillages  = false;

  // Manager autocomplete
  public managerQuery            = '';
  public managerSuggestions: any[] = [];
  public showManagerDropdown     = false;
  public isSearchingManager      = false;
  private managerSearch$         = new Subject<string>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.manager-autocomplete')) {
      this.showManagerDropdown = false;
      this.cdr.detectChanges();
    }
  }

  ngOnInit() {
    this.initForm();
    this.loadCountries();

    // Debounced manager search — scoped to this bank + branch
    this.managerSearch$.pipe(
      debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)
    ).subscribe(q => this._searchManagers(q));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.editForm = this.fb.group({
      // 1. Identity & Routing (Excludes immutable fields like IFSC and Branch Code)
      name: ['', [Validators.required, Validators.maxLength(100)]],
      branchType: ['RETAIL_BRANCH', Validators.required],
      openingDate: ['', Validators.required],
      micrCode: ['', [Validators.pattern(/^[0-9]{9}$/)]], // Exactly 9 digits if provided
      swiftCode: ['', [Validators.pattern(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/)]], // 8 or 11 alphanumeric if provided
      tier: ['URBAN', Validators.required],

      // 2. Location & Contact
      email:       ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      phoneCode:   ['+91', Validators.required],
      phone:       ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      addressLine1:['', Validators.required],
      addressLine2:[''],
      countryCode: ['', Validators.required],
      stateId:     [{ value: '', disabled: true }, Validators.required],
      city:        [{ value: '', disabled: true }, Validators.required],
      village:     [{ value: '', disabled: true }, Validators.required],   // mandatory
      postalCode:  ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],

      // 3. Operations & Limits
      managerName: ['', Validators.required],
      managerId:   ['', Validators.required],
      gstin:       [''],
      cashRetentionLimit: [null, [Validators.min(0)]],
      openingTime: ['', Validators.required],
      closingTime: ['', Validators.required],
      isAtmAvailable: [false]
    });
  }

  private loadCountries() {
    this.isLoadingCountries = true;
    this.geoService.getCountries(true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCountries = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (c) => { this.countries = c; this.cdr.markForCheck(); } });
  }

  public onCountryChange(countryCode: string) {
    const stateCtrl   = this.editForm.get('stateId');
    const cityCtrl    = this.editForm.get('city');
    const villageCtrl = this.editForm.get('village');
    this.branchStates = []; this.filteredCities = []; this.filteredVillages = [];
    stateCtrl?.setValue('');   stateCtrl?.disable();
    cityCtrl?.setValue('');    cityCtrl?.disable();
    villageCtrl?.setValue(''); villageCtrl?.disable();
    if (!countryCode) return;
    this.isLoadingStates = true;
    this.geoService.getStates(countryCode, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (s) => { this.branchStates = s; if (s.length) stateCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  // Cascading Dropdown: State (id) → City (towns)
  public onStateChange(event: Event) {
    const stateId     = (event.target as HTMLSelectElement).value;
    const cityCtrl    = this.editForm.get('city');
    const villageCtrl = this.editForm.get('village');
    this.filteredCities = []; this.filteredVillages = [];
    cityCtrl?.setValue('');    cityCtrl?.disable();
    villageCtrl?.setValue(''); villageCtrl?.disable();
    if (!stateId) return;
    this.isLoadingCities = true;
    this.geoService.getTowns(stateId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCities = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (towns) => { this.filteredCities = towns; if (towns.length) cityCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  // Cascading Dropdown: City (id) → Village
  public onCityChange(event: Event) {
    const townId         = (event.target as HTMLSelectElement).value;
    const villageCtrl    = this.editForm.get('village');
    this.filteredVillages = [];
    villageCtrl?.setValue(''); villageCtrl?.disable();
    if (!townId) return;
    this.isLoadingVillages = true;
    this.geoService.getVillages(townId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (villages) => { this.filteredVillages = villages; if (villages.length) villageCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  public errorMsg(field: string): string {
    const ctrl = this.editForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['pattern']) {
      if (field === 'phone')       return 'Enter a valid 10-digit mobile number.';
      if (field === 'email')       return 'Enter a valid email address.';
      if (field === 'micrCode')    return 'MICR must be exactly 9 digits.';
      if (field === 'swiftCode')   return 'SWIFT must be 8 or 11 alphanumeric characters.';
      if (field === 'postalCode')  return 'PIN code must be 6 digits.';
      return 'Invalid format.';
    }
    return 'Invalid value.';
  }

  // ── Manager autocomplete (scoped to this bank + branch) ─────────────────

  public onManagerQueryChange(query: string) {
    this.managerQuery = query;
    if (this.editForm.get('managerId')?.value) {
      this.editForm.patchValue({ managerId: '' });
    }
    if (!query || query.trim().length < 2) {
      this.managerSuggestions = []; this.showManagerDropdown = false;
      this.cdr.detectChanges(); return;
    }
    this.managerSearch$.next(query.trim());
  }

  private _searchManagers(query: string) {
    if (!this.bankId) return;
    this.isSearchingManager  = true;
    this.showManagerDropdown = true;
    // Search within this branch first; fall back to bank-level users if needed
    const url = this.branchId
      ? `/banks/${this.bankId}/branches/${this.branchId}/staff?search=${encodeURIComponent(query)}&limit=8&offset=0`
      : `/banks/${this.bankId}/admins?search=${encodeURIComponent(query)}&limit=8&offset=0`;
    this.http.get<any>(url)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSearchingManager = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => { this.managerSuggestions = r.data || r || []; this.cdr.detectChanges(); } });
  }

  public selectManager(user: any) {
    const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
    this.managerQuery = fullName;
    this.editForm.patchValue({ managerName: fullName, managerId: user.id });
    this.managerSuggestions = []; this.showManagerDropdown = false;
    this.cdr.detectChanges();
  }

  public clearManager() {
    this.managerQuery = '';
    this.editForm.patchValue({ managerName: '', managerId: '' });
    this.managerSuggestions = []; this.showManagerDropdown = false;
    this.cdr.detectChanges();
  }

  public toggleEditMode() {
    this.isEditing = true;
    // Pre-fill manager autocomplete query from saved data
    this.managerQuery = this.branch.metadata?.managerName || '';
    this.managerSuggestions = []; this.showManagerDropdown = false;

    // Extract phone code and number
    let pCode = '+91';
    let pNumber = this.branch.phone || this.branch.phoneNumber || '';
    for (const code of ['+91', '+1', '+44', '+971', '+65', '+61']) {
      if (pNumber.startsWith(code)) { pCode = code; pNumber = pNumber.substring(code.length); break; }
    }

    // Formatted date for HTML date input
    const formattedDate = this.branch.openingDate
      ? new Date(this.branch.openingDate).toISOString().split('T')[0] : '';

    // Find country by stored country name
    const countryObj = this.countries.find(c => c.name === this.branch.country);
    const countryCode = countryObj?.code ?? 'IN';

    // Patch non-geo fields immediately
    this.editForm.patchValue({
      name:               this.branch.name,
      branchType:         this.branch.branchType || 'RETAIL_BRANCH',
      openingDate:        formattedDate,
      micrCode:           this.branch.micrCode || '',
      swiftCode:          this.branch.swiftCode || '',
      tier:               this.branch.metadata?.tier || 'URBAN',
      email:              this.branch.email,
      phoneCode:          pCode,
      phone:              pNumber,
      addressLine1:       this.branch.addressLine1,
      addressLine2:       this.branch.addressLine2 || '',
      countryCode:        countryCode,
      postalCode:         this.branch.postalCode,
      managerName:        this.branch.metadata?.managerName || '',
      managerId:          this.branch.metadata?.managerId   || '',
      gstin:              this.branch.metadata?.gstin || '',
      cashRetentionLimit: this.branch.metadata?.cashRetentionLimit || null,
      openingTime:        this.branch.metadata?.openingTime || '09:00',
      closingTime:        this.branch.metadata?.closingTime || '17:00',
      isAtmAvailable:     this.branch.metadata?.isAtmAvailable || false,
    });

    // Load states for the country, then cascade to city/village
    if (countryCode) {
      this.isLoadingStates = true;
      this.geoService.getStates(countryCode, true)
        .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.markForCheck(); }))
        .subscribe({ next: (states) => {
          this.branchStates = states;
          const stateObj = states.find(s => s.name === this.branch.state);
          if (stateObj) {
            this.editForm.get('stateId')?.enable();
            this.editForm.patchValue({ stateId: stateObj.id });
            // Load cities
            this.isLoadingCities = true;
            this.geoService.getTowns(stateObj.id, true)
              .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCities = false; this.cdr.markForCheck(); }))
              .subscribe({ next: (towns) => {
                this.filteredCities = towns;
                if (towns.length) this.editForm.get('city')?.enable();
                const cityObj = towns.find(t => t.name === this.branch.city);
                if (cityObj) {
                  this.editForm.patchValue({ city: cityObj.id });
                  // Load villages
                  this.isLoadingVillages = true;
                  this.geoService.getVillages(cityObj.id, true)
                    .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.markForCheck(); }))
                    .subscribe({ next: (villages) => {
                      this.filteredVillages = villages;
                      if (villages.length) this.editForm.get('village')?.enable();
                      const v = villages.find(v => v.name === this.branch.village);
                      if (v) this.editForm.patchValue({ village: v.id });
                      this.cdr.markForCheck();
                    }});
                }
                this.cdr.markForCheck();
              }});
          }
          this.cdr.markForCheck();
        }});
    }
  }

  public cancelEditMode() { 
    this.isEditing = false; 
  }

  public saveDetails() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please fill out all required fields properly.'});
      return;
    }
    
    this.isSaving = true;
    const vals = this.editForm.getRawValue();

    const payload = {
      name: vals.name.trim(),
      branchType: vals.branchType,
      openingDate: vals.openingDate,
      micrCode: vals.micrCode?.toUpperCase().trim() || null,
      swiftCode: vals.swiftCode?.toUpperCase().trim() || null,

      email: vals.email?.trim() || null,
      phone: `${vals.phoneCode}${vals.phone.trim()}`,
      addressLine1: vals.addressLine1.trim(),
      addressLine2: vals.addressLine2?.trim() || null,
      state:   this.branchStates.find(s => s.id === vals.stateId)?.name   ?? vals.stateId,
      city:    this.filteredCities.find(t => t.id === vals.city)?.name    ?? vals.city,
      village: this.filteredVillages.find(v => v.id === vals.village)?.name ?? vals.village?.trim() ?? null,
      country: this.countries.find(c => c.code === vals.countryCode)?.name ?? vals.countryCode,
      postalCode: vals.postalCode.trim(),
      
      metadata: {
        ...this.branch.metadata,
        tier:               vals.tier,
        managerName:        vals.managerName?.trim() || null,
        managerId:          vals.managerId || null,
        gstin:              vals.gstin?.toUpperCase().trim() || null,
        cashRetentionLimit: vals.cashRetentionLimit || null,
        openingTime:        vals.openingTime,
        closingTime:        vals.closingTime,
        isAtmAvailable:     vals.isAtmAvailable,
      }
    };

    this.http.patch(`/banks/${this.bankId}/branches/${this.branch.id}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { 
        this.isSaving = false; 
        this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Branch updated successfully.' });
          this.refreshData.emit();
          this.isEditing = false;
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to update branch.' })
      });
  }

  public confirmDelete() { 
    this.showDeleteModal = true; 
  }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/banks/${this.bankId}/branches/${this.branch.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { 
        this.isDeleting = false; 
        this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: res.message || 'Branch has been deleted.' });
          this.showDeleteModal = false;
          setTimeout(() => this.router.navigate(['/banks', this.bankId]), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Could not delete branch.' })
      });
  }

  public getBranchTypeLabel(val: string): string {
    return this.branchTypes.find(t => t.value === val)?.label || val;
  }

  public isFieldInvalid(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}