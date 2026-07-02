import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  getStats(): Observable<Record<string, any>> {
    return this.http.get<Record<string, any>>(`${environment.apiUrl}/dashboard/stats`);
  }
}
