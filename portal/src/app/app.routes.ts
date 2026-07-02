import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/main-layout/layout.component';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { branchGuard } from './core/guards/branch.guard';

export const routes: Routes = [
  // ─── Public (guest-only) ──────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then(m => m.SignupComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard],
  },

  // ─── Protected (auth required) ───────────────────────────────────────────
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Dashboard (role-scoped — shows branch panel for branch users automatically)
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },

      // Profile
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
      },

      // Access denied — shown when permissionGuard blocks a route
      {
        path: 'unauthorized',
        loadComponent: () => import('./features/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
      },

      // ─── BRANCH STAFF / MANAGER PANEL (PBAC-gated, no hardcoded roles) ────
      {
        path: 'branch/dashboard',
        loadComponent: () => import('./features/branch/branch-dashboard/branch-dashboard.component').then(m => m.BranchDashboardComponent),
        canActivate: [authGuard, branchGuard],
      },
      {
        path: 'branch/customers',
        loadComponent: () => import('./features/branch/branch-customers/branch-customers.component').then(m => m.BranchCustomersComponent),
        canActivate: [authGuard, permissionGuard],
        data: { resource: 'customers' },
      },
      {
        path: 'branch/customers/:customerId',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
        canActivate: [authGuard, permissionGuard],
        data: { resource: 'customers' },
      },
      {
        path: 'branch/accounts',
        loadComponent: () => import('./features/branch/branch-accounts/branch-accounts.component').then(m => m.BranchAccountsComponent),
        canActivate: [authGuard, permissionGuard],
        data: { resource: 'accounting' },
      },
      {
        path: 'branch/staff',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/tabs/branch-users/branch-staff.component').then(m => m.BranchStaffComponent),
        canActivate: [authGuard, permissionGuard],
        data: { resource: 'users' },
      },

      // ─── BANKS ────────────────────────────────────────────────────────────
      {
        path: 'banks',
        loadComponent: () => import('./features/super-admin/banks/banks.component').then(m => m.BanksComponent),
        canActivate: [permissionGuard],
        data: { resource: 'banks' },
      },
      {
        path: 'banks/:id',
        loadComponent: () => import('./features/super-admin/banks/bank-detail/bank-detail.component').then(m => m.BankDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'banks' },
      },

      // ─── BRANCHES ─────────────────────────────────────────────────────────
      {
        path: 'banks/:bankId/branches/:branchId',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/branch-detail.component').then(m => m.BranchDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'branches' },
      },

      // ─── USERS / ADMINS / STAFF ───────────────────────────────────────────
      {
        path: 'banks/:bankId/admins/:adminId',
        loadComponent: () => import('./features/super-admin/banks/admin-detail/admin-detail.component').then(m => m.AdminDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' },
      },
      {
        path: 'banks/:bankId/branches/:branchId/staff/:adminId',
        loadComponent: () => import('./features/super-admin/banks/admin-detail/admin-detail.component').then(m => m.AdminDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' },
      },

      // ─── LOAN PRODUCTS ────────────────────────────────────────────────────
      {
        path: 'banks/:bankId/loans/:loanId',
        loadComponent: () => import('./features/super-admin/banks/loan-detail/loan-detail.component').then(m => m.LoanDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'loan-products' },
      },

      // ─── CUSTOMERS ────────────────────────────────────────────────────────
      {
        path: 'banks/:bankId/branches/:branchId/customers/:customerId',
        loadComponent: () => import('./features/super-admin/banks/branch-detail/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'customers' },
      },

      // ─── MANAGE USERS (global — scoped by JWT automatically) ─────────────
      {
        path: 'users',
        loadComponent: () => import('./features/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' },
      },
      // System user detail (super admin / no bank context)
      {
        path: 'users/:adminId',
        loadComponent: () => import('./features/super-admin/banks/admin-detail/admin-detail.component').then(m => m.AdminDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'users' },
      },

      // ─── ROLES ────────────────────────────────────────────────────────────
      {
        path: 'banks/:bankId/roles/:roleId',
        loadComponent: () => import('./features/super-admin/banks/role-detail/role-detail.component').then(m => m.RoleDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'roles' },
      },
      // Global roles list (super admin)
      {
        path: 'roles',
        loadComponent: () => import('./features/super-admin/roles/roles.component').then(m => m.RolesComponent),
        canActivate: [permissionGuard],
        data: { resource: 'roles' },
      },
      // Global role detail (for system roles without bankId)
      {
        path: 'roles/:roleId',
        loadComponent: () => import('./features/super-admin/banks/role-detail/role-detail.component').then(m => m.RoleDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'roles' },
      },

      // ─── ACCOUNT PRODUCTS ─────────────────────────────────────────────────
      {
        path: 'banks/:bankId/account-products/:productId',
        loadComponent: () => import('./features/super-admin/banks/account-product-detail/account-product-detail.component').then(m => m.AccountProductDetailComponent),
        canActivate: [permissionGuard],
        data: { resource: 'banks' },
      },

      // ─── MASTER DATA ──────────────────────────────────────────────────────
      {
        path: 'master-data',
        loadComponent: () => import('./features/super-admin/master-data/master-data.component').then(m => m.MasterDataComponent),
        canActivate: [permissionGuard],
        data: { resource: 'master-data' },
      },
      {
        path: 'geography',
        loadComponent: () => import('./features/super-admin/geography/geography.component').then(m => m.GeographyComponent),
        canActivate: [permissionGuard],
        data: { resource: 'geography' },
      },

      // ─── CURRENCIES ───────────────────────────────────────────────────────
      {
        path: 'currencies',
        loadComponent: () => import('./features/super-admin/currencies/currencies.component').then(m => m.CurrenciesComponent),
        canActivate: [permissionGuard],
        data: { resource: 'currencies' },
      },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: '' },
];
