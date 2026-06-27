import { Routes } from '@angular/router';
import { LoanInitiationComponent } from './loan-initiation/loan-initiation';
import { SupervisorDashboardComponent } from './components/supervisor-dashboard/supervisor-dashboard';

export const routes: Routes = [
  { path: 'initiate', component: LoanInitiationComponent },
  { path: '', redirectTo: 'initiate', pathMatch: 'full' },
  
  { path: 'approvals', component: SupervisorDashboardComponent },
  // Optional: Redirect the base path to approvals for testing
  { path: '', redirectTo: '/approvals', pathMatch: 'full' }
];