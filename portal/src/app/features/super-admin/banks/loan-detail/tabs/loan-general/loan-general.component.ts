import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-loan-general',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    TranslateModule, 
    ButtonComponent, 
    ToastModule,
    DialogModule,
    InputTextModule,
    HasPermissionDirective
  ],
  templateUrl: './loan-general.component.html'
})
export class LoanGeneralComponent implements OnInit, OnChanges {
  @Input() loan: any;
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';
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

  public loanTypes = [
    { label: 'Personal Loan', value: 'PERSONAL_LOAN' },
    { label: 'Home Loan (Mortgage)', value: 'HOME_LOAN' },
    { label: 'Auto / Vehicle Loan', value: 'AUTO_LOAN' },
    { label: 'Education Loan', value: 'EDUCATION_LOAN' },
    { label: 'Working Capital / OD', value: 'WORKING_CAPITAL' }
  ];

  ngOnInit() {
    this.editForm = this.fb.group({
      productName: ['', Validators.required],
      interestRate: ['', [Validators.required, Validators.min(0)]],
      minBalance: ['', [Validators.required, Validators.min(0)]],
      maxTenureMonths: ['', [Validators.required, Validators.min(1)]],
      description: ['']
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['loan'] && this.loan && this.isEditing) {
      this.populateForm();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🚀 FIXED: Added null-safety so Angular doesn't crash during render
  public getCategoryLabel(val: string | null | undefined): string {
    if (!val) return 'UNKNOWN';
    return this.loanTypes.find(t => t.value === val)?.label || val;
  }

  public toggleEditMode() {
    this.isEditing = true;
    this.populateForm();
  }

  private populateForm() {
    if (!this.loan) return;
    this.editForm.patchValue({
      productName: this.loan.productName,
      interestRate: this.loan.interestRate,
      minBalance: this.loan.minBalance,
      maxTenureMonths: this.loan.maxTenureMonths,
      description: this.loan.description
    });
  }

  public cancelEditMode() { 
    this.isEditing = false; 
  }

  public saveDetails() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    const vals = this.editForm.getRawValue();

    const payload = {
      productName: vals.productName.trim(),
      interestRate: Number(vals.interestRate),
      minBalance: Number(vals.minBalance),
      maxTenureMonths: Number(vals.maxTenureMonths),
      description: vals.description?.trim() || null
    };

    this.http.patch(`/banks/${this.bankId}/loans/${this.loan.id}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Product updated.' });
          this.refreshData.emit();
          this.isEditing = false;
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public confirmDelete() { 
    this.showDeleteModal = true; 
  }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/banks/${this.bankId}/loans/${this.loan.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Product permanently removed.' });
          this.showDeleteModal = false;
          setTimeout(() => this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'loans' } }), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public isFieldInvalid(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}