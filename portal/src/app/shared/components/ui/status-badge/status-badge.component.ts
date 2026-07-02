import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type StatusType =
  'active' | 'inactive' | 'pending' | 'verified' | 'rejected' | 'expired' |
  'approved' | 'disbursed' | 'draft' | 'submitted' | 'custom';

const CFG: Record<StatusType, { cls: string; dot: string }> = {
  active:    { cls: 'badge-green',  dot: 'bg-emerald-400' },
  verified:  { cls: 'badge-green',  dot: 'bg-emerald-400' },
  approved:  { cls: 'badge-green',  dot: 'bg-emerald-400' },
  disbursed: { cls: 'badge-purple', dot: 'bg-purple-400'  },
  submitted: { cls: 'badge-blue',   dot: 'bg-blue-400'    },
  pending:   { cls: 'badge-amber',  dot: 'bg-amber-400'   },
  rejected:  { cls: 'badge-red',    dot: 'bg-red-400'     },
  expired:   { cls: 'badge-red',    dot: 'bg-orange-400'  },
  inactive:  { cls: 'badge-gray',   dot: 'bg-slate-400'   },
  draft:     { cls: 'badge-gray',   dot: 'bg-slate-300'   },
  custom:    { cls: 'badge-gray',   dot: 'bg-slate-300'   },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <span class="badge" [class]="cfg.cls">
      <span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="cfg.dot"></span>
      {{ label | translate }}
    </span>
  `,
})
export class StatusBadgeComponent {
  @Input() set status(v: string) {
    this.cfg = CFG[(v?.toLowerCase() as StatusType)] ?? CFG['custom'];
  }
  @Input() label = '';
  cfg = CFG['custom'];
}
