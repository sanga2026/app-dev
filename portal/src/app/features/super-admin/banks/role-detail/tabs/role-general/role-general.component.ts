import { Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { ConfirmModalComponent } from '../../../../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
import { AuthService } from '../../../../../auth/auth.service'; // 🚀 IMPORT AUTH SERVICE
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-role-general',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, ConfirmModalComponent, HasPermissionDirective, ToastModule],
  templateUrl: './role-general.component.html'
})
export class RoleGeneralComponent implements OnInit, OnChanges {
  @Input() role: any;
  @Input() bankId!: string;
  @Output() refreshData = new EventEmitter<void>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private authService = inject(AuthService); // 🚀 INJECT AUTH SERVICE
  private destroy$ = new Subject<void>();

  public isEditing = false;
  public isSaving = false;
  public isDeleting = false;
  public showDeleteModal = false;
  public roleForm!: FormGroup;

  public systemResources = [
    { key: 'banks', label: 'Bank Management' },
    { key: 'branches', label: 'Branch Management' },
    { key: 'users', label: 'Staff & Users' },
    { key: 'customers', label: 'Customer Directory' },
    { key: 'products', label: 'Loan Products' },
    { key: 'transactions', label: 'Financial Transactions' },
    { key: 'roles', label: 'Role Management' },
    { key: 'master-data', label: 'Master Data' }
  ];

  public navigationResources = [
    { key: 'banks', label: 'Tenant Banks' },
    { key: 'customers', label: 'Customers' },
    { key: 'loans', label: 'Loans' },
    { key: 'branches', label: 'Branches' },
    { key: 'accounting', label: 'Accounting' },
    { key: 'master-data', label: 'Master Data' }
  ];

  ngOnInit() { this.initForm(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['role'] && !changes['role'].firstChange) {
      this.initForm();
    }
  }

private initForm() {
  // 1. Navigation Group: Force false if they lack permission
  const canNavBanks = this.authService.hasPermission('navigation', 'banks');
  const canNavCust = this.authService.hasPermission('navigation', 'customers');
  const canNavLoans = this.authService.hasPermission('navigation', 'loans');
  const canNavBranches = this.authService.hasPermission('navigation', 'branches');
  const canNavAcc = this.authService.hasPermission('navigation', 'accounting');
  const canNavMD = this.authService.hasPermission('navigation', 'master-data');

  const navigationGroup = this.fb.group({
    banks: [{ value: canNavBanks ? (this.role?.permissions?.navigation?.banks || false) : false, disabled: !canNavBanks }],
    customers: [{ value: canNavCust ? (this.role?.permissions?.navigation?.customers || false) : false, disabled: !canNavCust }],
    loans: [{ value: canNavLoans ? (this.role?.permissions?.navigation?.loans || false) : false, disabled: !canNavLoans }],
    branches: [{ value: canNavBranches ? (this.role?.permissions?.navigation?.branches || false) : false, disabled: !canNavBranches }],
    accounting: [{ value: canNavAcc ? (this.role?.permissions?.navigation?.accounting || false) : false, disabled: !canNavAcc }],
    'master-data': [{ value: canNavMD ? (this.role?.permissions?.navigation?.['master-data'] || false) : false, disabled: !canNavMD }]
  });

  const permissionsConfig: Record<string, any> = {
    navigation: navigationGroup
  };

  // 2. Data Matrix: Force false if they lack permission
  this.systemResources.forEach(res => {
    const canRead = this.authService.hasPermission(res.key, 'read');
    const canCreate = this.authService.hasPermission(res.key, 'create');
    const canUpdate = this.authService.hasPermission(res.key, 'update');
    const canDelete = this.authService.hasPermission(res.key, 'delete');

    permissionsConfig[res.key] = this.fb.group({
      read: [{ value: canRead ? (this.role?.permissions?.[res.key]?.read || false) : false, disabled: !canRead }],
      create: [{ value: canCreate ? (this.role?.permissions?.[res.key]?.create || false) : false, disabled: !canCreate }],
      update: [{ value: canUpdate ? (this.role?.permissions?.[res.key]?.update || false) : false, disabled: !canUpdate }],
      delete: [{ value: canDelete ? (this.role?.permissions?.[res.key]?.delete || false) : false, disabled: !canDelete }],
    });
  });

  this.roleForm = this.fb.group({
    name: [this.role?.name || ''],
    description: [this.role?.description || ''],
    permissions: this.fb.group(permissionsConfig) 
  });
}

  public toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.initForm();
  }

  public saveChanges() {
    this.isSaving = true;
    // 🚀 CRITICAL FIX: Use getRawValue() so disabled checkboxes are included in the payload
    const payload = this.roleForm.getRawValue();

    this.http.patch(`/roles/${this.role.id}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isSaving = false))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Role updated successfully.' });
          this.isEditing = false;
          this.refreshData.emit();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to update.' });
        }
      });
  }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/roles/${this.role.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isDeleting = false))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Terminated', detail: 'Role deleted successfully.' });
          this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'roles' } });
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Delete Failed', detail: err.error?.message });
          this.showDeleteModal = false;
        }
      });
  }
}