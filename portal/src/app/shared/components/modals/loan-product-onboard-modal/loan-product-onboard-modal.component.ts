import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core'; // 🚀 IMPORTED TRANSLATE MODULE
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../button/button.component'; 
import { HasPermissionDirective } from '../../../directives/has-permission.directive';

@Component({
  selector: 'app-loan-product-onboard-modal',
  standalone: true,
  // 🚀 ADDED TranslateModule to imports
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, DialogModule, InputTextModule, ButtonComponent,HasPermissionDirective],
  templateUrl: './loan-product-onboard-modal.component.html'
})
export class LoanProductOnboardModalComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Input() bankId!: string;
  
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onLoanCreated = new EventEmitter<any>();

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public isSubmitting = false;
  public loanForm!: FormGroup;

  // 🚀 Notice we only need the values now. The labels are handled by i18n in the HTML!
  public loanTypes = [
    'PERSONAL_LOAN', 'HOME_LOAN', 'AUTO_LOAN', 'EDUCATION_LOAN', 
    'GOLD_LOAN', 'AGRICULTURE_LOAN', 'MICROFINANCE', 'CONSUMER_DURABLE_LOAN', 
    'TERM_LOAN', 'WORKING_CAPITAL', 'TRADE_FINANCE', 'SYNDICATED_LOAN', 'BILL_DISCOUNTING'
  ];

  ngOnInit() {
    this.initForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    this.loanForm = this.fb.group({
      productName: ['', [Validators.required, Validators.pattern(/[\S]/)]], // Prevents empty space submission
      productType: ['', Validators.required],
      interestRate: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      minBalance: ['', [Validators.required, Validators.min(0)]],
      maxTenureMonths: ['', [Validators.required, Validators.min(1), Validators.max(600)]], // Standard 50-year max validation
      description: ['']
    });
  }

  public closeModal() {
    this.loanForm.reset({ productType: '' });
    this.visible = false;
    this.visibleChange.emit(false);
  }

  public submitLoan() {
    if (this.loanForm.invalid) {
      this.loanForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    const val = this.loanForm.getRawValue();

    const payload = {
      productCode: val.productType,
      productName: val.productName.trim(),
      interestRate: Number(val.interestRate),
      minBalance: Number(val.minBalance),
      maxTenureMonths: Math.floor(Number(val.maxTenureMonths)), // Ensure whole numbers
      description: val.description?.trim() || null
    };

    this.http.post(`/banks/${this.bankId}/loans`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { 
        this.isSubmitting = false; 
        this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: (res: any) => {
          // Toast handled by parent, or we can leave it here if preferred. Let's keep it consistent.
          this.onLoanCreated.emit(res.data || res); 
          this.closeModal();
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to create product' })
      });
  }

  public isFieldInvalid(field: string): boolean {
    const ctrl = this.loanForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}