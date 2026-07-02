import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Bank, BankOnboardPayload } from '../models/bank.model';

@Injectable({ providedIn: 'root' })
export class BanksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/banks`;

  getAll(params?: { search?: string; isActive?: boolean }): Observable<Bank[]> {
    let httpParams = new HttpParams();
    if (params?.search)    httpParams = httpParams.set('search', params.search);
    if (params?.isActive !== undefined) httpParams = httpParams.set('isActive', String(params.isActive));
    return this.http.get<Bank[]>(this.base, { params: httpParams });
  }

  getOne(id: string): Observable<Bank> {
    return this.http.get<Bank>(`${this.base}/${id}`);
  }

  create(payload: BankOnboardPayload): Observable<Bank> {
    return this.http.post<Bank>(this.base, payload);
  }

  update(id: string, payload: Partial<BankOnboardPayload>): Observable<Bank> {
    return this.http.patch<Bank>(`${this.base}/${id}`, payload);
  }

  toggleStatus(id: string, isActive: boolean): Observable<Bank> {
    return this.http.patch<Bank>(`${this.base}/${id}/status`, { isActive });
  }
}
