import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { TranslateModule } from '@ngx-translate/core';

// Utilities & Shared UI
import { AppValidators } from '../../../../core/utils/validators.util';
import { SecurityUtils } from '../../../../core/utils/security.util';
import { ButtonComponent } from '../button/button.component';
import { DROPDOWN_OPTIONS } from '../../../../shared/constants/dropdown-options.constant'; // 🚀 Unified Constants

// PrimeNG
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-user-onboard-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, TooltipModule, ButtonComponent, TranslateModule],
  templateUrl: './user-onboard-modal.component.html'
})
export class UserOnboardModalComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Input() bankId!: string;
  @Input() branchId?: string;
  @Input() modalContext: 'ADMIN' | 'STAFF' = 'ADMIN'; 
  
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onUserCreated = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public userForm!: FormGroup;
  public isSubmitting = false;
  public isLoadingRoles = false;
  public availableRoles: any[] = [];
  
  // 🚀 Use centralized constants
  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;

  ngOnInit() {
    this.initForm();
    this.fetchRoles();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: ['', [Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      lastName: ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      email: ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]], // Now Optional
      phoneCode: ['+91', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      role: ['', Validators.required],
      password: ['', [Validators.required, Validators.pattern(AppValidators.PASSWORD_REGEX)]],
    });
  }

  private fetchRoles() {
    this.isLoadingRoles = true;
    this.http.get<any>('/roles').pipe(takeUntil(this.destroy$), finalize(() => { 
      this.isLoadingRoles = false; 
      this.cdr.detectChanges(); 
    })).subscribe({
      next: (res) => { this.availableRoles = res.data || res || []; },
      error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load roles.' })
    });
  }

  public generatePassword() {
    const pwd = SecurityUtils.generateSecurePassword(12);
    this.userForm.patchValue({ password: pwd });
  }

  public copyPassword() {
    const pwd = this.userForm.get('password')?.value;
    if (pwd) navigator.clipboard.writeText(pwd).then(() => this.messageService.add({ severity: 'info', summary: 'Copied', detail: 'Password copied' }));
  }

  public submitUser() {
    if (this.userForm.invalid) { this.userForm.markAllAsTouched(); return; }
    
    this.isSubmitting = true;
    const val = this.userForm.getRawValue();

    const payload = {
      firstName: val.firstName.trim(), 
      middleName: val.middleName?.trim() || null, 
      lastName: val.lastName.trim(), 
      email: val.email?.trim() || null, 
      phoneNumber: `${val.phoneCode}${val.phone.trim()}`, 
      password: val.password, 
      roleType: val.role,
      branchId: this.branchId || null
    };

    this.http.post(`/banks/${this.bankId}/users/onboard`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Account provisioned successfully.' });
          this.onUserCreated.emit(res.data || res);
          this.closeModal();
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public closeModal() {
    this.userForm.reset({ phoneCode: '+91', role: '' });
    this.visible = false;
    this.visibleChange.emit(this.visible);
  }

  public isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const control = form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}