import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from '../../layout/header/header.component';
import { AuthService } from '../../features/auth/auth.service';
import { Subject, takeUntil } from 'rxjs';

interface NavItem {
  label: string; route: string; icon: string;
  resource?: string; action?: string; group?: string;
  branchOnly?: boolean; noBranch?: boolean;
}

@Component({
  selector: 'app-layout', standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, HeaderComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  isSidebarCollapsed = false;
  isDarkMode = false;
  currentLayout = 'compact';
  filteredMenuItems: NavItem[] = [];

  private readonly allMenuItems: NavItem[] = [
    { label: 'NAV.DASHBOARD', route: '/dashboard', icon: 'pi-home', group: '' },
    // Branch scope
    { label: 'Branch Home',  route: '/branch/dashboard', icon: 'pi-th-large',  group: 'Branch', resource: 'customers',  branchOnly: true },
    { label: 'NAV.CUSTOMERS',route: '/branch/customers', icon: 'pi-id-card',   group: 'Branch', resource: 'customers',  branchOnly: true },
    { label: 'Accounts',     route: '/branch/accounts',  icon: 'pi-wallet',    group: 'Branch', resource: 'accounting', branchOnly: true },
    { label: 'Manage Users', route: '/users',            icon: 'pi-users',     group: 'Branch', resource: 'users',      branchOnly: true },
    // Non-branch scope
    { label: 'NAV.BANKS',      route: '/banks',      icon: 'pi-building-columns', group: 'Banking', resource: 'banks',      noBranch: true },
    { label: 'NAV.CUSTOMERS',  route: '/customers',  icon: 'pi-id-card',          group: 'Banking', resource: 'customers',  noBranch: true },
    { label: 'Manage Users',   route: '/users',      icon: 'pi-users',            group: 'Banking', resource: 'users',      noBranch: true },
    { label: 'NAV.LOANS',      route: '/loans',      icon: 'pi-file',             group: 'Banking', resource: 'loans',      noBranch: true },
    { label: 'NAV.ACCOUNTING', route: '/accounting', icon: 'pi-chart-line',       group: 'Banking', resource: 'accounting', noBranch: true },
    // Admin
    { label: 'NAV.GEOGRAPHY',   route: '/geography',   icon: 'pi-map',    group: 'Admin', resource: 'geography'   },
    { label: 'NAV.CURRENCIES',  route: '/currencies',  icon: 'pi-dollar', group: 'Admin', resource: 'currencies'  },
    { label: 'NAV.MASTER_DATA', route: '/master-data', icon: 'pi-server', group: 'Admin', resource: 'master-data' },
    { label: 'Roles',           route: '/roles',       icon: 'pi-shield', group: 'Admin', resource: 'roles'       },
    { label: 'NAV.PROFILE', route: '/profile', icon: 'pi-user', group: '' },
  ];

  ngOnInit() { this.syncUIState(); this.buildMenu(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  private syncUIState() {
    this.authService.sidebarState$.pipe(takeUntil(this.destroy$)).subscribe(s => { this.isSidebarCollapsed = s; this.cdr.markForCheck(); });
    this.authService.isDarkMode$.pipe(takeUntil(this.destroy$)).subscribe(d => { this.isDarkMode = d; this.cdr.markForCheck(); });
    this.authService.dashboardLayout$.pipe(takeUntil(this.destroy$)).subscribe(l => { this.currentLayout = l; this.cdr.markForCheck(); });
  }

  private buildMenu() {
    const user = this.authService.getUserProfile();
    const perms = user?.permissions ?? {};
    const hasBranchId = !!user?.branchId;

    this.filteredMenuItems = this.allMenuItems.filter(item => {
      if (item.branchOnly && !hasBranchId) return false;
      if (item.noBranch   &&  hasBranchId) return false;
      if (!item.resource) return true;
      const navPerms = (perms as any)['navigation'];
      if (navPerms && item.resource in navPerms) return navPerms[item.resource] === true;
      return this.authService.hasPermission(item.resource, item.action || 'read');
    });
  }

  toggleSidebar() { this.authService.setSidebarState(!this.isSidebarCollapsed); }
  toggleTheme()   { this.authService.setThemeState(!this.isDarkMode); }
}
