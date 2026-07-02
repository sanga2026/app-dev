import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Input, Output, EventEmitter, inject, ChangeDetectorRef, ChangeDetectionStrategy,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AppValidators } from '../../../../core/utils/validators.util';
import { SecurityUtils } from '../../../../core/utils/security.util';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant';
import { GeographyService } from '../../../../shared/services/geography.service';
import { Country, State, Town, Village } from '../../../../shared/models/geography.model';

import { DialogModule }      from 'primeng/dialog';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule }       from 'primeng/toast';
import { DropdownModule }    from 'primeng/dropdown';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

interface RoleOption { id: string; role: string; name: string; isSystemRole: boolean; isActive: boolean; bankId: string | null; }

@Component({
  selector: 'app-branch-onboard-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, TranslateModule,
    DialogModule, InputSwitchModule, ToastModule, DropdownModule, HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './branch-onboard-modal.component.html',
})
export class BranchOnboardModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible = false;
  @Input() bankId!: string;

  @Output() visibleChange   = new EventEmitter<boolean>();
  @Output() onBranchCreated = new EventEmitter<any>();

  private fb     = inject(FormBuilder);
  private http   = inject(HttpClient);
  private msg    = inject(MessageService);
  private cdr    = inject(ChangeDetectorRef);
  private geoSvc = inject(GeographyService);
  private destroy$ = new Subject<void>();

  // ── Wizard ──────────────────────────────────────────────────────────────
  currentStep = 0;
  readonly steps = [
    { label: 'Identity & Classification', icon: 'pi-id-card'    },
    { label: 'Geographic Location',       icon: 'pi-map-marker' },
    { label: 'Operations & Limits',       icon: 'pi-cog'        },
  ];

  // ── Forms ────────────────────────────────────────────────────────────────
  public branchForm!: FormGroup;
  public userForm!: FormGroup;
  public isSubmitting      = false;
  public isProvisioningUser = false;
  public showUserPanel     = false;   // slide-in user provisioning panel
  public showUserPassword  = false;

  // ── Dropdowns ────────────────────────────────────────────────────────────
  public branchTypes  = DROPDOWN_OPTIONS.BRANCH_TYPES;
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;
  public tiers        = DROPDOWN_OPTIONS.TIERS;

  public countries:            Country[] = [];
  public branchStates:         State[]   = [];
  public filteredBranchCities: Town[]    = [];
  public filteredBranchVillages: Village[] = [];
  public isLoadingCountries  = false;
  public isLoadingStates     = false;
  public isLoadingCities     = false;
  public isLoadingVillages   = false;

  // ── Roles for user provisioning ──────────────────────────────────────────
  public availableRoles: RoleOption[] = [];
  public isLoadingRoles = false;

  ngOnInit() {
    this.initForms();
    this.resetForm();
    this.loadCountries();

    // Debounced manager search
    this.managerSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(q => this._searchManagers(q));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.currentStep  = 0;
      this.showUserPanel = false;
      if (this.branchForm) this.resetForm();
      if (this.bankId) this.fetchRoles();
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Init ─────────────────────────────────────────────────────────────────

  private initForms() {
    this.branchForm = this.fb.group({
      // Step 1
      name:        ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      branchType:  ['RETAIL_BRANCH', Validators.required],
      openingDate: ['', Validators.required],
      tier:        ['URBAN', Validators.required],
      ifsc:        ['', [Validators.required, Validators.pattern(AppValidators.FULL_IFSC_REGEX)]],
      micrCode:    ['', [Validators.pattern(/^[0-9]{9}$/)]],
      swiftCode:   ['', [Validators.pattern(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/)]],

      // Step 2
      phoneCode:   ['+91', Validators.required],
      phone:       ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      email:       ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      addressLine1:['', [Validators.required, Validators.maxLength(255)]],
      addressLine2:['', Validators.maxLength(255)],
      countryCode: ['', Validators.required],
      stateId:     [{ value: '', disabled: true }, Validators.required],
      city:        [{ value: '', disabled: true }, Validators.required],
      village:     [{ value: '', disabled: true }],
      postalCode:  ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]],

      // Step 3 — managerName is REQUIRED (must search or create a user first)
      managerName:        ['', [Validators.required, Validators.maxLength(100)]],
      managerId:          ['', Validators.required],  // UUID of the assigned user
      gstin:              [''],
      cashRetentionLimit: [null, [Validators.min(0)]],
      openingTime:        ['09:00', [Validators.required, Validators.pattern(AppValidators.TIME_REGEX)]],
      closingTime:        ['17:00', [Validators.required, Validators.pattern(AppValidators.TIME_REGEX)]],
      isAtmAvailable:     [false],
    });

    this.userForm = this.fb.group({
      firstName:  ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: [''],
      lastName:   ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      email:      ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      phoneCode:  ['+91'],
      phone:      ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      roleId:     ['', Validators.required],
      password:   ['', [Validators.required, Validators.pattern(AppValidators.PASSWORD_REGEX)]],
    });
  }

  private resetForm() {
    this.branchForm?.reset({
      branchType: 'RETAIL_BRANCH', tier: 'URBAN',
      phoneCode: '+91', openingTime: '09:00', closingTime: '17:00', isAtmAvailable: false,
    });
    ['stateId','city','village'].forEach(f => {
      this.branchForm?.get(f)?.disable();
      this.branchForm?.get(f)?.setValue('');
    });
    this.branchStates = []; this.filteredBranchCities = []; this.filteredBranchVillages = [];
    this.userForm?.reset({ phoneCode: '+91' });
    this.showUserPanel = false;
    this.showUserPassword = false;
    this.managerQuery = '';
    this.managerSuggestions = [];
    this.showManagerDropdown = false;
  }

  // ── Wizard navigation ────────────────────────────────────────────────────

  get stepFields(): string[][] {
    return [
      ['name','branchType','openingDate','tier','ifsc','micrCode','swiftCode'],
      ['phoneCode','phone','email','addressLine1','addressLine2','countryCode','stateId','city','postalCode'],
      ['managerName','managerId','openingTime','closingTime'],
    ];
  }

  nextStep() {
    const fields = this.stepFields[this.currentStep];
    let invalid = false;
    fields.forEach(f => {
      const ctrl = this.branchForm.get(f);
      ctrl?.markAsTouched();
      if (ctrl?.invalid) invalid = true;
    });
    if (invalid) { this.cdr.detectChanges(); return; }
    if (this.currentStep < 2) { this.currentStep++; this.cdr.detectChanges(); }
  }

  prevStep() {
    if (this.currentStep > 0) { this.currentStep--; this.cdr.detectChanges(); }
  }

  getProgress(): number { return ((this.currentStep + 1) / 3) * 100; }

  // ── Geography cascade ────────────────────────────────────────────────────

  private loadCountries() {
    this.isLoadingCountries = true;
    this.geoSvc.getCountries(true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCountries = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (c) => { this.countries = c; this.cdr.detectChanges(); } });
  }

  public onCountryChange(code: string) {
    const s = this.branchForm.get('stateId'); const c = this.branchForm.get('city'); const v = this.branchForm.get('village');
    this.branchStates = []; this.filteredBranchCities = []; this.filteredBranchVillages = [];
    s?.setValue(''); s?.disable(); c?.setValue(''); c?.disable(); v?.setValue(''); v?.disable();
    if (!code) return;
    this.isLoadingStates = true;
    this.geoSvc.getStates(code, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingStates = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (st) => { this.branchStates = st; if (st.length) s?.enable(); this.cdr.detectChanges(); } });
  }

  public onBranchStateChange(stateId: string) {
    const c = this.branchForm.get('city'); const v = this.branchForm.get('village');
    this.filteredBranchCities = []; this.filteredBranchVillages = [];
    c?.setValue(''); c?.disable(); v?.setValue(''); v?.disable();
    if (!stateId) return;
    this.isLoadingCities = true;
    this.geoSvc.getTowns(stateId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingCities = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (t) => { this.filteredBranchCities = t; if (t.length) c?.enable(); this.cdr.detectChanges(); } });
  }

  public onBranchCityChange(townId: string) {
    const v = this.branchForm.get('village');
    this.filteredBranchVillages = []; v?.setValue(''); v?.disable();
    if (!townId) return;
    this.isLoadingVillages = true;
    this.geoSvc.getVillages(townId, true)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingVillages = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (vl) => { this.filteredBranchVillages = vl; if (vl.length) v?.enable(); this.cdr.detectChanges(); } });
  }

  // ── Manager autocomplete ─────────────────────────────────────────────────
  public managerQuery    = '';          // ngModel for the search input
  public managerSuggestions: any[] = [];
  public showManagerDropdown = false;
  public isSearchingManager  = false;
  private managerSearch$ = new Subject<string>();

  // Close suggestion dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.manager-autocomplete')) {
      this.showManagerDropdown = false;
      this.cdr.detectChanges();
    }
  }

  // ── Manager autocomplete ─────────────────────────────────────────────────

  public onManagerQueryChange(query: string) {
    this.managerQuery = query;
    if (this.branchForm.get('managerId')?.value) {
      this.branchForm.patchValue({ managerId: '' });
    }
    if (!query || query.trim().length < 2) {
      this.managerSuggestions = [];
      this.showManagerDropdown = false;
      this.cdr.detectChanges();
      return;
    }
    this.managerSearch$.next(query.trim());
  }

  private _searchManagers(query: string) {
    if (!this.bankId) return;
    this.isSearchingManager = true;
    this.showManagerDropdown = true;
    this.http.get<any>(`/banks/${this.bankId}/admins?search=${encodeURIComponent(query)}&limit=8&offset=0`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSearchingManager = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => { this.managerSuggestions = res.data || res || []; this.cdr.detectChanges(); },
        error: () => { this.managerSuggestions = []; },
      });
  }

  public selectManager(user: any) {
    const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
    this.managerQuery = fullName;
    this.branchForm.patchValue({ managerName: fullName, managerId: user.id });
    this.managerSuggestions = [];
    this.showManagerDropdown = false;
    this.cdr.detectChanges();
  }

  public clearManager() {
    this.managerQuery = '';
    this.branchForm.patchValue({ managerName: '', managerId: '' });
    this.managerSuggestions = [];
    this.showManagerDropdown = false;
    this.cdr.detectChanges();
  }

  // ── Roles + User provisioning ─────────────────────────────────────────────

  private fetchRoles() {
    this.isLoadingRoles = true;
    this.http.get<any>(`/roles?bankId=${this.bankId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingRoles = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const raw: RoleOption[] = res.data || res || [];
          this.availableRoles = raw.filter(r => r.isActive !== false)
            .sort((a, b) => (b.isSystemRole ? 1 : 0) - (a.isSystemRole ? 1 : 0));
          this.cdr.detectChanges();
        },
      });
  }

  public openUserPanel() {
    this.userForm.reset({ phoneCode: '+91' });
    this.showUserPanel    = true;
    this.showUserPassword = false;
    this.cdr.detectChanges();
  }

  public closeUserPanel() {
    this.showUserPanel = false;
    this.userForm.reset({ phoneCode: '+91' });
    this.cdr.detectChanges();
  }

  public generatePassword() {
    const pwd = SecurityUtils.generateSecurePassword(12);
    this.userForm.patchValue({ password: pwd });
    this.showUserPassword = true;
    this.cdr.detectChanges();
  }

  public provisionUser() {
    if (this.userForm.invalid) { this.userForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.isProvisioningUser = true;
    const v = this.userForm.getRawValue();
    const selectedRole = this.availableRoles.find(r => r.id === v.roleId);

    const payload = {
      firstName:   v.firstName.trim(),
      middleName:  v.middleName?.trim() || null,
      lastName:    v.lastName.trim(),
      email:       v.email?.trim() || null,
      phoneNumber: `${v.phoneCode}${v.phone.trim()}`,
      password:    v.password,
      roleId:      v.roleId,
      roleType:    selectedRole?.role ?? null,
      // bankId enforced by the URL; branchId assigned after branch creation
    };

    this.http.post(`/banks/${this.bankId}/users/onboard`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isProvisioningUser = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          const user = res.data || res;
          const fullName = `${user.firstName}${user.middleName ? ' ' + user.middleName : ''} ${user.lastName}`.trim();
          this.branchForm.patchValue({ managerName: fullName, managerId: user.id });
          this.managerQuery = fullName;
          this.msg.add({ severity: 'success', summary: 'User Created', detail: `${fullName} provisioned — mapped as Branch Manager.` });
          this.showUserPanel = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Provision Failed', detail: m || 'Could not create user.' });
        },
      });
  }

  // ── Submit branch ─────────────────────────────────────────────────────────

  public submitBranch() {
    this.branchForm.markAllAsTouched();
    if (this.branchForm.invalid) {
      this.msg.add({ severity: 'warn', summary: 'Validation', detail: 'Please fix highlighted fields.' });
      return;
    }
    this.isSubmitting = true;
    const vals = this.branchForm.getRawValue();

    const selectedCountry = this.countries.find(c => c.code === vals.countryCode);
    const selectedState   = this.branchStates.find(s => s.id === vals.stateId);
    const selectedCity    = this.filteredBranchCities.find(t => t.id === vals.city);
    const selectedVillage = this.filteredBranchVillages.find(v => v.id === vals.village);

    const payload = {
      name:         vals.name.trim(),
      branchType:   vals.branchType,
      openingDate:  vals.openingDate,
      ifsc:         vals.ifsc.toUpperCase().trim(),
      micrCode:     vals.micrCode?.toUpperCase().trim() || null,
      swiftCode:    vals.swiftCode?.toUpperCase().trim() || null,
      addressLine1: vals.addressLine1.trim(),
      addressLine2: vals.addressLine2?.trim() || null,
      country:      selectedCountry?.name ?? vals.countryCode,
      state:        selectedState?.name   ?? '',
      city:         selectedCity?.name    ?? vals.city,
      village:      selectedVillage?.name ?? null,
      postalCode:   vals.postalCode.trim(),
      phone:        `${vals.phoneCode}${vals.phone.trim()}`,
      email:        vals.email?.trim() || null,
      metadata: {
        tier:               vals.tier,
        managerName:        vals.managerName?.trim() || null,
        managerId:          vals.managerId || null,
        gstin:              vals.gstin?.toUpperCase().trim() || null,
        cashRetentionLimit: vals.cashRetentionLimit || null,
        openingTime:        vals.openingTime,
        closingTime:        vals.closingTime,
        isAtmAvailable:     vals.isAtmAvailable,
      },
    };

    this.http.post(`/banks/${this.bankId}/branches`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          const branch = res.data || res;
          this.msg.add({ severity: 'success', summary: 'Branch Created', detail: res.message || 'Branch provisioned successfully.' });

          // After branch is created, assign branchId to the manager user so they're branch-scoped
          const managerId = vals.managerId;
          if (managerId && branch.id) {
            this.http.patch(`/banks/${this.bankId}/users/${managerId}/update`, { branchId: branch.id })
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => this.msg.add({ severity: 'info', summary: 'Manager Linked', detail: 'Branch manager has been assigned to this branch.' }),
                error: () => { /* non-critical — branch was still created */ }
              });
          }

          this.onBranchCreated.emit(branch);
          this.closeModal();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Error', detail: m || 'Failed.' });
        },
      });
  }

  public closeModal() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.currentStep = 0;
    this.resetForm();
  }

  public isInvalid(path: string): boolean {
    const ctrl = this.branchForm.get(path);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public isUserInvalid(path: string): boolean {
    const ctrl = this.userForm.get(path);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public errorMsg(path: string, form: 'branch' | 'user' = 'branch'): string {
    const ctrl = form === 'branch' ? this.branchForm.get(path) : this.userForm.get(path);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required'])  return 'Required.';
    if (ctrl.errors['minlength']) return `Min ${ctrl.errors['minlength'].requiredLength} chars.`;
    if (ctrl.errors['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars.`;
    if (ctrl.errors['pattern']) {
      if (path.includes('ifsc'))       return 'Format: 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234).';
      if (path.includes('micr'))       return 'Must be exactly 9 digits.';
      if (path.includes('swift'))      return 'Must be 8 or 11 alphanumeric characters.';
      if (path.includes('phone'))      return 'Enter a valid 10-digit mobile number.';
      if (path.includes('email'))      return 'Enter a valid email address.';
      if (path.includes('postal'))     return 'Must be 6 digits (e.g. 560001).';
      if (path.includes('password'))   return 'Min 8 chars with uppercase, lowercase, number & special char.';
      return 'Invalid format.';
    }
    return 'Invalid.';
  }
}
