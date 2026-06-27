import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing-module'; // Double check if this is app-routing.module
import { ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { AppComponent } from './app'; 
import { LoanInitiationComponent } from './loan-initiation/loan-initiation';
import { SupervisorDashboardComponent } from './components/supervisor-dashboard/supervisor-dashboard';

@NgModule({
  declarations: [
    AppComponent, 
    LoanInitiationComponent
  ],
  imports: [
    BrowserModule, 
    AppRoutingModule, 
    ReactiveFormsModule,
    SupervisorDashboardComponent
  ],
  providers: [
    provideHttpClient(withFetch())
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}