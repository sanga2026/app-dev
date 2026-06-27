import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

// Shared Utils
import { AppValidators } from '../../../../core/utils/validators.util';
import { ButtonComponent } from '../button/button.component';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant';

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-branch-onboard-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DialogModule, InputSwitchModule, ButtonComponent,HasPermissionDirective],
  templateUrl: './branch-onboard-modal.component.html'
})
export class BranchOnboardModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible: boolean = false;
  @Input() bankId!: string;
  
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onBranchCreated = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public branchForm!: FormGroup;
  public isSubmitting = false;

  // 🌍 Dropdown Reference Data from Constants
  public branchTypes = DROPDOWN_OPTIONS.BRANCH_TYPES;
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;
  public branchStates = DROPDOWN_OPTIONS.INDIAN_STATES;
  public tiers = DROPDOWN_OPTIONS.TIERS;
  
  public filteredBranchCities: string[] = [];
  public filteredBranchVillages: string[] = [];

  ngOnInit() {
    this.initForm();
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue === true && this.branchForm) {
      this.resetForm();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.branchForm = this.fb.group({
      identity: this.fb.group({
        name: ['', [Validators.required, Validators.maxLength(100)]],
        branchType: ['RETAIL_BRANCH', Validators.required],
        openingDate: ['', Validators.required],
        // 🚀 REMOVED branchCode from here
        ifsc: ['', [Validators.required, Validators.pattern(AppValidators.FULL_IFSC_REGEX)]],
        micrCode: ['', [Validators.pattern(/^[0-9]{9}$/)]], 
        swiftCode: ['', [Validators.pattern(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/)]],
        tier: ['URBAN', Validators.required],
      }),
      location: this.fb.group({
        email: ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
        phoneCode: ['+91', Validators.required],
        phone: ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
        addressLine1: ['', Validators.required],
        addressLine2: [''],
        state: ['', Validators.required],
        city: [{ value: '', disabled: true }, Validators.required],
        village: [{ value: '', disabled: true }], 
        postalCode: ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],
      }),
      operations: this.fb.group({
        managerName: ['', [Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
        gstin: [''], 
        cashRetentionLimit: [null, [Validators.min(0)]],
        openingTime: ['09:00', [Validators.required, Validators.pattern(AppValidators.TIME_REGEX)]],
        closingTime: ['17:00', [Validators.required, Validators.pattern(AppValidators.TIME_REGEX)]],
        isAtmAvailable: [false],
      }),
    });
  }

  private resetForm() {
    this.branchForm.reset({
      identity: { tier: 'URBAN', branchType: 'RETAIL_BRANCH' },
      location: { phoneCode: '+91', village: '' },
      operations: { openingTime: '09:00', closingTime: '17:00', isAtmAvailable: false },
    });
    this.branchForm.get('location.city')?.disable();
    this.branchForm.get('location.village')?.disable();
    this.filteredBranchCities = [];
    this.filteredBranchVillages = [];
  }

  public onBranchStateChange(event: Event) {
    const stateCode = (event.target as HTMLSelectElement).value;
    const cityControl = this.branchForm.get('location.city');
    const villageControl = this.branchForm.get('location.village');
    
    if (stateCode) {
      const allCities: any = this.translate.instant('DROPDOWN_VALUES.CITIES');
      this.filteredBranchCities = allCities[stateCode] || [];
      cityControl?.enable();
    } else {
      this.filteredBranchCities = [];
      cityControl?.disable();
    }
    cityControl?.setValue('');
    
    this.filteredBranchVillages = [];
    villageControl?.disable();
    villageControl?.setValue('');
  }

  public onBranchCityChange(event: Event) {
    const cityCode = (event.target as HTMLSelectElement).value;
    const villageControl = this.branchForm.get('location.village');
    
    if (cityCode) {
      const allVillages: any = this.translate.instant('DROPDOWN_VALUES.VILLAGES');
      this.filteredBranchVillages = allVillages[cityCode] || [];
      
      if (this.filteredBranchVillages.length > 0) {
        villageControl?.enable();
      } else {
        villageControl?.disable();
      }
    } else {
      this.filteredBranchVillages = [];
      villageControl?.disable();
    }
    villageControl?.setValue('');
  }

  public submitBranch() {
    if (this.branchForm.invalid) {
      this.branchForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Validation Error', detail: 'Please fill out all required fields.'});
      return;
    }

    this.isSubmitting = true;
    const vals = this.branchForm.getRawValue();

    const payload = {
      name: vals.identity.name.trim(),
      branchType: vals.identity.branchType,
      openingDate: vals.identity.openingDate,
      // 🚀 REMOVED branchCode from payload
      ifsc: vals.identity.ifsc.toUpperCase().trim(),
      micrCode: vals.identity.micrCode?.toUpperCase().trim() || null,
      swiftCode: vals.identity.swiftCode?.toUpperCase().trim() || null,
      
      addressLine1: vals.location.addressLine1.trim(),
      addressLine2: vals.location.addressLine2?.trim() || null,
      state: this.translate.instant(this.branchStates.find((s) => s.code === vals.location.state)?.name || vals.location.state),
      city: vals.location.city.trim(),
      village: vals.location.village?.trim() || null,
      postalCode: vals.location.postalCode.trim(),
      phone: `${vals.location.phoneCode}${vals.location.phone.trim()}`,
      email: vals.location.email?.trim() || null,
      
      metadata: {
        tier: vals.identity.tier,
        managerName: vals.operations.managerName?.trim() || null,
        gstin: vals.operations.gstin?.toUpperCase().trim() || null,
        cashRetentionLimit: vals.operations.cashRetentionLimit || null,
        openingTime: vals.operations.openingTime,
        closingTime: vals.operations.closingTime,
        isAtmAvailable: vals.operations.isAtmAvailable,
      },
    };

    this.http.post(`/banks/${this.bankId}/branches`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Branch has been created successfully.' });
          this.onBranchCreated.emit(res.data || res); 
          this.closeModal(); 
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public closeModal() {
    this.visible = false;
    this.visibleChange.emit(this.visible);
  }

  public isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const control = form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}