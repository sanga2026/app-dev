import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

// 🚀 FIXED: Added TranslateModule
import { TranslateModule } from '@ngx-translate/core'; 

import { AppValidators } from '../../../../../../core/utils/validators.util';
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { DialogModule } from 'primeng/dialog';

// 🚀 FIXED: Imported the PBAC Directive
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive'; 

@Component({
  selector: 'app-admin-general',
  standalone: true,
  // 🚀 FIXED: Registered the missing modules in the imports array
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    TranslateModule, 
    DialogModule, 
    ButtonComponent, 
    HasPermissionDirective
  ],
  templateUrl: './admin-general.component.html'
})
export class AdminGeneralComponent implements OnInit, OnChanges, OnDestroy {
  @Input() adminUser: any = null;
  @Input() bankId!: string;
  @Output() refreshData = new EventEmitter<void>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  public isEditing = false;
  public isSaving = false;
  public isDeleting = false;
  public showDeleteModal = false;
  
  public editForm!: FormGroup;
  public availableRoles: any[] = [];
  public isLoadingRoles = false;

  ngOnInit() {
    this.initForm();
    this.fetchRoles();
  }

  // Safely detect when parent passes new data
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
      firstName: ['', [Validators.required, Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      middleName: ['', [Validators.pattern(AppValidators.FIRST_NAME_REGEX)]],
      lastName: ['', [Validators.required, Validators.pattern(AppValidators.LAST_NAME_REGEX)]],
      phone: ['', [Validators.required, Validators.pattern(AppValidators.MOBILE_REGEX)]],
      role: ['', Validators.required],
    });
  }

  private fetchRoles() {
    this.isLoadingRoles = true;
    this.http.get<any>('/roles')
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoadingRoles = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => { this.availableRoles = res.data || res || []; }
      });
  }

  public toggleEditMode() {
    this.isEditing = true;
    this.populateForm();
  }

  private populateForm() {
    if (!this.adminUser) return;
    
    let pNumber = this.adminUser.phoneNumber || this.adminUser.phone || '';
    if (pNumber.startsWith('+91')) { 
      pNumber = pNumber.substring(3); // Strip prefix for clean edit view
    }

    this.editForm.patchValue({
      firstName: this.adminUser.firstName || '',
      middleName: this.adminUser.middleName || '',
      lastName: this.adminUser.lastName || '',
      phone: pNumber,
      role: this.adminUser.role?.role || this.adminUser.roleType || '',
    });
  }

  public cancelEditMode() { 
    this.isEditing = false; 
    this.editForm.reset();
  }

  public saveDetails() {
    if (this.editForm.invalid) { this.editForm.markAllAsTouched(); return; }
    
    this.isSaving = true;
    const vals = this.editForm.getRawValue();

    const payload = {
      firstName: vals.firstName.trim(),
      middleName: vals.middleName?.trim() || null,
      lastName: vals.lastName.trim(),
      phoneNumber: `+91${vals.phone.trim()}`, // Inject prefix back in safely
      roleType: vals.role
    };

    this.http.patch(`/banks/${this.bankId}/users/${this.adminUser.id}/update`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res:any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail:  res.message || 'Profile updated.' });
          this.isEditing = false;
          this.refreshData.emit(); // Tell parent to fetch fresh data
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Update failed' })
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
          // Navigate back to the bank's admins list
          setTimeout(() => this.router.navigate(['/banks', this.bankId]), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Deletion failed' })
      });
  }

  public isFieldInvalid(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}