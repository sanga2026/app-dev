import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OfflineModalComponent } from './shared/components/modals/offline-modal/offline-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, OfflineModalComponent, ToastModule],
  providers: [MessageService],
  templateUrl: './app.html',
})
export class AppComponent { 
  constructor() {
    const translate = inject(TranslateService);
    
    // 🚀 Register languages and FORCE the initial download
    translate.addLangs(['en', 'kn', 'hi']);
    translate.setDefaultLang('en');
    translate.use('en'); 
  }
}