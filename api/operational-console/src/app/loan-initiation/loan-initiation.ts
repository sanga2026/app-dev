import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CoreVaultApiService, CreateLoanApplicationDto } from '../core-vault-api.service';

@Component({
  selector: 'app-loan-initiation',
  standalone: false,
  templateUrl: './loan-initiation.html',
  styleUrls: ['./loan-initiation.scss']
})
export class LoanInitiationComponent implements OnInit {
  loanForm!: FormGroup;
  isProcessing = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder, 
    private apiService: CoreVaultApiService
  ) {}

  ngOnInit(): void {
   this.loanForm = this.fb.group({
    loanType: ['PERSONAL', Validators.required], // Start with PERSONAL selected
    requestedAmount: [1500, [Validators.required, Validators.min(1000)]], // Start with 1500
    interestRate: [7.5, Validators.required],
    termInMonths: [12, Validators.required],
    bankId: ['test_bank_001', Validators.required],
    branchId: ['hq_branch', Validators.required]
  });
  }

  onSubmitLoan() {
    console.log('Button clicked!');
    if (this.loanForm.valid) {
      this.isProcessing = true;
      this.successMessage = '';
      this.errorMessage = '';

      const payload: CreateLoanApplicationDto = this.loanForm.value;

      this.apiService.initiateLoanApplication(payload).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.successMessage = `Successfully Initiated! ID: ${res.id}`;
          this.loanForm.reset({ 
            interestRate: 7.5, 
            termInMonths: 12, 
            bankId: 'test_bank_001', 
            branchId: 'hq_branch' 
          });
        },
        error: (err) => {
          this.isProcessing = false;
          this.errorMessage = 'Transmission failed. Check if NestJS API is running on Port 3000.';
          console.error('Handshake Error:', err);
        }
      });
    }
  }
}