// operational-console/src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// This starts the Angular application in the browser
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));