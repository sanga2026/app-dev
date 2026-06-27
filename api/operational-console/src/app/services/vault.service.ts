import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root' // This makes the service available everywhere in your app
})
export class VaultService {
  private readonly apiUrl = 'http://localhost:3000/loans/onboarding';

  constructor(private http: HttpClient) {}

  // Logic: Send the new loan request to the Maker-Checker vault
  initiateLoan(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/initiate`, data);
  }

  // Logic: Fetch pending loans for the Supervisor (The Checker)
 getPendingLoans(): Observable<any[]> {
    console.log('📡 VaultService: Attempting to fetch from', `${this.apiUrl}/pending`);
    return this.http.get<any[]>(`${this.apiUrl}/pending`);
  }
}