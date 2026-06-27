// operational-console/src/app/core-vault-api.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

// Interfaces remain the same for strict typing
export interface CreateLoanApplicationDto {
  loanType: string;
  requestedAmount: number;
  interestRate: number;
  termInMonths: number;
  bankId: string;
  branchId: string;
}

export interface LoanApplicationEntity {
  id: string;
  status: string;
  requestedAmount: number;
  loanType: string;
}

@Injectable({
  providedIn: 'root'
})
export class CoreVaultApiService {
  // Logic: Centralized API configuration
  private readonly API_BASE_URL = 'http://localhost:3000';

  constructor(private readonly http: HttpClient) {}

  initiateLoanApplication(loanApplicationData: CreateLoanApplicationDto): Observable<LoanApplicationEntity> {
    // Logic: Ensure the path matches the Controller ('loans/onboarding') + Method ('initiate')
    const url = `${this.API_BASE_URL}/loans/onboarding/initiate`;

    console.log('🚀 Vault Dispatch: Sending loan application to:', url);
    console.log('📦 Payload:', loanApplicationData);

    // Standard headers for JSON communication
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    return this.http.post<LoanApplicationEntity>(url, loanApplicationData, { headers }).pipe(
      tap(response => console.log('✅ Vault Response Received:', response))
    );
  }
}