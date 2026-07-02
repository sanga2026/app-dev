import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Input, Output, EventEmitter, inject, ChangeDetectorRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { TranslateModule } from '@ngx-translate/core';

import { AppValidators } from '../../../../core/utils/validators.util';
import { SecurityUtils } from '../../../../core/utils/security.util';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant';

import { DialogModule }   from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';

interface RoleOption {
  id: string; role: string; name: string;
  isSystemRole: boolean; isActive: boolean; bankId: string | null;
}

@Component({
  selector: 'app-user-onboard-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    TranslateModule, DialogModule, DropdownModule,
  ],
  templateUrl: './user-onboard-modal.component.html',
})
export class UserOnboardModalComponent implements OnInit, OnDestroy, OnChanges {

  // When bankId is passed → bank is pre-selected (user is being created under a bank)
  // When branchId is passed → both bank + branch are pre-selected (branch-level user)
  // When neither is passed → Super Admin can search and pick any bank/branch
  @Input() visible = false;
  @Input() bankId?: string;       // optional — auto-fills bank when provided
  @Input() branchId?: string;     // optional — auto-fills branch when provided
  @Input() modalContext: 'ADMIN' | 'STAFF' = 'ADMIN';

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onUserCreated = new EventEmitter<any>();

  private fb   = inject(FormBuilder);
  private http = inject(HttpClient);
  private msg  = inject(MessageService);
  private cdr  = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public userForm!: FormGroup;
  public isSubmitting   = false;
  public isLoadingRoles = false;
  public showPassword   = false;
  public availableRoles: RoleOption[] = [];
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;

  // ── Resolved scoping (from search or from @Input) ──────────────────────────
  public resolvedBank:   any = null;   // { id, name, ifscPrefix }
  public resolvedBranch: any = null;   // { id, name, branchCode }

  // ── Bank autocomplete ──────────────────────────────────────────────────────
  public bankQuery             = '';
  public bankSuggestions:  any[] = [];
  public showBankDropdown      = false;
  public isSearchingBank       = false;
  public isBankLocked          = false;  // true when bankId was passed as @Input
  private bankSearch$          = new Subject<string>();

  // ── Branch autocomplete ────────────────────────────────────────────────────
  public branchQuery             = '';
  public branchSuggestions:  any[] = [];
  public showBranchDropdown      = false;
  public isSearchingBranch       = false;
  public isBranchLocked          = false; // true when branchId was passed as @Input

  private branchSearch$          = new Subject<string>();

  // Close dropdowns on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.bank-autocomplete'))   { this.showBankDropdown   = false; }
    if (!t.closest('.branch-autocomplete')) { this.showBranchDropdown = false; }
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.initForm();
    this.wireSearchStreams();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      this.resetScopingState();
      this.applyInputScoping();
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Init ──────────────────────────────────────────────────────────────────

  private initForm() {
    this.userForm = this.fb.group({
      firstName:  ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: [''],
      lastName:   ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      email:      ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      phoneCode:  ['+91', Validators.required],
      phone:      ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      roleId:     ['', Validators.required],
      password:   ['', [Validators.required, Validators.pattern(AppValidators.PASSWORD_REGEX)]],
    });
  }

  private wireSearchStreams() {
    this.bankSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this._searchBanks(q));

