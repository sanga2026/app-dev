import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Input, Output, EventEmitter, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, switchMap, of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import { AppValidators } from '../../../../core/utils/validators.util';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant';
import { GeographyService } from '../../../../shared/services/geography.service';
import { MasterDataService } from '../../../../shared/services/master-data.service';
import { Country, State, Town, Village } from '../../../../shared/models/geography.model';

import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-customer-onboard-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    DialogModule, InputSwitchModule, HasPermissionDirective,
  ],
  templateUrl: './customer-onboard-modal.component.html',
})
export class CustomerOnboardModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible = false;
  @Input() bankId!: string;
  @Input() branchId!: string;

  @Output() visibleChange    = new EventEmitter<boolean>();
  @Output() onCustomerCreated = new EventEmitter<any>();

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private msg  = inject(MessageService);
  private cdr  = inject(ChangeDetectorRef);
  private geoSvc  = inject(GeographyService);
  private masterSvc = inject(MasterDataService);
  private destroy$ = new Subject<void>();

  // ── Wizard ──────────────────────────────────────────────────────────────
  currentStep = 0;
  readonly steps = [
    { label: 'Personal Details',   icon: 'pi-user'       },
    { label: 'Contact & Address',  icon: 'pi-map-marker' },
    { label: 'Identity & KYC',     icon: 'pi-id-card'    },
  ];

  public customerForm!: FormGroup;
  public isSubmitting = false;

  // ── Static dropdowns ──────────────────────────────────────────────────────
  public titles         = DROPDOWN_OPTIONS.TITLES;
  public genders        = DROPDOWN_OPTIONS.GENDERS;
  public maritalStatuses= DROPDOWN_OPTIONS.MARITAL_STATUSES;
  public categories     = DROPDOWN_OPTIONS.CUSTOMER_CATEGORIES;
  public countryCodes   = DROPDOWN_OPTIONS.COUNTRY_CODES;

  // ── Dynamic from API ─────────────────────────────────────────────────────
  public documentTypes: any[] = [];
  public isLoadingDocs = false;

  // Geography — full cascade
  public countries:  Country[] = [];
  public states:     State[]   = [];
  public towns:      Town[]    = [];
  public villages:   Village[] = [];
  public isLoadingCountries = false;
  public isLoadingStates    = false;
  public isLoadingTowns     = false;
  public isLoadingVillages  = false;

  ngOnInit() {
    this.initForm();
    this.loadCountries();
    this.loadDocumentTypes();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.currentStep = 0;
      if (this.customerForm) this.resetForm();
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Init ─────────────────────────────────────────────────────────────────

  private initForm() {
    this.customerForm = this.fb.group({
      // Step 1 — Personal
      title:            ['', Validators.required],
      firstName:        ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX), Validators.maxLength(50)]],
      middleName:       [''],
      lastName:         ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX), Validators.maxLength(50)]],
      guardianName:     ['', Validators.maxLength(100)],
      dateOfBirth:      ['', Validators.required],
      gender:           ['', Validators.required],
      maritalStatus:    ['', Validators.required],
      marriageDate:     [''],
      customerCategory: ['PUBLIC', Validators.required],

      // Step 2 — Contact & Address
      phoneCode:            ['+91', Validators.required],
      phoneNumber:          ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      alternatePhoneNumber: [''],
      email:                ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      addressLine1:         ['', [Validators.required, Validators.maxLength(255)]],
      addressLine2:         ['', Validators.maxLength(255)],
      countryCode:          ['', Validators.required],
      stateId:              [{ value: '', disabled: true }, Validators.required],
      townId:               [{ value: '', disabled: true }, Validators.required],
      villageId:            [{ value: '', disabled: true }, Validators.required],
      pinCode:              ['', [Validators.required, Validators.maxLength(10)]],

      // Step 3 — KYC
      governmentIdType: ['', Validators.required],
      governmentId:     ['', [Validators.required, Validators.maxLength(50)]],
      cKycNumber:       ['', Validators.maxLength(50)],
      eKycNumber:       ['', Validators.maxLength(50)],
      gstin:            ['', Validators.maxLength(15)],
    });
  }

  private resetForm() {
    this.customerForm.reset({ customerCategory: 'PUBLIC', phoneCode: '+91' });
    ['stateId','townId','villageId'].forEach(f => {
      this.customerForm.get(f)?.disable();
      this.customerForm.get(f)?.setValue('');
    });
    this.states = []; this.towns = []; this.villages = [];
    this.currentStep = 0;
  }

  // ── Wizard navigation ─────────────────────────────────────────────────────

  get stepFields(): string[][] {
    return [
      ['title','firstName','lastName','dateOfBirth','gender','maritalStatus','customerCategory'],
      ['phoneNumber','addressLine1','countryCode','stateId','townId','villageId','pinCode'],
      ['governmentIdType','governmentId'],
    ];
  }

  nextStep() {
    const fields = this.stepFields[this.currentStep];
    let invalid = false;
    fields.forEach(f => {
      const ctrl = this.customerForm.get(f);
      ctrl?.markAsTouched();
      if (ctrl?.invalid) invalid = true;
    });
    if (invalid) { this.cdr.detectChanges(); return; }
    if (this.currentStep < 2) { this.currentStep++; this.cdr.detectChanges(); }
  }

  prevStep() {
    if (this.currentStep > 0) { this.currentStep--; this.cdr.detectChanges(); }
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  private loadCountries() {
    this.isLoadingCountries = true;
    this.geoSvc.getCountries(true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCountries = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (c) => { this.countries = c; this.cdr.detectChanges(); } });
  }

  private loadDocumentTypes() {
    this.isLoadingDocs = true;
    this.masterSvc.getDocumentTypes(true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingDocs = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (docs: any[]) => { this.documentTypes = docs; this.cdr.detectChanges(); } });
  }

  // ── Geography cascade ─────────────────────────────────────────────────────

  public onCountryChange(code: string) {
    const s = this.customerForm.get('stateId');
    const t = this.customerForm.get('townId');
    const v = this.customerForm.get('villageId');
    this.states = []; this.towns = []; this.villages = [];
    s?.setValue(''); s?.disable();
    t?.setValue(''); t?.disable();
    v?.setValue(''); v?.disable();
    if (!code) return;
    this.isLoadingStates = true;
    this.geoSvc.getStates(code, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (st) => { this.states = st; if (st.length) s?.enable(); this.cdr.detectChanges(); } });
  }

  public onStateChange(stateId: string) {
    const t = this.customerForm.get('townId');
    const v = this.customerForm.get('villageId');
    this.towns = []; this.villages = [];
    t?.setValue(''); t?.disable();
    v?.setValue(''); v?.disable();
    if (!stateId) return;
    this.isLoadingTowns = true;
    this.geoSvc.getTowns(stateId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingTowns = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (tw) => { this.towns = tw; if (tw.length) t?.enable(); this.cdr.detectChanges(); } });
  }

  public onTownChange(townId: string) {
    const v = this.customerForm.get('villageId');
    this.villages = [];
    v?.setValue(''); v?.disable();
    if (!townId) return;
    this.isLoadingVillages = true;
    this.geoSvc.getVillages(townId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (vl) => { this.villages = vl; if (vl.length) v?.enable(); this.cdr.detectChanges(); } });
  }

  // ── Document type → apply regex validation dynamically ──────────────────

  public onDocumentTypeChange(docTypeId: string) {
    const doc = this.documentTypes.find(d => d.id === docTypeId);
    const ctrl = this.customerForm.get('governmentId');
    if (doc?.validationRegex) {
      ctrl?.setValidators([Validators.required, Validators.maxLength(50), Validators.pattern(doc.validationRegex)]);
      // Show placeholder from DB
      this.selectedDocPlaceholder = doc.placeholder ?? '';
    } else {
      ctrl?.setValidators([Validators.required, Validators.maxLength(50)]);
      this.selectedDocPlaceholder = '';
    }
    ctrl?.setValue('');
    ctrl?.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  public selectedDocPlaceholder = '';

  // ── Submit ────────────────────────────────────────────────────────────────

  public submitCustomer() {
    this.customerForm.markAllAsTouched();
    if (this.customerForm.invalid) {
      this.msg.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please fix all highlighted fields.' });
      return;
    }

    this.isSubmitting = true;

    // Step 1: Try to get a customer number from the bank's number range
    this.masterSvc.getNextNumber(this.bankId, 'CUSTOMER')
      .pipe(
        takeUntil(this.destroy$),
        // If number range fails, continue without it (API will handle or generate)
        switchMap(customerNumber => of(customerNumber)),
      )
      .subscribe({
        next: (customerNumber) => this._doCreate(customerNumber || null),
        error: () => this._doCreate(null), // No range configured — proceed anyway
      });
  }

  private _doCreate(customerNumber: string | null) {
    const val = this.customerForm.getRawValue();

    const selectedCountry = this.countries.find(c => c.code === val.countryCode);
    const selectedState   = this.states.find(s => s.id === val.stateId);
    const selectedTown    = this.towns.find(t => t.id === val.townId);
    const selectedVillage = this.villages.find(v => v.id === val.villageId);

    const payload: any = {
      title:            val.title,
      firstName:        val.firstName.trim(),
      middleName:       val.middleName?.trim() || null,
      lastName:         val.lastName.trim(),
      guardianName:     val.guardianName?.trim() || null,
      dateOfBirth:      val.dateOfBirth,
      gender:           val.gender,
      maritalStatus:    val.maritalStatus,
      marriageDate:     val.marriageDate || null,
      customerCategory: val.customerCategory,
      phoneNumber:      `${val.phoneCode}${val.phoneNumber.trim()}`,
      alternatePhoneNumber: val.alternatePhoneNumber?.trim() || null,
      email:            val.email?.trim() || null,
      addressLine1:     val.addressLine1.trim(),
      addressLine2:     val.addressLine2?.trim() || null,
      country:          selectedCountry?.name ?? val.countryCode,
      state:            selectedState?.name   ?? '',
      city:             selectedTown?.name    ?? '',
      village:          selectedVillage?.name ?? null,
      pinCode:          val.pinCode.trim(),
      governmentIdType: val.governmentIdType,
      governmentId:     val.governmentId?.toUpperCase().trim(),
      cKycNumber:       val.cKycNumber?.trim() || null,
      eKycNumber:       val.eKycNumber?.trim() || null,
      gstin:            val.gstin?.toUpperCase().trim() || null,
      bankId:           this.bankId,
      branchId:         this.branchId,
    };

    // Attach pre-generated customer number if available
    if (customerNumber) {
      payload.customerNumber = customerNumber;
    }

    this.http.post(`/banks/${this.bankId}/branches/${this.branchId}/customers`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.msg.add({ severity: 'success', summary: 'Customer Onboarded',
            detail: `Customer${customerNumber ? ' #' + customerNumber : ''} created successfully.` });
          this.onCustomerCreated.emit(res.data || res);
          this.closeModal();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Failed to onboard customer.' });
        },
      });
  }

  public closeModal() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetForm();
  }

  public isInvalid(field: string): boolean {
    const ctrl = this.customerForm.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public errorMsg(field: string): string {
    const ctrl = this.customerForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'This field is required.';
    if (ctrl.errors['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} characters.`;
    if (ctrl.errors['pattern']) {
      if (field === 'phoneNumber') return 'Enter a valid 10-digit mobile number.';
      if (field === 'email')       return 'Enter a valid email address.';
      if (field.includes('Name'))  return 'Letters only, 2–50 characters.';
      return 'Invalid format.';
    }
    return 'Invalid.';
  }
}
