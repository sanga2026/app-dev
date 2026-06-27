import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../features/auth/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  // --- User Data Variables ---
  currentUser: any = null;
  userInitials: string = '??';

  ngOnInit() {
    this.loadUser();
  }

  loadUser() {
    this.currentUser = this.authService.getUserProfile();
    
    if (this.currentUser) {
      const fName = this.currentUser.firstName || '';
      const lName = this.currentUser.lastName || '';
      
      if (fName && lName) {
         this.userInitials = (fName.charAt(0) + lName.charAt(0)).toUpperCase();
      } else if (this.currentUser.fullName) {
         this.userInitials = this.currentUser.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
      }

      this.currentUser.role = this.currentUser.roleName || this.currentUser.role || 'Unknown Role';
    }
  }

  // 🚀 Direct Navigation! No dropdowns needed.
  goToProfile() {
    this.router.navigate(['/profile']);
  }
}