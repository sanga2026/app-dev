// src/app/features/super-admin/banks/banks.component.ts

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, EMPTY } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AppValidators } from '../../../core/utils/validators.util';
import { GeographyService } from '../../../shared/services/geography.service';
import { State, Town, Village } from '../../../shared/models/geography.model';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { StepsModule } from 'primeng/steps';
import { ToastModule } from 'primeng/toast';
import { InputSwitchModule } from 'primeng/inputswitch'; // 🚀 Added InputSwitchModule
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-banks-management',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, // 🚀 Required for [(ngModel)] in the input switch
    TableModule, 
    DialogModule, 
    StepsModule, 
    ToastModule,
    InputSwitchModule, // 🚀 Required for the toggle UI
    TranslateModule,
    HasPermissionDirective // 🚀 Added to imports array
  ],
  templateUrl: './banks.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BanksComponent implements OnInit, OnDestroy {
  /* =========================================================================
   * 1. DEPENDENCY INJECTION
   * ========================================================================= */
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private geoService = inject(GeographyService);
  private destroy$ = new Subject<void>();

  /* =========================================================================
   * 2. STATE MANAGEMENT & STATIC DATA
   * ========================================================================= */
  public banks: any[] = [];
  public isLoading = false;
  public isLoadingMore = false;
  public limit = 10;
  public offset = 0;
  public hasMoreBanks = true;

  public showOnboardModal = false;
  public currentStepIndex = 0;
  public isSubmitting = false;

  public onboardForm!: FormGroup;
  private stepGroups = ['identity', 'contact', 'plan'];

  public readonly steps = [
    'BANKS.STEPS.IDENTITY',
    'BANKS.STEPS.CONTACT',
    'BANKS.STEPS.PLAN',
    'BANKS.STEPS.REVIEW',
  ];

  public get reviewRows(): { label: string; value: string }[] {
    const v = this.onboardForm.getRawValue();
    const selectedCountry = this.countries.find(c => c.code === v.contact.countryCode);
    const selectedState   = this.states.find(s => s.id === v.contact.stateId);
    const selectedCity    = this.filteredCities.find(t => t.id === v.contact.city);
    return [
      { label: 'BANKS.REVIEW.BANK',     value: v.identity.name },
      { label: 'BANKS.REVIEW.IFSC',     value: v.identity.ifscPrefix?.toUpperCase() },
      { label: 'BANKS.REVIEW.TAX_ID',   value: v.identity.taxIdentifier?.toUpperCase() },
      { label: 'BANKS.REVIEW.EMAIL',    value: v.contact.hqEmail },
      { label: 'BANKS.REVIEW.LOCATION', value: [selectedCity?.name, selectedState?.name, selectedCountry?.name].filter(Boolean).join(', ') },
    ];
  }

  public countryCodes = [
    { label: 'IN (+91)', value: '+91' },
    { label: 'US (+1)', value: '+1' },
    { label: 'UK (+44)', value: '+44' },
    { label: 'UAE (+971)', value: '+971' }
  ];

  // Geography dropdowns — all loaded from API, full cascade
  public countries: any[] = [];
  public states: State[] = [];
  public filteredCities: Town[] = [];
  public filteredVillages: Village[] = [];
  public isLoadingCountries = false;
  public isLoadingStates = false;
  public isLoadingCities = false;
  public isLoadingVillages = false;

  public availablePlans = [
    { code: 'SILVER', name: 'Silver', branches: 5, users: 50, sessions: 1 },
    { code: 'GOLD', name: 'Gold', branches: 25, users: 500, sessions: 3 },
    { code: 'PLATINUM', name: 'Platinum', branches: 9999, users: 9999, sessions: 5 }
  ];

  /* =========================================================================
   * 3. LIFECYCLE HOOKS
   * ========================================================================= */
  ngOnInit() {
    this.initForm();
    this.fetchBanks();
    this.loadCountries();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* =========================================================================
   * 4. FORM INITIALIZATION
   * ========================================================================= */
  private initForm() {
    this.onboardForm = this.fb.group({
      identity: this.fb.group({
        name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        ifscPrefix: ['', [Validators.required, Validators.pattern(AppValidators.IFSC_PREFIX_REGEX)]],
        taxIdentifier: ['', [Validators.required, Validators.pattern(AppValidators.TAX_ID_REGEX)]],
        registrationNumber: ['', [Validators.required, Validators.pattern(AppValidators.CIN_REGEX)]],
        category: ['Private Sector', Validators.required],
        website: ['', [Validators.pattern(AppValidators.URL_REGEX)]]
      }),
      contact: this.fb.group({
        hqEmail:      ['', [Validators.required, Validators.pattern(AppValidators.EMAIL_REGEX)]],
        phoneCode:    ['+91', Validators.required],
        hqPhone:      ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
        addressLine1: ['', [Validators.required, Validators.maxLength(150)]],
        addressLine2: ['', Validators.maxLength(150)],
        countryCode:  ['', Validators.required],             // 2-char ISO code e.g. IN
        stateId:      [{ value: '', disabled: true }, Validators.required],
        city:         [{ value: '', disabled: true }, Validators.required],
        village:      [{ value: '', disabled: true }],
        postalCode:   ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],
      }),
      plan: this.fb.group({
        planCode: ['SILVER', Validators.required]
      })
    });
  }

  /* =========================================================================
   * 5. GEOGRAPHY CASCADE  (Country → State → City → Village)
   * ========================================================================= */
  private loadCountries() {
    this.isLoadingCountries = true;
    this.geoService.getCountries(true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCountries = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (c) => { this.countries = c; this.cdr.markForCheck(); } });
  }

  public onCountryChange(countryCode: string) {
    const stateCtrl   = this.onboardForm.get('contact.stateId');
    const cityCtrl    = this.onboardForm.get('contact.city');
    const villageCtrl = this.onboardForm.get('contact.village');

    this.states = []; this.filteredCities = []; this.filteredVillages = [];
    stateCtrl?.setValue('');   stateCtrl?.disable();
    cityCtrl?.setValue('');    cityCtrl?.disable();
    villageCtrl?.setValue(''); villageCtrl?.disable();

    if (!countryCode) return;
    this.isLoadingStates = true;
    this.geoService.getStates(countryCode, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (s) => { this.states = s; if (s.length) stateCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  public onStateChange(stateId: string) {
    const cityCtrl    = this.onboardForm.get('contact.city');
    const villageCtrl = this.onboardForm.get('contact.village');

    this.filteredCities = []; this.filteredVillages = [];
    cityCtrl?.setValue('');    cityCtrl?.disable();
    villageCtrl?.setValue(''); villageCtrl?.disable();

    if (!stateId) return;
    this.isLoadingCities = true;
    this.geoService.getTowns(stateId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCities = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (t) => { this.filteredCities = t; if (t.length) cityCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  public onCityChange(townId: string) {
    const villageCtrl = this.onboardForm.get('contact.village');

    this.filteredVillages = [];
    villageCtrl?.setValue(''); villageCtrl?.disable();

    if (!townId) return;
    this.isLoadingVillages = true;
    this.geoService.getVillages(townId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.markForCheck(); }))
      .subscribe({ next: (v) => { this.filteredVillages = v; if (v.length) villageCtrl?.enable(); this.cdr.markForCheck(); } });
  }

  public navigateToBank(bankId: string) {
    if (!bankId) return;
    this.router.navigate(['/banks', bankId]);
  }

  /* =========================================================================
   * 6. DATA FETCHING
   * ========================================================================= */
  public fetchBanks(isLoadMore = false) {
    if ((isLoadMore && this.isLoadingMore) || (!isLoadMore && this.isLoading)) return;

    if (!isLoadMore) {
      this.offset = 0;
      this.banks = [];
      this.hasMoreBanks = true;
      this.isLoading = true;
    } else {
      this.isLoadingMore = true;
    }

    // 🚀 Ensure this matches your interceptor or exact backend route (e.g., /api/v1/banks)
    this.http.get<any>(`/banks?limit=${this.limit}&offset=${this.offset}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.isLoadingMore = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          const newBanks = response.data || [];
          this.banks = [...this.banks, ...newBanks];
          this.offset += this.limit; 
          if (newBanks.length < this.limit) this.hasMoreBanks = false;
        },
        error: () => {
          this.hasMoreBanks = false;
          this.showToast('error', 'COMMON.ERROR', 'BANKS.VALIDATION.FETCH_FAILED');
        }
      });
  }

  public loadMoreBanks() {
    this.fetchBanks(true);
  }

  /* =========================================================================
   * 7. WIZARD NAVIGATION & SUBMISSION
   * ========================================================================= */
  public selectPlan(planCode: string) {
    this.onboardForm.get('plan.planCode')?.setValue(planCode);
  }

  public nextStep() {
    const currentGroupName = this.stepGroups[this.currentStepIndex];
    const currentGroup = this.onboardForm.get(currentGroupName) as FormGroup;

    // Safety check: Only validate if the group actually exists (Step 3/Review has no group)
    if (currentGroup && currentGroup.invalid) {
      currentGroup.markAllAsTouched();
      this.showToast('warn', 'BANKS.VALIDATION.ERROR_TITLE', 'BANKS.VALIDATION.ERROR_DETAIL');
      return;
    }

    if (this.currentStepIndex < 3) this.currentStepIndex++;
  }

  public prevStep() {
    if (this.currentStepIndex > 0) this.currentStepIndex--;
  }

  public submitBank() {
    if (this.onboardForm.invalid) {
      this.onboardForm.markAllAsTouched();
      this.showToast('warn', 'BANKS.VALIDATION.ERROR_TITLE', 'BANKS.VALIDATION.ERROR_DETAIL');
      return;
    }
    this.isSubmitting = true;
    const formVals = this.onboardForm.getRawValue();

    // Resolve human-readable names from UUID/code references
    const selectedCountry = this.countries.find(c => c.code === formVals.contact.countryCode);
    const selectedState   = this.states.find(s => s.id === formVals.contact.stateId);
    const selectedCity    = this.filteredCities.find(t => t.id === formVals.contact.city);

    const payload = {
      name:               formVals.identity.name.trim(),
      ifscPrefix:         formVals.identity.ifscPrefix.toUpperCase(),
      taxIdentifier:      formVals.identity.taxIdentifier.toUpperCase(),
      registrationNumber: formVals.identity.registrationNumber.toUpperCase(),
      website:            formVals.identity.website?.trim() || null,
      logoUrl:            null,
      addressLine1:       formVals.contact.addressLine1.trim(),
      addressLine2:       formVals.contact.addressLine2?.trim() || null,
      country:            selectedCountry?.name ?? formVals.contact.countryCode,
      state:              selectedState?.name   ?? '',
      city:               selectedCity?.name    ?? formVals.contact.city,
      village:            this.filteredVillages.find(v => v.id === formVals.contact.village)?.name ?? null,
      postalCode:         formVals.contact.postalCode.trim(),
      hqEmail:            formVals.contact.hqEmail.trim(),
      hqPhone:            `${formVals.contact.phoneCode}${formVals.contact.hqPhone.trim()}`,
      metadata:           { category: formVals.identity.category },
      subscriptionPlan:   formVals.plan.planCode
    };

    this.http.post('/banks/onboard', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.markForCheck();
        }),
        catchError((error) => {
          let backendMsg = error.error?.message;
          backendMsg = Array.isArray(backendMsg) ? backendMsg[0] : backendMsg;
          this.showDirectToast('error', 'BANKS.VALIDATION.ERROR_TITLE', backendMsg || 'Registration failed');
          return EMPTY; 
        })
      )
      .subscribe({
        next: (res: any) => {
          this.showDirectToast('success', 'COMMON.SUCCESS', res.message || 'Bank onboarded successfully.');
          
          // 🚀 THE FIX: Clear UI state properly
          this.showOnboardModal = false;
          this.currentStepIndex = 0;
          this.filteredCities = []; // Prevent state leak!
          
          this.onboardForm.reset({
            plan:     { planCode: 'SILVER' },
            identity: { category: 'Private Sector' },
            contact:  { phoneCode: '+91' }
          });
          this.states = []; this.filteredCities = []; this.filteredVillages = [];
          this.onboardForm.get('contact.stateId')?.disable();
          this.onboardForm.get('contact.city')?.disable();
          this.onboardForm.get('contact.village')?.disable(); 
          
          this.fetchBanks(false); 
        }
      });
  }

  /* =========================================================================
   * 8. UI HELPERS & ACTIONS
   * ========================================================================= */
  public isFieldInvalid(groupName: string, fieldName: string): boolean {
    const group = this.onboardForm.get(groupName) as FormGroup;
    const control = group?.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  private showToast(severity: string, summaryKey: string, detailKey: string): void {
    this.messageService.add({
      severity,
      summary: this.translate.instant(summaryKey),
      detail: this.translate.instant(detailKey),
    });
  }

  private showDirectToast(severity: string, summaryKey: string, directDetail: string): void {
    this.messageService.add({
      severity,
      summary: this.translate.instant(summaryKey),
      detail: directDetail,
    });
  }

public toggleBankStatus(bank: any) {
    if (bank.isUpdatingStatus) return;

    // 1. Determine the new status
    const newStatus = !bank.isActive;
    
    // 2. 🚀 THE FIX: Optimistically update the UI instantly so the switch animates
    bank.isActive = newStatus;
    
    // 3. Trigger the loading spinner inside the knob
    bank.isUpdatingStatus = true;
    this.cdr.detectChanges(); 

    // 4. API Call
    this.http.patch(`/banks/${bank.id}/status`, { isActive: newStatus })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { 
          bank.isUpdatingStatus = false; 
          this.cdr.detectChanges(); 
        })
      )
      .subscribe({
        next: (res: any) => {
          this.showDirectToast('success', 'COMMON.SUCCESS', res.message || `${bank.name} has been ${newStatus ? 'activated' : 'suspended'}.`);
        },
        error: (err) => {
          // 🚨 Revert the UI switch if the backend rejects the change!
          bank.isActive = !newStatus; 
          this.showDirectToast('error', 'COMMON.ERROR', err.error?.message || 'Failed to update tenant status.');
        }
      });
  }
}