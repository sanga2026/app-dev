import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';

export interface Breadcrumb {
  label: string;
  route?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterModule],
  template: `
    <div class="flex flex-col gap-1.5 mb-6 animate-fade-in-up">

      <!-- Breadcrumb -->
      <nav *ngIf="breadcrumbs?.length"
           class="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-600">
        <ng-container *ngFor="let crumb of breadcrumbs; let last = last">
          <a *ngIf="crumb.route && !last"
             [routerLink]="crumb.route"
             class="hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
            {{ crumb.label | translate }}
          </a>
          <span *ngIf="!crumb.route || last"
                class="font-semibold"
                [class.text-slate-600]="last"
                [class.dark:text-slate-300]="last">
            {{ crumb.label | translate }}
          </span>
          <i *ngIf="!last" class="pi pi-chevron-right text-[8px] text-slate-300 dark:text-slate-700"></i>
        </ng-container>
      </nav>

      <!-- Title row -->
      <div class="flex items-start sm:items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <!-- Icon -->
          <div *ngIf="icon"
               class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                      bg-primary-50 dark:bg-primary-900/30
                      border border-primary-100 dark:border-primary-800/50
                      shadow-brand-sm">
            <i [class]="'pi ' + icon + ' text-lg text-primary-600 dark:text-primary-400'"></i>
          </div>

          <div>
            <h1 class="text-xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
              {{ title | translate }}
            </h1>
            <p *ngIf="subtitle"
               class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {{ subtitle | translate }}
            </p>
          </div>
        </div>

        <!-- Action slot -->
        <div class="flex items-center gap-2 flex-wrap">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() breadcrumbs?: Breadcrumb[];
}
