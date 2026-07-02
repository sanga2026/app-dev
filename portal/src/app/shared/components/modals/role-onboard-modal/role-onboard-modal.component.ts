import {
  Component, EventEmitter, Input, Output,
  OnInit, OnDestroy, OnChanges, SimpleChanges,
  inject, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

import { ButtonComponent } from '../button/button.component';
import { AuthService } from '../../../../features/auth/auth.service';

// ─── Resource definitions ────────────────────────────────────────────────────
// These MUST match the keys used in role.entity.ts PermissionMatrix
// and the resource values used in @RequirePermissions() across all controllers.

interface ResourceDef {
  key: string;
  label: string;
  group: string;
  actions: ActionDef[];
}

interface ActionDef {
  key: string;
  label: string;
  icon: string;
}

const ALL_RESOURCES: ResourceDef[] = [
  // ── Banking Operations ───────────────────────────────────────────────────
  {
    key: 'banks', label: 'Banks', group: 'Banking Operations',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
      { key: 'export', label: 'Export', icon: 'pi-download'    },
    ],
  },
  {
    key: 'branches', label: 'Branches', group: 'Banking Operations',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  {
    key: 'accounting', label: 'Accounting', group: 'Banking Operations',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'export', label: 'Export', icon: 'pi-download'    },
    ],
  },
  // ── Loan Operations ──────────────────────────────────────────────────────
  {
    key: 'loans', label: 'Loan Applications', group: 'Loan Operations',
    actions: [
      { key: 'read',     label: 'View',     icon: 'pi-eye'          },
      { key: 'create',   label: 'Initiate', icon: 'pi-plus-circle'  },
      { key: 'update',   label: 'Edit',     icon: 'pi-pencil'       },
      { key: 'approve',  label: 'Approve',  icon: 'pi-check-circle' },
      { key: 'reject',   label: 'Reject',   icon: 'pi-times-circle' },
      { key: 'disburse', label: 'Disburse', icon: 'pi-send'         },
      { key: 'export',   label: 'Export',   icon: 'pi-download'     },
    ],
  },
  {
    key: 'loan-products', label: 'Loan Products', group: 'Loan Operations',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  // ── Customer Management ──────────────────────────────────────────────────
  {
    key: 'customers', label: 'Customers', group: 'Customer Management',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Onboard',icon: 'pi-user-plus'   },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
      { key: 'export', label: 'Export', icon: 'pi-download'    },
    ],
  },
  // ── User & Access Management ─────────────────────────────────────────────
  {
    key: 'users', label: 'Users & Staff', group: 'Access Management',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  {
    key: 'roles', label: 'Roles & Permissions', group: 'Access Management',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  // ── Administration (Super Admin) ─────────────────────────────────────────
  {
    key: 'geography', label: 'Geography Master', group: 'Administration',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  {
    key: 'currencies', label: 'Currencies', group: 'Administration',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'     },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'  },
    ],
  },
  {
    key: 'master-data', label: 'Master Data', group: 'Administration',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'         },
      { key: 'create', label: 'Create', icon: 'pi-plus-circle' },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil'      },
      { key: 'delete', label: 'Delete', icon: 'pi-trash'       },
    ],
  },
  {
    key: 'global-settings', label: 'Global Settings', group: 'Administration',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'    },
      { key: 'update', label: 'Edit',   icon: 'pi-pencil' },
    ],
  },
  // ── Analytics & Audit ────────────────────────────────────────────────────
  {
    key: 'reports', label: 'Reports', group: 'Analytics & Audit',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'      },
      { key: 'export', label: 'Export', icon: 'pi-download' },
    ],
  },
  {
    key: 'audit', label: 'Audit Logs', group: 'Analytics & Audit',
    actions: [
      { key: 'read',   label: 'View',   icon: 'pi-eye'      },
      { key: 'export', label: 'Export', icon: 'pi-download' },
    ],
  },
];

const NAV_RESOURCES = [
  { key: 'banks',        label: 'Banks'        },
  { key: 'branches',     label: 'Branches'     },
  { key: 'customers',    label: 'Customers'    },
  { key: 'loans',        label: 'Loans'        },
  { key: 'accounting',   label: 'Accounting'   },
  { key: 'master-data',  label: 'Master Data'  },
  { key: 'geography',    label: 'Geography'    },
  { key: 'currencies',   label: 'Currencies'   },
];

