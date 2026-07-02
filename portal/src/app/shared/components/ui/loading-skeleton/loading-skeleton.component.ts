import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="'space-y-' + gap">
      <div *ngFor="let w of widths"
           class="skeleton rounded-xl h-4"
           [style.width]="w">
      </div>
    </div>
  `,
})
export class LoadingSkeletonComponent {
  @Input() lines = 4;
  @Input() gap   = 3;

  readonly widths = ['100%', '85%', '92%', '75%', '88%', '96%', '80%', '90%'];

  get widthSlice() {
    return this.widths.slice(0, this.lines);
  }
}