    this.branchSearch$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this._searchBranches(q));
  }

  /** Called on every modal open — resolves scoping from @Inputs */
  private applyInputScoping() {
    if (this.bankId) {
      // Bank was provided → lock it, fetch its name
      this.isBankLocked = true;
      this.http.get<any>(`/banks/${this.bankId}`)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.resolvedBank = res.data ?? res;
            this.bankQuery    = this.resolvedBank.name;
            this.fetchRoles(this.bankId!);
            this.cdr.detectChanges();
          },
        });
    } else {
      this.isBankLocked = false;
      this.fetchRoles(); // load global/system roles when no bank context
    }

    if (this.branchId && this.bankId) {
      // Branch was provided → lock it, fetch its name
      this.isBranchLocked = true;
      this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}`)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.resolvedBranch = res.data ?? res;
            this.branchQuery    = this.resolvedBranch.name;
            this.cdr.detectChanges();
          },
        });
    } else {
      this.isBranchLocked = false;
    }
  }

  private resetScopingState() {
    this.resolvedBank     = null;
    this.resolvedBranch   = null;
    this.bankQuery        = '';
    this.branchQuery      = '';
    this.bankSuggestions  = [];
    this.branchSuggestions= [];
    this.showBankDropdown = false;
    this.showBranchDropdown = false;
    this.availableRoles   = [];
    this.userForm?.reset({ phoneCode: '+91', roleId: '' });
    this.showPassword = false;
  }

  // ── Bank search ────────────────────────────────────────────────────────────

  public onBankQueryChange(q: string) {
    this.bankQuery = q;
    if (this.resolvedBank) { this.resolvedBank = null; this.resolvedBranch = null; this.branchQuery = ''; this.availableRoles = []; }
    if (!q || q.length < 2) { this.bankSuggestions = []; this.showBankDropdown = false; this.cdr.detectChanges(); return; }
    this.bankSearch$.next(q);
  }

  private _searchBanks(q: string) {
    this.isSearchingBank  = true;
    this.showBankDropdown = true;
    this.http.get<any>(`/banks?search=${encodeURIComponent(q)}&limit=8&offset=0`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSearchingBank = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => { this.bankSuggestions = r.data || r || []; this.cdr.detectChanges(); } });
  }

  public selectBank(bank: any) {
    this.resolvedBank       = bank;
    this.bankQuery          = bank.name;
    this.bankSuggestions    = [];
    this.showBankDropdown   = false;
    // Reset branch when bank changes
    this.resolvedBranch     = null;
    this.branchQuery        = '';
    this.branchSuggestions  = [];
    this.userForm.patchValue({ roleId: '' });
    this.fetchRoles(bank.id);
    this.cdr.detectChanges();
  }

  public clearBank() {
    this.resolvedBank = null; this.bankQuery = '';
    this.resolvedBranch = null; this.branchQuery = '';
    this.availableRoles = []; this.userForm.patchValue({ roleId: '' });
    this.cdr.detectChanges();
  }

  // ── Branch search ──────────────────────────────────────────────────────────

  public onBranchQueryChange(q: string) {
    this.branchQuery = q;
    if (this.resolvedBranch) this.resolvedBranch = null;
    if (!q || q.length < 2 || !this.resolvedBank) {
      this.branchSuggestions = []; this.showBranchDropdown = false; this.cdr.detectChanges(); return;
    }
    this.branchSearch$.next(q);
  }

  private _searchBranches(q: string) {
    if (!this.resolvedBank) return;
    this.isSearchingBranch  = true;
    this.showBranchDropdown = true;
    this.http.get<any>(`/banks/${this.resolvedBank.id}/branches?search=${encodeURIComponent(q)}&limit=8&offset=0`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSearchingBranch = false; this.cdr.detectChanges(); }))
      .subscribe({ next: (r) => { this.branchSuggestions = r.data || r || []; this.cdr.detectChanges(); } });
  }

  public selectBranch(branch: any) {
    this.resolvedBranch       = branch;
    this.branchQuery          = branch.name;
    this.branchSuggestions    = [];
    this.showBranchDropdown   = false;
    this.cdr.detectChanges();
  }

  public clearBranch() {
    this.resolvedBranch = null; this.branchQuery = '';
    this.cdr.detectChanges();
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  public fetchRoles(bankId?: string) {
    this.isLoadingRoles = true;
    const url = bankId ? `/roles?bankId=${bankId}` : `/roles`;
    this.http.get<any>(url)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingRoles = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const raw: RoleOption[] = res.data || res || [];
          this.availableRoles = raw.filter(r => r.isActive !== false)
            .sort((a, b) => (b.isSystemRole ? 1 : 0) - (a.isSystemRole ? 1 : 0));
          this.cdr.detectChanges();
        },
        error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'Failed to load roles.' }),
      });
  }

  // ── Password ───────────────────────────────────────────────────────────────

  public generatePassword() {
    this.userForm.patchValue({ password: SecurityUtils.generateSecurePassword(12) });
    this.showPassword = true;
    this.cdr.detectChanges();
  }

  public copyPassword() {
    const pwd = this.userForm.get('password')?.value;
    if (pwd) navigator.clipboard.writeText(pwd).then(() =>
      this.msg.add({ severity: 'success', summary: 'Copied', detail: 'Password copied to clipboard.' })
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  public submitUser() {
    if (this.userForm.invalid) { this.userForm.markAllAsTouched(); this.cdr.detectChanges(); return; }

    // Resolve effective bankId and branchId
    const effectiveBankId   = this.isBankLocked   ? this.bankId   : this.resolvedBank?.id;
    const effectiveBranchId = this.isBranchLocked ? this.branchId : this.resolvedBranch?.id ?? null;

    if (!effectiveBankId) {
      this.msg.add({ severity: 'warn', summary: 'Bank Required',
        detail: 'Please select a bank to provision this user under.' });
      return;
    }

    this.isSubmitting = true;
    const val = this.userForm.getRawValue();
    const selectedRole = this.availableRoles.find(r => r.id === val.roleId);

    const payload = {
      firstName:   val.firstName.trim(),
      middleName:  val.middleName?.trim() || null,
      lastName:    val.lastName.trim(),
      email:       val.email?.trim() || null,
      phoneNumber: `${val.phoneCode}${val.phone.trim()}`,
      password:    val.password,
      roleId:      val.roleId,
      roleType:    selectedRole?.role ?? null,
      branchId:    effectiveBranchId,
    };

    this.http.post(`/banks/${effectiveBankId}/users/onboard`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.msg.add({ severity: 'success', summary: 'User Created',
            detail: `Account provisioned${this.resolvedBranch ? ' and linked to ' + this.resolvedBranch.name : ''}.` });
          this.onUserCreated.emit(res.data || res);
          this.closeModal();
        },
        error: (err) => {
          const m = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.msg.add({ severity: 'error', summary: 'Provision Failed', detail: m || 'Unknown error.' });
        },
      });
  }

  public closeModal() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetScopingState();
  }

  public isInvalid(field: string): boolean {
    const ctrl = this.userForm.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public errorMsg(field: string): string {
    const ctrl = this.userForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required']) return 'Required.';
    if (ctrl.errors['pattern']) {
      if (field === 'email')    return 'Enter a valid email address.';
      if (field === 'phone')    return 'Enter a valid 10-digit mobile number.';
      if (field === 'password') return 'Min 8 chars: uppercase, lowercase, number & special char.';
      return 'Invalid format.';
    }
    return 'Invalid.';
  }
}
