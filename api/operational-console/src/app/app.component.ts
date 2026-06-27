import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true, // This MUST be true to fix the NG0907 error
  imports: [RouterOutlet], // Allows the app to switch between screens
  template: `
    <div class="app-shell">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .app-shell { 
      padding: 20px; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    }
  `]
})
export class AppComponent {}