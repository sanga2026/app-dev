import { Component, Input, Output, EventEmitter, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { AppValidators } from '../../../../../../core/utils/validators.util';
import { ConfirmModalComponent } from '../../../../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { ButtonComponent }       from '../../../../../../shared/components/modals/button/button.component';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
@Component({
  selector: 'app-bank-general',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ConfirmModalComponent,ButtonComponent,HasPermissionDirective],
  templateUrl: './bank-general.component.html'
})
export class BankGeneralComponent implements OnInit {
  @Input() bank: any;
  @Input() currentLayout: string = 'standard';
  @Output() refreshData = new EventEmitter<void>(); // 🚀 Tells parent to refresh if needed

  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router = inject(Router);
  
  private destroy$ = new Subject<void>();

  public isEditingBank: boolean = false;
  public isSavingBank: boolean = false;
  public isDeletingBank: boolean = false;
  public showDeleteBankModal: boolean = false;
  public editBankForm!: FormGroup;

  ngOnInit() {
    this.editBankForm = this.fb.group({
      category: ['', Validators.required],
      hqEmail: ['', [Validators.required, Validators.pattern(AppValidators.EMAIL_REGEX)]],
      hqPhone: ['', [Validators.required]],
      addressLine1: ['', Validators.required],
      addressLine2: [''],
      city: ['', Validators.required],
      state: ['', Validators.required],
      postalCode: ['', [Validators.required, Validators.pattern(AppValidators.POSTAL_CODE_REGEX)]]
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public toggleEditBankMode() {
    this.editBankForm.patchValue({
      category: this.bank.metadata?.category || 'Private Sector',
      hqEmail: this.bank.hqEmail,
      hqPhone: this.bank.hqPhone,
      addressLine1: this.bank.addressLine1,
      addressLine2: this.bank.addressLine2,
      city: this.bank.city,
      state: this.bank.state,
      postalCode: this.bank.postalCode
    });
    this.isEditingBank = true;
  }

  public cancelEditBankMode() {
    this.isEditingBank = false;
  }

  public saveBankDetails() {
    if (this.editBankForm.invalid) {
      this.editBankForm.markAllAsTouched();
      return;
    }
    this.isSavingBank = true;
    const vals = this.editBankForm.getRawValue();

    const payload = {
      hqEmail: vals.hqEmail.trim(), hqPhone: vals.hqPhone.trim(),
      addressLine1: vals.addressLine1.trim(), addressLine2: vals.addressLine2?.trim() || null,
      city: vals.city.trim(), state: vals.state.trim(), postalCode: vals.postalCode.trim(),
      metadata: { ...this.bank.metadata, category: vals.category }
    };

    this.http.patch(`/banks/${this.bank.id}/update`, payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isSavingBank = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res: any) => {
          this.messageService.add({ severity: 'success', summary: 'Success', detail: res.message || 'Tenant details updated.' });
          this.refreshData.emit(); // Tell parent to fetch fresh data
          this.isEditingBank = false;
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public confirmDeleteBank() { this.showDeleteBankModal = true; }

  public executeDeleteBank() {
    this.isDeletingBank = true;
    this.http.delete(`/banks/${this.bank.id}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeletingBank = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Terminated', detail: 'Tenant deleted.' });
          this.showDeleteBankModal = false;
          setTimeout(() => this.router.navigate(['/banks']), 1000);
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message })
      });
  }

  public isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const control = form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
    
}