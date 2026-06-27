// src/app/features/super-admin/banks/banks.component.ts

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms'; // 🚀 Added FormsModule
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router'; 
import { MessageService } from 'primeng/api';
import { Subject, EMPTY } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// 🚀 Core Validators
import { AppValidators } from '../../../core/utils/validators.util';

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
  providers: [MessageService],
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

  public countryCodes = [
    { label: 'IN (+91)', value: '+91' },
    { label: 'US (+1)', value: '+1' },
    { label: 'UK (+44)', value: '+44' },
    { label: 'UAE (+971)', value: '+971' }
  ];

  public states = [
    { code: 'KA', name: 'BANKS.STATES.KA' },
    { code: 'MH', name: 'BANKS.STATES.MH' },
    { code: 'DL', name: 'BANKS.STATES.DL' },
    { code: 'TN', name: 'BANKS.STATES.TN' },
    { code: 'TS', name: 'BANKS.STATES.TS' }
  ];

  public filteredCities: string[] = [];

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
        hqEmail: ['', [Validators.required, Validators.pattern(AppValidators.EMAIL_REGEX)]],
        phoneCode: ['+91', Validators.required], 
        hqPhone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]], 
        addressLine1: ['', [Validators.required, Validators.maxLength(150)]],
        state: ['', Validators.required], 
        city: [{ value: '', disabled: true }, Validators.required], 
        postalCode: ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],
        country: [{ value: 'India', disabled: true }, Validators.required] 
      }),
      plan: this.fb.group({
        planCode: ['SILVER', Validators.required]
      })
    });
  }

  /* =========================================================================
   * 5. LOGIC FOR DROPDOWNS & NAVIGATION
   * ========================================================================= */
  public onStateChange(stateCode: string) {
    const cityControl = this.onboardForm.get('contact.city');
    if (stateCode) {
      const allCities: any = this.translate.instant('BANKS.CITIES');
      this.filteredCities = allCities[stateCode] || [];
      cityControl?.enable();
    } else {
      this.filteredCities = [];
      cityControl?.disable();
    }
    cityControl?.setValue('');
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

    const payload = {
      name: formVals.identity.name.trim(),
      ifscPrefix: formVals.identity.ifscPrefix.toUpperCase(),
      taxIdentifier: formVals.identity.taxIdentifier.toUpperCase(),
      registrationNumber: formVals.identity.registrationNumber.toUpperCase(),
      logoUrl: null, 
      addressLine1: formVals.contact.addressLine1.trim(),
      city: formVals.contact.city,
      state: this.translate.instant(this.states.find(s => s.code === formVals.contact.state)?.name || ''),
      postalCode: formVals.contact.postalCode.trim(),
      country: formVals.contact.country,
      hqEmail: formVals.contact.hqEmail.trim(),
      hqPhone: `${formVals.contact.phoneCode}${formVals.contact.hqPhone.trim()}`, 
      metadata: {
        category: formVals.identity.category,
        website: formVals.identity.website?.trim() || null
      },
      subscriptionPlan: formVals.plan.planCode
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
            plan: { planCode: 'SILVER' }, 
            identity: { category: 'Private Sector' }, 
            contact: { country: 'India', phoneCode: '+91' } 
          });
          
          // Force city back to disabled state
          this.onboardForm.get('contact.city')?.disable(); 
          
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