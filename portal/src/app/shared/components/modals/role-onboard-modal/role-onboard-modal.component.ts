import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../button/button.component';
import { AuthService } from '../../../../features/auth/auth.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive'; //
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-role-onboard-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, InputTextModule,TranslateModule, ButtonComponent,HasPermissionDirective],
  templateUrl: './role-onboard-modal.component.html',
})
export class RoleOnboardModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible: boolean = false;
  @Input() bankId!: string;
  @Input() roleData: any = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onRoleSaved = new EventEmitter<any>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  public isSubmitting = false;
  public isEditMode = false;
  public roleForm!: FormGroup;

  public systemResources = [
    { key: 'banks', label: 'Bank Management' },
    { key: 'branches', label: 'Branch Management' },
    { key: 'users', label: 'Staff & Users' },
    { key: 'customers', label: 'Customer Directory' },
    { key: 'products', label: 'Loan Products' },
    { key: 'transactions', label: 'Financial Transactions' },
    { key: 'roles', label: 'Role Management' },
    { key: 'master-data', label: 'Master Data' },
  ];

  // 🚀 Added for cleaner HTML rendering
  public navigationResources = [
    { key: 'banks', label: 'Tenant Banks' },
    { key: 'customers', label: 'Customers' },
    { key: 'loans', label: 'Loans' },
    { key: 'branches', label: 'Branches' },
    { key: 'accounting', label: 'Accounting' },
    { key: 'master-data', label: 'Master Data' },
  ];

  ngOnInit() {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      if (this.roleData) {
        this.isEditMode = true;
        this.populateForm(this.roleData);
      } else {
        this.isEditMode = false;
        this.roleForm?.reset();
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    // 1. Initialize the Navigation grouping with default false values
    const navigationGroup = this.fb.group({
      banks: [false],
      customers: [false],
      loans: [false],
      accounting: [false],
      branches: [false],
      'master-data': [false],
    });

    // 2. Safely type the object to avoid the TS "No overload" error
    const permissionsConfig: Record<string, any> = {
      navigation: navigationGroup,
    };

    // 3. 🛡️ FRONTEND PRIVILEGE BOUNDARY
    this.systemResources.forEach((resource) => {
      const canRead = this.authService.hasPermission(resource.key, 'read');
      const canCreate = this.authService.hasPermission(resource.key, 'create');
      const canUpdate = this.authService.hasPermission(resource.key, 'update');
      const canDelete = this.authService.hasPermission(resource.key, 'delete');

      // Populate config object dynamically
      permissionsConfig[resource.key] = this.fb.group({
        read: [{ value: false, disabled: !canRead }],
        create: [{ value: false, disabled: !canCreate }],
        update: [{ value: false, disabled: !canUpdate }],
        delete: [{ value: false, disabled: !canDelete }],
      });
    });

    // 4. Attach the complete config to the main form
    this.roleForm = this.fb.group({
      name: ['', Validators.required],
      slug: ['', Validators.required],
      description: [''],
      permissions: this.fb.group(permissionsConfig),
    });
  }

  private populateForm(data: any) {
    if (!this.roleForm) return;

    const slugControl = this.roleForm.get('slug');
    slugControl?.enable();

    this.roleForm.patchValue({
      name: data.name,
      slug: data.role,
      description: data.description,
    });

    if (this.isEditMode) {
      slugControl?.disable();
    }

    if (data.permissions) {
      const permsGroup = this.roleForm.get('permissions') as FormGroup;
      Object.keys(data.permissions).forEach((resource) => {
        if (permsGroup.contains(resource)) {
          permsGroup.get(resource)?.patchValue(data.permissions[resource]);
        }
      });
    }
  }

public generateSlug() {
  const nameControl = this.roleForm.get('name');
  const slugControl = this.roleForm.get('slug');
  
  if (nameControl?.value) {
    const generatedSlug = nameControl.value.toUpperCase().replace(/\s+/g, '_');
    slugControl?.setValue(generatedSlug);
  }
}

  public closeModal() {
    this.roleForm.reset();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  public submitRole() {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    const payload = this.roleForm.getRawValue();

    const request$ =
      this.isEditMode && this.roleData?.id
        ? this.http.patch(`/roles/${this.roleData.id}`, payload)
        : this.http.post(`/roles`, payload);

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (res: any) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: this.isEditMode ? 'Role updated successfully.' : 'Role created successfully.',
          });
          this.onRoleSaved.emit(res.data || res);
          this.closeModal();
        },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Action Failed',
            detail: err.error?.message || 'Could not process role.',
          });
        },
      });
  }

  public isFieldInvalid(field: string): boolean {
    const ctrl = this.roleForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}
