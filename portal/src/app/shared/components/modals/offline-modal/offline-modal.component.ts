import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NetworkService } from '../../../../core/services/network.service'; 
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-offline-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div *ngIf="isOffline" 
         class="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/70 backdrop-blur-md transition-all duration-300">
      
      <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 text-center border border-gray-100 dark:border-gray-700">
        
        <div class="relative w-24 h-24 mx-auto mb-6 flex justify-center items-center bg-red-50 dark:bg-red-900/20 rounded-full">
          <i class="pi pi-wifi text-4xl text-red-500 animate-pulse"></i>
          <div class="absolute w-12 h-1 bg-red-500 transform rotate-45 rounded-full"></div>
        </div>

        <h2 class="text-2xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
          Connection Lost
        </h2>
        
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
          We cannot detect an active internet connection. Don't worry, your data is safe. The application will automatically resume once your connection is restored.
        </p>

        <div class="flex items-center justify-center gap-3 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 py-3 px-4 rounded-xl">
          <i class="pi pi-spin pi-spinner text-lg"></i> Waiting for network...
        </div>
        
      </div>
    </div>
  `
})
export class OfflineModalComponent implements OnInit, OnDestroy {
  private networkService = inject(NetworkService);
  private cdr = inject(ChangeDetectorRef); // 🚀 Inject the Change Detector
  private sub!: Subscription;

  public isOffline = false;

  ngOnInit() {
    this.sub = this.networkService.isOnline$.subscribe(isOnline => {
      this.isOffline = !isOnline;
      // 🚀 THE SLEDGEHAMMER: Force Angular to redraw the screen immediately
      this.cdr.detectChanges(); 
    });
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }
}