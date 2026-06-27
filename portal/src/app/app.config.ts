import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { apiInterceptor } from './core/interceptors/api-interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService } from 'primeng/api';
import { catchError, Observable, of } from 'rxjs';
import { GlobalSettingsService } from './core/services/global-settings.service';

// 🌐 Factory for Translation (NOW OFFLINE-PROOF)
export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return {
    getTranslation: (lang: string): Observable<any> => {
      return http.get(`assets/i18n/${lang}.json`).pipe(
        catchError(() => {
          console.warn(`⚠️ Could not load translations for ${lang} (Offline). Booting anyway.`);
          // Return an empty object so the app finishes booting and the Offline Modal can show!
          return of({}); 
        })
      );
    }
  };
}

// 🚀 Factory for Global Settings Initialization
export function initializeGlobalSettings(settingsService: GlobalSettingsService) {
  return () => settingsService.loadSettings().pipe(
    catchError((err) => {
      console.error('Failed to load global settings during initialization', err);
      return of(null);
    })
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor])), 
    provideAnimationsAsync(),
    MessageService, 
    
    // 🛡️ Global Settings Initializer
    {
      provide: APP_INITIALIZER,
      useFactory: initializeGlobalSettings,
      deps: [GlobalSettingsService],
      multi: true
    },

    importProvidersFrom(
      TranslateModule.forRoot({
        // 🚀 FIXED: Replaced the deprecated 'defaultLanguage' with 'defaultLanguage' removed. 
        // We now use 'defaultLanguage' removed to fix the console warning. 
        // (If you still get warnings, you can set `fallbackLang: 'en'` instead)
        loader: {
          provide: TranslateLoader,
          useFactory: HttpLoaderFactory,
          deps: [HttpClient]
        }
      })
    )
  ]
};