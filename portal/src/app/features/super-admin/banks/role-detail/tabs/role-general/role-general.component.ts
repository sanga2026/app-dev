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
  readonly authService = inject(AuthService); // public so template can call isSuperAdmin()
  private destroy$ = new Subject<void>();

  public isEditing = false;
  public isSaving = false;
  public isDeleting = false;
  public showDeleteModal = false;
  public roleForm!: FormGroup;

  public systemResources = [
    { key: 'banks',          label: 'Bank Management'         },
    { key: 'branches',       label: 'Branch Management'       },
    { key: 'users',          label: 'Staff & Users'           },
    { key: 'customers',      label: 'Customer Directory'      },
    { key: 'loans',          label: 'Loans'                   },
    { key: 'loan-products',  label: 'Loan Products'           },
    { key: 'accounting',     label: 'Accounting / Accounts'   },
    { key: 'account-products', label: 'Account Products'      },
    { key: 'roles',          label: 'Role Management'         },
    { key: 'master-data',    label: 'Master Data'             },
    { key: 'geography',      label: 'Geography'               },
    { key: 'currencies',     label: 'Currencies'              },
    { key: 'audit',          label: 'Audit Logs'              },
    { key: 'reports',        label: 'Reports'                 },
    { key: 'global-settings',label: 'Global Settings'        },
    { key: 'dashboard',      label: 'Dashboard'               },
  ];

  public navigationResources = [
    { key: 'banks',       label: 'Tenant Banks' },
    { key: 'branches',    label: 'Branches'     },
    { key: 'customers',   label: 'Customers'    },
    { key: 'loans',       label: 'Loans'        },
    { key: 'accounting',  label: 'Accounting'   },
    { key: 'roles',       label: 'Roles'        },
    { key: 'geography',   label: 'Geography'    },
    { key: 'currencies',  label: 'Currencies'   },
    { key: 'master-data', label: 'Master Data'  },
    { key: 'audit',       label: 'Audit Logs'   },
    { key: 'reports',     label: 'Reports'      },
  ];

  ngOnInit() { this.initForm(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['role'] && !changes['role'].firstChange) {
      this.initForm();
    }
  }

private initForm() {
  // SUPER_ADMIN can always edit everything in the role matrix.
  // Other users can only edit permissions they themselves hold.
  const superAdmin = this.authService.isSuperAdmin();

  // ── Navigation group ─────────────────────────────────────────────────────
  const navControls: Record<string, any> = {};
  this.navigationResources.forEach(nav => {
    // Can this editor change this nav item?
    const canEdit = superAdmin || this.authService.hasPermission('navigation', nav.key);
    // Current value: explicit true/false from role, or false if null/absent
    const currentVal = this.role?.permissions?.navigation?.[nav.key] ?? false;
    navControls[nav.key] = [{ value: currentVal, disabled: !canEdit }];
  });
  const navigationGroup = this.fb.group(navControls);

  const permissionsConfig: Record<string, any> = { navigation: navigationGroup };

  // ── Data access groups ───────────────────────────────────────────────────
  this.systemResources.forEach(res => {
    const actions = ['read', 'create', 'update', 'delete'];
    const group: Record<string, any> = {};
    actions.forEach(action => {
      const canEdit = superAdmin || this.authService.hasPermission(res.key, action);
      const currentVal = this.role?.permissions?.[res.key]?.[action] ?? false;
      group[action] = [{ value: currentVal, disabled: !canEdit }];
    });
    permissionsConfig[res.key] = this.fb.group(group);
  });

  this.roleForm = this.fb.group({
    name:        [this.role?.name        || ''],
    description: [this.role?.description || ''],
    permissions: this.fb.group(permissionsConfig),
  });
}

  public toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) this.initForm();
  }

  public saveChanges() {
    this.isSaving = true;
    const payload = this.roleForm.getRawValue();

    this.http.patch(`/roles/${this.role.id}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => this.isSaving = false))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Role Saved',
            detail: 'Role permissions updated. Refreshing your access...' });
          this.isEditing = false;
          this.refreshData.emit();
          // Refresh the current user's permissions in localStorage so sidebar/guards
          // reflect the new matrix immediately without requiring a re-login
          this.authService.refreshPermissions().subscribe();
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
          this.messageService.add({ severity: 'error', summary: 'Delete Failed', detail: err?.error?.message || 'Operation failed. Please try again.' });
          this.showDeleteModal = false;
        }
      });
  }
}