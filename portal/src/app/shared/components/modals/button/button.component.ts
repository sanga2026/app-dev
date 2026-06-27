import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'danger-light';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  // 🎛️ Configurations
  @Input() label: string = '';
  @Input() icon?: string;
  @Input() iconPos: 'left' | 'right' = 'left';
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  
  // 🚦 States
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() fullWidth: boolean = false;

  // 📡 Events
  @Output() onClick = new EventEmitter<Event>();

  // 🎨 Compute Classes dynamically
  public get computedClasses(): string {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed';
    const sizeClasses = this.getSizeClasses();
    const variantClasses = this.getVariantClasses();
    const widthClass = this.fullWidth ? 'w-full' : '';

    return `${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass}`;
  }

  private getSizeClasses(): string {
    switch (this.size) {
      case 'sm': return 'px-3 py-1.5 text-xs rounded-lg';
      case 'md': return 'px-4 py-2 text-sm rounded-lg';
      case 'lg': return 'px-6 py-2.5 text-sm rounded-xl'; // Used in Modals
      default: return 'px-4 py-2 text-sm rounded-lg';
    }
  }

  private getVariantClasses(): string {
    switch (this.variant) {
      case 'primary':
        return 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm';
      case 'success':
        return 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-md shadow-green-500/20';
      case 'danger':
        return 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-md shadow-red-500/20';
      case 'danger-light':
        return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40 focus:ring-red-500';
      case 'secondary':
        return 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500';
      default:
        return 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500';
    }
  }

  public handleClick(event: Event) {
    if (!this.disabled && !this.loading) {
      this.onClick.emit(event);
    }
  }
}