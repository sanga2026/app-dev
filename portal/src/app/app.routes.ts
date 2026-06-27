import { Routes } from '@angular/router';

// 🚀 FIXED: We no longer import LoginComponent, SignupComponent, etc. at the top!
// We only import Guards and the Layout shell.
import { LayoutComponent } from './layout/main-layout/layout.component';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard'; 

export const routes: Routes = [
  // 1. 🚀 PERFORMANCE FIX: Lazy Load the Public Routes
  { 
    path: 'login', 
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard] 
  },
  { 
    path: 'signup', 
    loadComponent: () => import('./features/auth/signup/signup').then(m => m.SignupComponent),
    canActivate: [guestGuard] 
  },
  { 
    path: 'reset-password', 
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard] 
  },

  // 2. Secure Private Routes (Wrapped in LayoutComponent)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },

      // 🏦 BANKS RESOURCE
      {
        path: 'banks',
        loadComponent: () => import('./features/super-admin/banks/banks.component').then((m) => m.BanksComponent),
        canActivate: [permissionGuard],
        data: { resource: 'banks' }, 
      },
      {
        path: 'banks/:id',
        loadComponent: () => import('./features/super-admin/banks/bank-detail/bank-detail.component').then((m) => m.BankDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'banks' },
      },

      // 🏢 BRANCHES RESOURCE
      {
        path: 'banks/:bankId/branches/:branchId',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/branch-detail.component').then((m) => m.BranchDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'branches' }, 
      },

      // 👥 USERS RESOURCE (Admins & Staff)
      {
        path: 'banks/:bankId/admins/:adminId',
        loadComponent: () => import('./features/super-admin/banks/admin-detail/admin-detail.component').then((m) => m.AdminDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' }, 
      },
      {
        path: 'banks/:bankId/branches/:branchId/staff/:adminId',
        loadComponent: () => import('./features/super-admin/banks/admin-detail/admin-detail.component').then((m) => m.AdminDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' }, 
      },

      // 💰 LOANS RESOURCE
      {
        path: 'banks/:bankId/loans/:loanId',
        loadComponent: () => import('./features/super-admin/banks/loan-detail/loan-detail.component').then((m) => m.LoanDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'products' },
      },

      // 🤝 CUSTOMERS RESOURCE
      {
        path: 'banks/:bankId/branches/:branchId/customers/:customerId',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'customers' }, 
      },
      
      // 🔐 ROLES RESOURCE
      {
        path: 'banks/:bankId/roles/:roleId',
        loadComponent: () => import('./features/super-admin/banks/role-detail/role-detail.component').then(m => m.RoleDetailComponent),
        canActivate: [permissionGuard], // 🚀 SECURITY FIX: Guard applied!
        data: { resource: 'roles' }
      }
    ],
  },

  // 3. Catch-All Redirect
  { path: '**', redirectTo: '' },
];