@Component({
  selector: 'app-role-onboard-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TranslateModule,
    DialogModule, InputTextModule,
  ],
  templateUrl: './role-onboard-modal.component.html',
})
export class RoleOnboardModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible = false;
  @Input() bankId!: string;
  @Input() roleData: any = null;

  @Output() visibleChange  = new EventEmitter<boolean>();
  @Output() onRoleSaved    = new EventEmitter<any>();

  private http         = inject(HttpClient);
  private fb           = inject(FormBuilder);
  private messageService = inject(MessageService);
  private cdr          = inject(ChangeDetectorRef);
  private authService  = inject(AuthService);
  private destroy$     = new Subject<void>();

  public isSubmitting = false;
  public isEditMode   = false;
  public roleForm!: FormGroup;

  // Expose to template
  public readonly allResources = ALL_RESOURCES;
  public readonly navResources  = NAV_RESOURCES;

  /** Resources grouped for the template */
  public get resourceGroups(): string[] {
    return [...new Set(ALL_RESOURCES.map(r => r.group))];
  }
  public resourcesInGroup(group: string): ResourceDef[] {
    return ALL_RESOURCES.filter(r => r.group === group);
  }

  ngOnInit()    { this.initForm(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible']?.currentValue === true) {
      if (this.roleData) {
        this.isEditMode = true;
        if (this.roleForm) this.populateForm(this.roleData);
      } else {
        this.isEditMode = false;
        this.roleForm?.reset();
      }
    }
  }

  private initForm() {
    // Navigation group
    const navGroup: Record<string, any> = {};
    NAV_RESOURCES.forEach(nav => { navGroup[nav.key] = [false]; });

    // Permission groups per resource — each action disabled if caller lacks it
    const permissionsConfig: Record<string, any> = {
      navigation: this.fb.group(navGroup),
    };

    ALL_RESOURCES.forEach(res => {
      const actionGroup: Record<string, any> = {};
      res.actions.forEach(act => {
        const callerHas = this.authService.hasPermission(res.key, act.key);
        actionGroup[act.key] = [{ value: false, disabled: !callerHas }];
      });
      permissionsConfig[res.key] = this.fb.group(actionGroup);
    });

    this.roleForm = this.fb.group({
      name:        ['', Validators.required],
      slug:        ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/)]],
      description: [''],
      permissions: this.fb.group(permissionsConfig),
    });
  }

  private populateForm(data: any) {
    if (!this.roleForm) return;
    this.roleForm.get('slug')?.enable();
    this.roleForm.patchValue({
      name:        data.name,
      slug:        data.role,
      description: data.description,
    });
    if (this.isEditMode) this.roleForm.get('slug')?.disable();

    if (data.permissions) {
      const permsGroup = this.roleForm.get('permissions') as FormGroup;
      Object.keys(data.permissions).forEach(resource => {
        if (permsGroup.contains(resource)) {
          permsGroup.get(resource)?.patchValue(data.permissions[resource]);
        }
      });
    }
  }

  public generateSlug() {
    const name = this.roleForm.get('name')?.value;
    if (name) {
      this.roleForm.get('slug')?.setValue(
        name.toUpperCase().trim().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
      );
    }
  }

  /** Grant or revoke all actions for a resource row */
  public toggleAllActions(resourceKey: string, grant: boolean) {
    const group = this.roleForm.get(['permissions', resourceKey]) as FormGroup;
    if (!group) return;
    Object.keys(group.controls).forEach(action => {
      const ctrl = group.get(action);
      if (ctrl && !ctrl.disabled) ctrl.setValue(grant);
    });
  }

  public closeModal() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.roleForm.reset();
  }

  public submitRole() {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    this.isSubmitting = true;
    const payload = this.roleForm.getRawValue(); // includes disabled controls

    const request$ = this.isEditMode && this.roleData?.id
      ? this.http.patch(`/roles/${this.roleData.id}`, payload)
      : this.http.post(`/roles`, payload);

    request$.pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.isSubmitting = false; this.cdr.detectChanges(); }),
    ).subscribe({
      next: (res: any) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: this.isEditMode ? 'Role updated.' : 'Role created.',
        });
        this.onRoleSaved.emit(res.data || res);
        this.closeModal();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Failed',
          detail: err.error?.message || 'Could not process role.',
        });
      },
    });
  }

  public isFieldInvalid(field: string): boolean {
    const ctrl = this.roleForm.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }
}
