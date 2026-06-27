import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false, // Ensures it uses AppModule logic
  templateUrl: './app.html'
})
export class AppComponent {
  title = 'operational-console';
  
  // LOGIC FIX: Resolves the TS2339 error
  userRole: string = 'Authorized Bank Clerk';
}