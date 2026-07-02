import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div class="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800
                  flex items-center justify-center mb-5 shadow-inner">
        <i [class]="'pi ' + icon + ' text-4xl text-slate-300 dark:text-slate-600'"></i>
      </div>
      <h3 class="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">
        {{ title | translate }}
      </h3>
      <p *ngIf="message" class="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
        {{ message | translate }}
      </p>
      <div class="mt-4">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() icon    = 'pi-inbox';
  @Input() title   = 'COMMON.NO_DATA';
  @Input() message?: string;
}
