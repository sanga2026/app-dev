import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="visible"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity p-4"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100 dark:border-gray-700 p-6 animate-in zoom-in-95 duration-200"
      >
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <i class="pi pi-exclamation-triangle text-xl text-red-600 dark:text-red-400"></i>
        </div>

        <div class="text-center">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">{{ title }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            <ng-content></ng-content>
          </p>
        </div>

        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            (click)="close()"
            [disabled]="isProcessing"
            class="w-full sm:w-auto inline-flex justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ cancelText }}
          </button>

          <button
            (click)="onConfirm()"
            [disabled]="isProcessing"
            class="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm shadow-red-500/20"
          >
            <i *ngIf="isProcessing" class="pi pi-spinner pi-spin mr-2"></i>
            {{ isProcessing ? processingText : confirmText }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  // 🎛️ State Controls
  @Input() visible: boolean = false;
  @Input() isProcessing: boolean = false;

  // 📝 Text Configuration
  @Input() title: string = 'Confirm Action';
  @Input() confirmText: string = 'Yes, Confirm';
  @Input() processingText: string = 'Processing...';
  @Input() cancelText: string = 'Cancel';

  // 📡 Event Emitters
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirm = new EventEmitter<void>();

  // 🚀 Inject ElementRef to manipulate the DOM
  private el = inject(ElementRef);

  ngOnInit() {
    // 🚀 TELEPORTATION: Move this component to the <body> tag to escape CSS inheritance traps
    document.body.appendChild(this.el.nativeElement);
  }

  ngOnDestroy() {
    // 🧹 CLEANUP: Remove the element from the DOM when navigating away to prevent memory leaks
    if (this.el.nativeElement && this.el.nativeElement.parentNode) {
      this.el.nativeElement.parentNode.removeChild(this.el.nativeElement);
    }
  }

  public close() {
    if (this.isProcessing) return; // Lock the modal while API is running
    this.visible = false;
    this.visibleChange.emit(this.visible); // Supports two-way binding: [(visible)]
  }

  public onConfirm() {
    this.confirm.emit();
  }
}