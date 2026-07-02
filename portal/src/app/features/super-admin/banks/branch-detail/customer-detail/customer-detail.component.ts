import {
  Component, OnInit, OnDestroy, inject,
  ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';

import { AppValidators } from '../../../../../core/utils/validators.util';
import { DROPDOWN_OPTIONS } from '../../../../../shared/constants/dropdown-options.constant';
import { GeographyService } from '../../../../../shared/services/geography.service';
import { MasterDataService } from '../../../../../shared/services/master-data.service';
import { Country, State, Town, Village } from '../../../../../shared/models/geography.model';

import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { CustomerAccountsComponent } from './customer-accounts.component';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, TranslateModule,
    DialogModule, InputSwitchModule, HasPermissionDirective,
    CustomerAccountsComponent,
  ],
  templateUrl: './customer-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class CustomerDetailComponent implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private http    = inject(HttpClient);
  private fb      = inject(FormBuilder);
  private msg     = inject(MessageService);
  private cdr     = inject(ChangeDetectorRef);
  private geoSvc  = inject(GeographyService);
  private masterSvc = inject(MasterDataService);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public branchId!: string;
  public customerId!: string;

  public branchName    = 'Branch';
  public customer: any = null;
  public isLoading     = true;
  public isUpdatingStatus = false;
  public isSaving      = false;
  public isDeleting    = false;
  public isEditing     = false;
  public showDeleteModal = false;
  public activeTab     = 'profile';

  public readonly customerTabs = [
    { id: 'profile',      label: 'Profile & KYC',    icon: 'pi-id-card'  },
    { id: 'accounts',     label: 'Accounts',          icon: 'pi-wallet'   },
    { id: 'loans',        label: 'Loan Facilities',   icon: 'pi-file'     },
    { id: 'transactions', label: 'Transactions',      icon: 'pi-list'     },
  ];

  // ── Static dropdowns ──────────────────────────────────────────────────────
  public titles          = DROPDOWN_OPTIONS.TITLES;
  public genders         = DROPDOWN_OPTIONS.GENDERS;
  public maritalStatuses = DROPDOWN_OPTIONS.MARITAL_STATUSES;
  public categories      = DROPDOWN_OPTIONS.CUSTOMER_CATEGORIES;
  public countryCodes    = DROPDOWN_OPTIONS.COUNTRY_CODES;

  // ── Dynamic from API ─────────────────────────────────────────────────────
  public documentTypes: any[]  = [];
  public countries:  Country[] = [];
  public states:     State[]   = [];
  public towns:      Town[]    = [];
  public villages:   Village[] = [];
  public isLoadingDocs     = false;
  public isLoadingCountries = false;
  public isLoadingStates    = false;
  public isLoadingTowns     = false;
  public isLoadingVillages  = false;

  public selectedDocPlaceholder = '';

  // ── Edit form ─────────────────────────────────────────────────────────────
  public editForm!: FormGroup;

  ngOnInit() {
    let params: any = { ...this.route.snapshot.params };
    let parent = this.route.parent;
    while (parent) { params = { ...params, ...parent.snapshot.params }; parent = parent.parent; }

    this.bankId     = params['bankId']     || '';
    this.branchId   = params['branchId']   || '';
    this.customerId = params['customerId'] || '';

    this.initForm();
    this.loadCountries();
    this.loadDocumentTypes();

    if (this.customerId) {
      this.fetchCustomerDetails();
      if (this.branchId) this.fetchBranchName();
    } else {
      this.isLoading = false;
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Init ─────────────────────────────────────────────────────────────────

  private initForm() {
    this.editForm = this.fb.group({
      title:            [''],
      firstName:        ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX), Validators.maxLength(50)]],
      middleName:       [''],
      lastName:         ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX), Validators.maxLength(50)]],
      guardianName:     ['', Validators.maxLength(100)],
      dateOfBirth:      ['', Validators.required],
      gender:           ['', Validators.required],
      maritalStatus:    [''],
      marriageDate:     [''],
      customerCategory: ['PUBLIC', Validators.required],
      phoneCode:        ['+91'],
      phoneNumber:      ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      alternatePhoneNumber: [''],
      email:            ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      addressLine1:     ['', Validators.required],
      addressLine2:     [''],
      countryCode:      ['', Validators.required],
      stateId:          [{ value: '', disabled: true }, Validators.required],
      townId:           [{ value: '', disabled: true }, Validators.required],
      villageId:        [{ value: '', disabled: true }, Validators.required],
      pinCode:          ['', Validators.required],
    });
  }

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
      .subscribe({ next: (docs) => { this.documentTypes = docs; this.cdr.detectChanges(); } });
  }

  // ── Data fetch ────────────────────────────────────────────────────────────

  public fetchCustomerDetails() {
    this.isLoading = true;
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => { this.customer = res.data || res; },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'Customer profile unavailable.' });
          this.router.navigate(['/banks', this.bankId, 'branches', this.branchId]);
        },
      });
  }

  public fetchBranchName() {
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (res) => { this.branchName = res.data?.name || res?.name || 'Branch'; this.cdr.detectChanges(); } });
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────

  public toggleEditMode() {
    this.isEditing = true;

    // Extract phone code
    let phone = this.customer.phoneNumber || '';
    let phoneCode = '+91';
    for (const code of ['+91', '+1', '+44', '+971', '+65', '+61']) {
      if (phone.startsWith(code)) { phoneCode = code; phone = phone.substring(code.length); break; }
    }

    // Find country by name
    const countryObj = this.countries.find(c => c.name === this.customer.country);
    const countryCode = countryObj?.code ?? 'IN';

    this.editForm.patchValue({
      title:            this.customer.title     || '',
      firstName:        this.customer.firstName || '',
      middleName:       this.customer.middleName || '',
      lastName:         this.customer.lastName  || '',
      guardianName:     this.customer.guardianName || '',
      dateOfBirth:      this.customer.dateOfBirth ? new Date(this.customer.dateOfBirth).toISOString().split('T')[0] : '',
      gender:           this.customer.gender    || '',
      maritalStatus:    this.customer.maritalStatus || '',
      marriageDate:     this.customer.marriageDate ? new Date(this.customer.marriageDate).toISOString().split('T')[0] : '',
      customerCategory: this.customer.customerCategory || 'PUBLIC',
      phoneCode,
      phoneNumber:      phone,
      alternatePhoneNumber: this.customer.alternatePhoneNumber || '',
      email:            this.customer.email     || '',
      addressLine1:     this.customer.addressLine1 || '',
      addressLine2:     this.customer.addressLine2 || '',
      countryCode,
      pinCode:          this.customer.pinCode   || '',
    });

    // Cascade load: country → states → towns → villages
    if (countryCode) {
      this.isLoadingStates = true;
      this.geoSvc.getStates(countryCode, true)
        .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.detectChanges(); }))
        .subscribe({ next: (states) => {
          this.states = states;
          const stateObj = states.find(s => s.name === this.customer.state);
          if (stateObj) {
            this.editForm.get('stateId')?.enable();
            this.editForm.patchValue({ stateId: stateObj.id });
            this.isLoadingTowns = true;
            this.geoSvc.getTowns(stateObj.id, true)
              .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingTowns = false; this.cdr.detectChanges(); }))
              .subscribe({ next: (towns) => {
                this.towns = towns;
                const townObj = towns.find(t => t.name === this.customer.city);
                if (townObj) {
                  this.editForm.get('townId')?.enable();
                  this.editForm.patchValue({ townId: townObj.id });
                  this.isLoadingVillages = true;
                  this.geoSvc.getVillages(townObj.id, true)
                    .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.detectChanges(); }))
                    .subscribe({ next: (villages) => {
                      this.villages = villages;
                      const v = villages.find(v => v.name === this.customer.village);
                      if (v) { this.editForm.get('villageId')?.enable(); this.editForm.patchValue({ villageId: v.id }); }
                      this.cdr.detectChanges();
                    }});
                }
                this.cdr.detectChanges();
              }});
          }
          this.cdr.detectChanges();
        }});
    }
  }

  public cancelEdit() {
    this.isEditing = false;
    ['stateId','townId','villageId'].forEach(f => { this.editForm.get(f)?.disable(); this.editForm.get(f)?.setValue(''); });
    this.states = []; this.towns = []; this.villages = [];
  }

  // ── Geography cascade in edit ─────────────────────────────────────────────

  public onCountryChange(code: string) {
    const s = this.editForm.get('stateId'); const t = this.editForm.get('townId'); const v = this.editForm.get('villageId');
    this.states = []; this.towns = []; this.villages = [];
    s?.setValue(''); s?.disable(); t?.setValue(''); t?.disable(); v?.setValue(''); v?.disable();
    if (!code) return;
    this.isLoadingStates = true;
    this.geoSvc.getStates(code, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (st) => { this.states = st; if (st.length) s?.enable(); this.cdr.detectChanges(); } });
  }

  public onStateChange(stateId: string) {
    const t = this.editForm.get('townId'); const v = this.editForm.get('villageId');
    this.towns = []; this.villages = [];
    t?.setValue(''); t?.disable(); v?.setValue(''); v?.disable();
    if (!stateId) return;
    this.isLoadingTowns = true;
    this.geoSvc.getTowns(stateId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingTowns = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (tw) => { this.towns = tw; if (tw.length) t?.enable(); this.cdr.detectChanges(); } });
  }

  public onTownChange(townId: string) {
    const v = this.editForm.get('villageId');
    this.villages = []; v?.setValue(''); v?.disable();
    if (!townId) return;
    this.isLoadingVillages = true;
    this.geoSvc.getVillages(townId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (vl) => { this.villages = vl; if (vl.length) v?.enable(); this.cdr.detectChanges(); } });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  public saveDetails() {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.isSaving = true;
    const val = this.editForm.getRawValue();

    const selectedCountry = this.countries.find(c => c.code === val.countryCode);
    const selectedState   = this.states.find(s => s.id === val.stateId);
    const selectedTown    = this.towns.find(t => t.id === val.townId);
    const selectedVillage = this.villages.find(v => v.id === val.villageId);

    const payload = {
      title:            val.title,
      firstName:        val.firstName.trim(),
      middleName:       val.middleName?.trim() || null,
      lastName:         val.lastName.trim(),
      guardianName:     val.guardianName?.trim() || null,
      dateOfBirth:      val.dateOfBirth,
      gender:           val.gender,
      maritalStatus:    val.maritalStatus || null,
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
    };

    this.http.patch(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Saved', detail: 'Customer profile updated.' });
          this.isEditing = false;
          this.fetchCustomerDetails();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Update failed.' });
        },
      });
  }

  // ── Status toggle ─────────────────────────────────────────────────────────

  public toggleCustomerStatus() {
    if (!this.customer || this.isUpdatingStatus) return;
    this.isUpdatingStatus = true;
    const newStatus = !this.customer.isActive;
    this.http.patch(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isUpdatingStatus = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.customer.isActive = newStatus;
          this.msg.add({ severity: 'success', summary: 'Updated', detail: `Customer ${newStatus ? 'activated' : 'suspended'}.` });
          this.cdr.detectChanges();
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  public confirmDelete() { this.showDeleteModal = true; }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.msg.add({ severity: 'success', summary: 'Deleted', detail: 'Customer record removed.' });
          this.showDeleteModal = false;
          setTimeout(() => this.router.navigate(['/banks', this.bankId, 'branches', this.branchId]), 1000);
        },
        error: (err) => this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'Operation failed. Please try again.' }),
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  public setTab(tab: string) { this.activeTab = tab; this.cdr.detectChanges(); }

  public isInvalid(field: string): boolean {
    const ctrl = this.editForm.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public errorMsg(field: string): string {
    const ctrl = this.editForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'Required.';
    if (ctrl.errors['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars.`;
    if (ctrl.errors['pattern']) {
      if (field === 'phoneNumber') return 'Enter a valid 10-digit mobile number.';
      if (field === 'email')       return 'Enter a valid email address.';
      return 'Invalid format.';
    }
    return 'Invalid.';
  }

  public getKycBadge(status: string): string {
    const map: Record<string, string> = {
      VERIFIED: 'badge-green', PENDING: 'badge-amber',
      REJECTED: 'badge-red',   EXPIRED: 'badge-red',
    };
    return map[status] ?? 'badge-gray';
  }

  public getCategoryBadge(cat: string): string {
    const map: Record<string, string> = {
      PUBLIC: 'badge-blue', STAFF: 'badge-purple',
      SENIOR_CITIZEN: 'badge-green', CORPORATE: 'badge-amber',
    };
    return map[cat] ?? 'badge-gray';
  }
}
