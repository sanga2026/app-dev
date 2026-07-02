import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getDocumentTypes(activeOnly = true): Observable<any[]> {
    // API param: ?active=true/false  (not activeOnly)
    return this.http.get<any>(`${this.base}/master-data/document-types`, {
      params: { active: String(activeOnly) },
    }).pipe(map((res: any) => res.data ?? res ?? []));
  }

  createDocumentType(payload: any): Observable<any> {
    return this.http.post(`${this.base}/master-data/document-types`, payload);
  }

  updateDocumentType(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.base}/master-data/document-types/${id}`, payload);
  }

  toggleDocumentTypeStatus(id: string, isActive: boolean): Observable<any> {
    return this.http.patch(`${this.base}/master-data/document-types/${id}/status`, { isActive });
  }

  getNumberRanges(bankId?: string): Observable<any[]> {
    const params = bankId ? new HttpParams().set('bankId', bankId) : new HttpParams();
    return this.http.get<any>(`${this.base}/number-ranges`, { params })
      .pipe(map((res: any) => res.data ?? res ?? []));
  }

  /** Generate next formatted ID for a given sequence type */
  getNextNumber(bankId: string, type: string): Observable<string> {
    return this.http.get<any>(
      `${this.base}/number-ranges/next?type=${type}&bankId=${bankId}`
    ).pipe(map((res: any) => res.data?.nextId ?? res.nextId ?? ''));
  }
}
