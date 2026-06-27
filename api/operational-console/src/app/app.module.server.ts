// src/app/app.module.server.ts
import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { AppModule } from './app-module';
import { AppComponent } from './app';

@NgModule({
  imports: [
    AppModule,    // This brings in all declarations (including SupervisorDashboard)
    ServerModule, // Adds Server-side capabilities
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}