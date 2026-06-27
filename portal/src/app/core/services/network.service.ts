import { Injectable, PLATFORM_ID, inject, NgZone } from '@angular/core'; // 🚀 Import NgZone
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone); // 🚀 Inject NgZone
  
  private isOnlineSubject = new BehaviorSubject<boolean>(
    isPlatformBrowser(this.platformId) ? navigator.onLine : true
  );
  
  public isOnline$: Observable<boolean> = this.isOnlineSubject.asObservable();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.monitorNetwork();
    }
  }

  private monitorNetwork() {
    window.addEventListener('online', () => {
      // 🚀 Force Angular to detect the change
      this.ngZone.run(() => {
        this.isOnlineSubject.next(true);
        console.log('🌐 Connection Restored');
      });
    });

    window.addEventListener('offline', () => {
      // 🚀 Force Angular to detect the change
      this.ngZone.run(() => {
        this.isOnlineSubject.next(false);
        console.error('🚫 Connection Lost');
      });
    });
  }

  get isOnline(): boolean {
    return this.isOnlineSubject.value;
  }
}