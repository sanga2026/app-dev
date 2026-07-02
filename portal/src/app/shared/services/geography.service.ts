import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Country, State, Town, Village } from '../models/geography.model';

@Injectable({ providedIn: 'root' })
export class GeographyService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/geography`;

  private countriesCache$?: Observable<Country[]>;

  getCountries(activeOnly = true): Observable<Country[]> {
    if (!this.countriesCache$) {
      const params = new HttpParams().set('activeOnly', String(activeOnly));
      this.countriesCache$ = this.http
        .get<Country[]>(`${this.base}/countries`, { params })
        .pipe(shareReplay(1));
    }
    return this.countriesCache$;
  }

  getStates(countryCode: string, activeOnly = true): Observable<State[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<State[]>(`${this.base}/countries/${countryCode}/states`, { params });
  }

  getTowns(stateId: string, activeOnly = true): Observable<Town[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<Town[]>(`${this.base}/states/${stateId}/towns`, { params });
  }

  getVillages(townId: string, activeOnly = true): Observable<Village[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<Village[]>(`${this.base}/towns/${townId}/villages`, { params });
  }

  createCountry(payload: Partial<Country>): Observable<Country> {
    return this.http.post<Country>(`${this.base}/countries`, payload);
  }

  updateCountry(code: string, payload: Partial<Country>): Observable<Country> {
    return this.http.patch<Country>(`${this.base}/countries/${code}`, payload);
  }

  createState(countryCode: string, payload: Partial<State>): Observable<State> {
    return this.http.post<State>(`${this.base}/countries/${countryCode}/states`, payload);
  }

  updateState(id: string, payload: Partial<State>): Observable<State> {
    return this.http.patch<State>(`${this.base}/states/${id}`, payload);
  }

  createTown(stateId: string, payload: Partial<Town>): Observable<Town> {
    return this.http.post<Town>(`${this.base}/states/${stateId}/towns`, payload);
  }

  updateTown(id: string, payload: Partial<Town>): Observable<Town> {
    return this.http.patch<Town>(`${this.base}/towns/${id}`, payload);
  }

  createVillage(townId: string, payload: Partial<Village>): Observable<Village> {
    return this.http.post<Village>(`${this.base}/towns/${townId}/villages`, payload);
  }

  updateVillage(id: string, payload: Partial<Village>): Observable<Village> {
    return this.http.patch<Village>(`${this.base}/villages/${id}`, payload);
  }

  clearCountriesCache(): void {
    this.countriesCache$ = undefined;
  }
}
