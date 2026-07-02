import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Currency } from '../models/currency.model';

@Injectable({ providedIn: 'root' })
export class CurrenciesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/currencies`;

  private cache$?: Observable<Currency[]>;

  getAll(activeOnly = true): Observable<Currency[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<Currency[]>(this.base, { params: { activeOnly: String(activeOnly) } })
        .pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getOne(code: string): Observable<Currency> {
    return this.http.get<Currency>(`${this.base}/${code}`);
  }

  create(payload: Partial<Currency>): Observable<Currency> {
    this.clearCache();
    return this.http.post<Currency>(this.base, payload);
  }

  update(code: string, payload: Partial<Currency>): Observable<Currency> {
    this.clearCache();
    return this.http.patch<Currency>(`${this.base}/${code}`, payload);
  }

  clearCache(): void {
    this.cache$ = undefined;
  }
}
