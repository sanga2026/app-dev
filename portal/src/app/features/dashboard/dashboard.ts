import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    TranslateModule, 
    ToastModule,
    // ❌ REMOVED HeaderComponent from here
  ],
  providers: [MessageService],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {}