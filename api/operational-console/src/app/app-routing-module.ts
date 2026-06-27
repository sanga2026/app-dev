import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoanInitiationComponent } from './loan-initiation/loan-initiation';
import { SupervisorDashboardComponent } from './components/supervisor-dashboard/supervisor-dashboard';

const routes: Routes = [
  { path: '', redirectTo: 'initiate', pathMatch: 'full' },
  { path: 'initiate', component: LoanInitiationComponent },
  { path: 'approvals', component: SupervisorDashboardComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule] // CRITICAL: This unlocks <router-outlet> for the HTML
})
export class AppRoutingModule { }