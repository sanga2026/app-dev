import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../features/auth/auth.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    TranslateModule,
    HeaderComponent
  ],
  templateUrl: './layout.component.html'
})
export class LayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  
  private destroy$ = new Subject<void>(); 

  isSidebarCollapsed = false;
  isDarkMode = false;
  currentLayout = 'compact';
  
  filteredMenuItems: any[] = [];

  // 🚀 REFACTORED: We now map to the 'navigation' UI flags instead of data resources
  private readonly allMenuItems = [
    { label: 'NAV.DASHBOARD', route: '/dashboard', icon: 'pi-home', navKey: null }, 
    { label: 'NAV.BANKS', route: '/banks', icon: 'pi-building-columns', navKey: 'banks' },
    { label: 'NAV.CUSTOMERS', route: '/customers', icon: 'pi-users', navKey: 'customers' },
    { label: 'NAV.LOANS', route: '/loans', icon: 'pi-wallet', navKey: 'loans' },
    { label: 'NAV.ACCOUNTING', route: '/accounting', icon: 'pi-chart-line', navKey: 'accounting' },
    { label: 'NAV.BRANCHES', route: '/branches', icon: 'pi-map-marker', navKey: 'branches' },
    { label: 'NAV.MASTER_DATA', route: '/master-data', icon: 'pi-server', navKey: 'master-data' }
  ];

  ngOnInit() {
    this.syncUIState();
    this.generateMenuByPermissions(); 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncUIState() {
    this.authService.sidebarState$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.isSidebarCollapsed = state;
      this.cdr.markForCheck();
    });

    this.authService.isDarkMode$.pipe(takeUntil(this.destroy$)).subscribe(isDark => {
      this.isDarkMode = isDark;
      this.cdr.markForCheck();
    });

    this.authService.dashboardLayout$.pipe(takeUntil(this.destroy$)).subscribe(layout => {
      this.currentLayout = layout;
      this.cdr.markForCheck();
    });
  }

  /**
   * 🛡️ PERMISSION-BASED Menu Generation
   * Now evaluates the 'navigation' object in the matrix rather than CRUD rights.
   */
  private generateMenuByPermissions() {
    this.filteredMenuItems = this.allMenuItems.filter(item => {
      // 1. Always show un-guarded items like the Dashboard
      if (!item.navKey) return true;

      // 2. 🚀 Check the specific navigation flag (e.g., matrix['navigation']['customers'])
      // Assuming your hasPermission signature is (resource, action/key)
      return this.authService.hasPermission('navigation', item.navKey);
    });
  }

  toggleSidebar() {
    this.authService.setSidebarState(!this.isSidebarCollapsed); 
  }

  toggleTheme() {
    this.authService.setThemeState(!this.isDarkMode); 
  }
}