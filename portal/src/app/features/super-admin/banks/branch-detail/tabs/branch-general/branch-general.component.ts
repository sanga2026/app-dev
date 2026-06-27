import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

// Shared Utils & Components
import { AppValidators } from '../../../../../../core/utils/validators.util';
import { DROPDOWN_OPTIONS } from '../../../../../../shared/constants/dropdown-options.constant';
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { ConfirmModalComponent } from '../../../../../../shared/components/modals/confirm-modal/confirm-modal.component';

// PrimeNG
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-branch-general',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    TranslateModule, 
    ConfirmModalComponent, 
    ButtonComponent, 
    InputSwitchModule, 
    ToastModule,
    HasPermissionDirective
  ],
  templateUrl: './branch-general.component.html'
})
export class BranchGeneralComponent implements OnInit, OnDestroy {
  @Input() branch: any;
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';
  @Output() refreshData = new EventEmitter<void>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  public isEditing = false;
  public isSaving = false;
  public isDeleting = false;
  public showDeleteModal = false;
  public editForm!: FormGroup;

  // 🌍 Centralized Dropdown Reference Data
  public branchTypes = DROPDOWN_OPTIONS.BRANCH_TYPES;
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;
  public branchStates = DROPDOWN_OPTIONS.INDIAN_STATES;
  public tiers = DROPDOWN_OPTIONS.TIERS;
  
  public filteredCities: string[] = [];
  public filteredVillages: string[] = [];

  ngOnInit() {
    this.initForm();
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
      email: ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      phoneCode: ['+91', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      state: ['', Validators.required],
      city: [{ value: '', disabled: true }, Validators.required],
      village: [{ value: '', disabled: true }],
      postalCode: ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],

      // 3. Operations & Limits
      managerName: ['', [Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      gstin: [''], 
      cashRetentionLimit: [null, [Validators.min(0)]],
      openingTime: ['', Validators.required],
      closingTime: ['', Validators.required],
      isAtmAvailable: [false]
    });
  }

  // 🚀 Cascading Dropdown: State -> City
  public onStateChange(event: Event) {
    const stateCode = (event.target as HTMLSelectElement).value;
    const cityControl = this.editForm.get('city');
    const villageControl = this.editForm.get('village');

    if (stateCode) {
      const allCities: any = this.translate.instant('DROPDOWN_VALUES.CITIES');
      this.filteredCities = allCities[stateCode] || [];
      cityControl?.enable();
    } else {
      this.filteredCities = [];
      cityControl?.disable();
    }
    cityControl?.setValue('');
    
    // Reset village cascade whenever state changes
    this.filteredVillages = [];
    villageControl?.disable();
    villageControl?.setValue('');
  }

  // 🚀 Cascading Dropdown: City -> Village
  public onCityChange(event: Event) {
    const cityCode = (event.target as HTMLSelectElement).value;
    const villageControl = this.editForm.get('village');
    
    if (cityCode) {
      const allVillages: any = this.translate.instant('DROPDOWN_VALUES.VILLAGES');
      this.filteredVillages = allVillages[cityCode] || [];
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

  public toggleEditMode() {
    // Extract Phone Code & Number
    let pCode = '+91'; 
    let pNumber = this.branch.phone || '';
    if (pNumber.startsWith('+')) { 
      pCode = pNumber.substring(0, 3); 
      pNumber = pNumber.substring(3); 
    }

    // Pre-populate Cities based on current state
    const stateObj = this.branchStates.find(s => this.translate.instant(s.name) === this.branch.state);
    if (stateObj) {
      const allCities: any = this.translate.instant('DROPDOWN_VALUES.CITIES');
      this.filteredCities = allCities[stateObj.code] || [];
      this.editForm.get('city')?.enable();
    }

    // Pre-populate Villages based on current city
    if (this.branch.city) {
      const allVillages: any = this.translate.instant('DROPDOWN_VALUES.VILLAGES');
      this.filteredVillages = allVillages[this.branch.city] || [];
      if (this.filteredVillages.length > 0) {
        this.editForm.get('village')?.enable();
      }
    }

    // Format Date for HTML Input
    let formattedDate = '';
    if (this.branch.openingDate) {
      formattedDate = new Date(this.branch.openingDate).toISOString().split('T')[0];
    }

    // Patch values to form
    this.editForm.patchValue({
      name: this.branch.name,
      branchType: this.branch.branchType || 'RETAIL_BRANCH',
      openingDate: formattedDate,
      micrCode: this.branch.micrCode || '',
      swiftCode: this.branch.swiftCode || '',
      tier: this.branch.metadata?.tier || 'URBAN',

      email: this.branch.email,
      phoneCode: pCode,
      phone: pNumber,
      addressLine1: this.branch.addressLine1,
      addressLine2: this.branch.addressLine2 || '',
      state: stateObj?.code || '',
      city: this.branch.city,
      village: this.branch.village || '',
      postalCode: this.branch.postalCode,

      managerName: this.branch.metadata?.managerName || '',
      gstin: this.branch.metadata?.gstin || '',
      cashRetentionLimit: this.branch.metadata?.cashRetentionLimit || null,
      openingTime: this.branch.metadata?.openingTime || '09:00',
      closingTime: this.branch.metadata?.closingTime || '17:00',
      isAtmAvailable: this.branch.metadata?.isAtmAvailable || false
    });
    
    this.isEditing = true;
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
      state: this.translate.instant(this.branchStates.find(s => s.code === vals.state)?.name || vals.state),
      city: vals.city.trim(),
      village: vals.village?.trim() || null,
      postalCode: vals.postalCode.trim(),
      
      metadata: {
        ...this.branch.metadata, // Prevent overwriting other metadata fields
        tier: vals.tier,
        managerName: vals.managerName?.trim() || null,
        gstin: vals.gstin?.toUpperCase().trim() || null,
        cashRetentionLimit: vals.cashRetentionLimit || null,
        openingTime: vals.openingTime,
        closingTime: vals.closingTime,
        isAtmAvailable: vals.isAtmAvailable
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