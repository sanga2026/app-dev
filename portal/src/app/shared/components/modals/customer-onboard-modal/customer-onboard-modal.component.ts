import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Shared Utils
import { AppValidators } from '../../../../core/utils/validators.util';
import { ButtonComponent } from '../button/button.component';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant';

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-customer-onboard-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, ButtonComponent, TranslateModule,HasPermissionDirective],
  templateUrl: './customer-onboard-modal.component.html'
})
export class CustomerOnboardModalComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Input() bankId!: string;
  @Input() branchId!: string;
  
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onCustomerCreated = new EventEmitter<any>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  public customerForm!: FormGroup;
  public isSubmitting = false;

  // Dropdown Reference Data
  public titles = DROPDOWN_OPTIONS.TITLES;
  public idTypes = DROPDOWN_OPTIONS.ID_TYPES;
  public categories = DROPDOWN_OPTIONS.CUSTOMER_CATEGORIES;
  public genders = DROPDOWN_OPTIONS.GENDERS;
  public maritalStatuses = DROPDOWN_OPTIONS.MARITAL_STATUSES;
  
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;
  public states = DROPDOWN_OPTIONS.INDIAN_STATES;

  public availableCities: string[] = [];
  public filteredVillages: string[] = [];

  // Local fallback maps in case i18n is not ready
  private citiesMap: { [key: string]: string[] } = {
    'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    'Delhi': ['New Delhi']
  };

  private villagesMap: { [key: string]: string[] } = {
    'Bengaluru': ['Whitefield', 'Koramangala', 'Indiranagar', 'Jayanagar'],
    'Mysuru': ['Gokulam', 'Hebbal', 'Vijayanagar'],
    'Mumbai': ['Bandra', 'Andheri', 'Borivali']
  };

  ngOnInit() {
    this.initForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.customerForm = this.fb.group({
      governmentIdType: ['', Validators.required],
      governmentId: ['', Validators.required],
      cKycNumber: [''],
      eKycNumber: [''],
      gstin: [''],
      title: ['', Validators.required],
      firstName: ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      guardianName: [''],
      dateOfBirth: ['', Validators.required],
      gender: ['MALE', Validators.required],
      maritalStatus: ['SINGLE', Validators.required],
      marriageDate: [''],
      customerCategory: ['PUBLIC', Validators.required],
      
      phoneCode: ['+91', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      alternatePhoneNumber: [''],
      email: ['', [Validators.email]],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      state: ['', Validators.required],
      city: [{ value: '', disabled: true }, Validators.required],
      village: [{ value: '', disabled: true }],
      pinCode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]]
    });
  }

// 🚀 Bulletproof State -> City Cascade
  public onStateChange(event: Event) {
    const selectedStateCode = (event.target as HTMLSelectElement).value; // e.g., 'KA'
    
    // Fetch cities map from i18n
    let allCities: any = this.translate.instant('DROPDOWN_VALUES.CITIES');
    if (typeof allCities === 'string') allCities = {}; 

    // 🚀 FIXED: Look up using the State Code ('KA'), not the name!
    this.availableCities = allCities[selectedStateCode] || [];
    
    // Enable & reset City
    this.customerForm.get('city')?.enable();
    this.customerForm.get('city')?.setValue('');
    
    // Disable & reset Village
    this.filteredVillages = [];
    this.customerForm.get('village')?.disable();
    this.customerForm.get('village')?.setValue('');
  }
  
  // 🚀 Bulletproof City -> Village Cascade
  public onCityChange(event: Event) {
    const selectedCity = (event.target as HTMLSelectElement).value; // e.g., 'Bengaluru'
    const villageControl = this.customerForm.get('village');
    
    if (selectedCity) {
      // Fetch villages map from i18n
      let allVillages: any = this.translate.instant('DROPDOWN_VALUES.VILLAGES');
      if (typeof allVillages === 'string') allVillages = {};

      // Look up using City Name
      this.filteredVillages = allVillages[selectedCity] || [];
      
      if (this.filteredVillages.length > 0) {
        villageControl?.enable();
      } else {
        villageControl?.disable();
      }
    } else {
      this.filteredVillages = [];
      villageControl?.disable();
    }
    villageControl?.setValue('');
  }
  
  public close() {
    this.customerForm.reset({ 
      gender: 'MALE', 
      maritalStatus: 'SINGLE', 
      customerCategory: 'PUBLIC',
      governmentIdType: '', 
      title: '', 
      phoneCode: '+91',
      state: '', 
      city: '',
      village: ''
    });
    this.availableCities = [];
    this.filteredVillages = [];
    this.customerForm.get('city')?.disable();
    this.customerForm.get('village')?.disable();
    this.visibleChange.emit(false);
  }

  public submitCustomer() {
    if (this.customerForm.invalid) { 
      this.customerForm.markAllAsTouched(); 
      this.messageService.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please fill in all required fields correctly.' });
      return; 
    }
    
    this.isSubmitting = true;
    const val = this.customerForm.getRawValue();

    Object.keys(val).forEach(key => { if (val[key] === '') val[key] = null; });
    val.phoneNumber = `${val.phoneCode}${val.phoneNumber.trim()}`;
    delete val.phoneCode;

    this.http.post(`/banks/${this.bankId}/branches/${this.branchId}/customers`, val)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Customer onboarded successfully.' });
          this.onCustomerCreated.emit(res.data || res);
          this.close();
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to onboard customer.' })
      });
  }

  public isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const control = form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}