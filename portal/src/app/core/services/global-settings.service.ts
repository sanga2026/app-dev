// src/app/core/services/global-settings.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GlobalSettingsService {
  private readonly apiUrl = `${environment.apiUrl}/global-settings`;
  
  // 🧠 The "Source of Truth" cache
  private settingsSubject = new BehaviorSubject<Record<string, any> | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * 🚀 Load Settings: Called by APP_INITIALIZER on startup.
   * Hacker-Free: Uses tap to update the cache so components don't have to call HTTP.
   */
  loadSettings(): Observable<any> {
    return this.http.get<any>(this.apiUrl).pipe(
      tap(response => {
        if (response.success) {
          this.settingsSubject.next(response.data);
        }
      })
    );
  }

  /**
   * 🎯 Synchronous Helper: Get a value directly if you know the cache is loaded.
   */
  getSetting(key: string): any {
    const current = this.settingsSubject.value;
    return current ? current[key] : null;
  }

  /**
   * 🛡️ Force Refresh: Call this after a Super Admin updates a setting.
   */
  refreshSettings(): void {
    this.loadSettings().subscribe();
  }
}