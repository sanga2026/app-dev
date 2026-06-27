import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';

import { ButtonComponent } from '../../../../shared/components/modals/button/button.component';
import { ConfirmModalComponent } from '../../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { ToastModule } from 'primeng/toast';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-loan-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    RouterLink,
    ButtonComponent,
    ConfirmModalComponent,
    ToastModule,
    TranslateModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './loan-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public loanId!: string;
  public loan: any = null;
  
  public isLoading: boolean = true;
  public currentLayout: string = 'standard';

  // Form & Interaction State
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
    this.initForm();

    this.authService.dashboardLayout$?.pipe(takeUntil(this.destroy$)).subscribe((layout) => {
      this.currentLayout = layout || 'standard';
      this.cdr.markForCheck();
    });

    this.bankId = this.route.snapshot.paramMap.get('bankId') || '';
    this.loanId = this.route.snapshot.paramMap.get('loanId') || '';

    if (this.bankId && this.loanId) {
      this.fetchLoanDetails();
    } else {
      this.handleError('Invalid navigation parameters.');
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.editForm = this.fb.group({
      productName: ['', Validators.required],
      interestRate: ['', [Validators.required, Validators.min(0)]],
      minBalance: ['', [Validators.required, Validators.min(0)]],
      maxTenureMonths: ['', [Validators.required, Validators.min(1)]],
      description: ['']
    });
  }

  public fetchLoanDetails() {
    this.isLoading = true;
    this.cdr.markForCheck(); 

    this.http.get<any>(`/banks/${this.bankId}/loans/${this.loanId}`)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => { 
          this.loan = res.data ? res.data : res;
          if (this.isEditing) this.populateForm();
          this.cdr.markForCheck(); 
        },
        error: (err) => {
          console.error('Loan fetch error:', err);
          this.handleError('Failed to load product details.');
        },
      });
  }

  private handleError(message: string) {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
    if (this.bankId) {
        this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'loans' } });
    } else {
        this.router.navigate(['/dashboard']);
    }
  }

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

    this.http.patch(`/banks/${this.bankId}/loans/${this.loanId}`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSaving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Product updated.' });
          this.fetchLoanDetails(); // Refresh the data
          this.isEditing = false;
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Update failed' })
      });
  }

  public confirmDelete() { 
    this.showDeleteModal = true; 
  }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/banks/${this.bankId}/loans/${this.loanId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Product permanently removed.' });
          this.showDeleteModal = false;
          setTimeout(() => this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'loans' } }), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Deletion failed' })
      });
  }

  public isFieldInvalid(fieldName: string): boolean {
    const control = this.editForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}