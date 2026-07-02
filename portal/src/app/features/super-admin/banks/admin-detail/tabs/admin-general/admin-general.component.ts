import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, OnDestroy,
  inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';

import { AppValidators } from '../../../../../../core/utils/validators.util';
import { DROPDOWN_OPTIONS } from '../../../../../../shared/constants/dropdown-options.constant';
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';

interface RoleOption {
  id: string;
  role: string;
  name: string;
  isSystemRole: boolean;
  isActive: boolean;
  bankId: string | null;
}

@Component({
  selector: 'app-admin-general',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    DialogModule, DropdownModule, ButtonComponent, HasPermissionDirective,
  ],
  templateUrl: './admin-general.component.html',
})
export class AdminGeneralComponent implements OnInit, OnChanges, OnDestroy {
  @Input() adminUser: any = null;
  @Input() bankId!: string;
  @Output() refreshData = new EventEmitter<void>();

  private http    = inject(HttpClient);
  private fb      = inject(FormBuilder);
  private cdr     = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router  = inject(Router);
  private destroy$ = new Subject<void>();

  public isEditing  = false;
  public isSaving   = false;
  public isDeleting = false;
  public showDeleteModal = false;

  public editForm!: FormGroup;
  public availableRoles: RoleOption[] = [];
  public isLoadingRoles = false;

  public countryCodes = DROPDOWN_OPTIONS.COUNTRY_CODES;

  ngOnInit() {
    this.initForm();
    this.fetchRoles();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['adminUser'] && this.adminUser && this.isEditing) {
      this.populateForm();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.editForm = this.fb.group({
      firstName:  ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: ['', [Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      lastName:   ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      email:      ['', [Validators.pattern(AppValidators.EMAIL_REGEX)]],
      phoneCode:  ['+91'],
      phone:      ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      roleId:     ['', Validators.required],
    });
  }

  public fetchRoles() {
    if (!this.bankId) return;
    this.isLoadingRoles = true;
    this.http.get<any>(`/roles?bankId=${this.bankId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingRoles = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const raw: RoleOption[] = res.data || res || [];
          this.availableRoles = raw
            .filter(r => r.isActive !== false)
            .sort((a, b) => (b.isSystemRole ? 1 : 0) - (a.isSystemRole ? 1 : 0));
          this.cdr.detectChanges();
        },
        error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load roles.' })
      });
  }

  public toggleEditMode() {
    this.isEditing = true;
    this.populateForm();
  }

  private populateForm() {
    if (!this.adminUser) return;

    let phone = this.adminUser.phoneNumber || this.adminUser.phone || '';
    let phoneCode = '+91';
    // Strip common dial codes to extract bare number
    for (const code of ['+91', '+1', '+44', '+971', '+65', '+61']) {
      if (phone.startsWith(code)) {
        phoneCode = code;
        phone = phone.substring(code.length);
        break;
      }
    }

    // Find the role by id or role slug
    const currentRoleId = this.adminUser.role?.id
      || this.availableRoles.find(r => r.role === (this.adminUser.role?.role || this.adminUser.roleType))?.id
      || '';

    this.editForm.patchValue({
      firstName:  this.adminUser.firstName  || '',
      middleName: this.adminUser.middleName || '',
      lastName:   this.adminUser.lastName   || '',
      email:      this.adminUser.email      || '',
      phoneCode,
      phone,
      roleId: currentRoleId,
    });
  }

  public cancelEditMode() {
    this.isEditing = false;
    this.editForm.reset();
  }

  public saveDetails() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSaving = true;
    const vals = this.editForm.getRawValue();
    const selectedRole = this.availableRoles.find(r => r.id === vals.roleId);

    const payload = {
      firstName:   vals.firstName.trim(),
      middleName:  vals.middleName?.trim() || null,
      lastName:    vals.lastName.trim(),
      email:       vals.email?.trim() || null,
      phoneNumber: `${vals.phoneCode}${vals.phone.trim()}`,
      roleId:      vals.roleId,
      roleType:    selectedRole?.role ?? null,
    };

    this.http.patch(`/banks/${this.bankId}/users/${this.adminUser.id}/update`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Profile updated.' });
          this.isEditing = false;
          this.refreshData.emit();
        },
        error: (err) => {
          const msg = Array.isArray(err.error?.message) ? err.error.message[0] : err.error?.message;
          this.messageService.add({ severity: 'error', summary: 'Error', detail: msg || 'Update failed.' });
        }
      });
  }

  public confirmDelete() { this.showDeleteModal = true; }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/banks/${this.bankId}/users/${this.adminUser.id}/delete`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Administrator access revoked.' });
          this.showDeleteModal = false;
          setTimeout(() => this.router.navigate(['/banks', this.bankId]), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Deletion failed.' })
      });
  }

  public isInvalid(field: string): boolean {
    const ctrl = this.editForm.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  public errorMsg(field: string): string {
    const ctrl = this.editForm.get(field);
    if (!ctrl?.errors) return '';
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['pattern']) {
      if (field === 'phone') return 'Enter a valid 10-digit mobile number.';
      return 'Invalid format.';
    }
    return 'Invalid value.';
  }
}
