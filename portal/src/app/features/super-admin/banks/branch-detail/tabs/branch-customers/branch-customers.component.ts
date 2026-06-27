import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Shared UI & Modals
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { CustomerOnboardModalComponent } from '../../../../../../shared/components/modals/customer-onboard-modal/customer-onboard-modal.component';

// PrimeNG
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { HasPermissionDirective } from '../../../../..//../shared/directives/has-permission.directive';
import { TranslateModule } from '@ngx-translate/core';

interface TabState {
  data: any[]; limit: number; offset: number; hasMore: boolean; isLoading: boolean; searchQuery: string;
}

@Component({
  selector: 'app-branch-customers',
  standalone: true,
  imports: [CommonModule, TableModule, TooltipModule, ToastModule, ButtonComponent,TranslateModule, CustomerOnboardModalComponent,HasPermissionDirective
  ],
  templateUrl: './branch-customers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BranchCustomersComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() branchId!: string;
  @Input() currentLayout: string = 'standard';

  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  public customerState: TabState = { data: [], limit: 10, offset: 0, hasMore: true, isLoading: false, searchQuery: '' };
  public showCreateModal = false;

  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchCustomers(); 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncer() {
    this.searchSubject.pipe(takeUntil(this.destroy$), debounceTime(500), distinctUntilChanged())
      .subscribe((query) => {
        this.customerState.searchQuery = query;
        this.fetchCustomers(false);
      });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchCustomers(isLoadMore: boolean = false) {
    if (this.customerState.isLoading) return;
    if (isLoadMore && !this.customerState.hasMore) return;

    if (!isLoadMore) {
      this.customerState.offset = 0;
      this.customerState.data = [];
      this.customerState.hasMore = true;
    }

    this.customerState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams().set('limit', this.customerState.limit.toString()).set('offset', this.customerState.offset.toString());
    if (this.customerState.searchQuery) params = params.set('search', this.customerState.searchQuery);

    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.customerState.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const newData = res.data || [];
          this.customerState.data = [...this.customerState.data, ...newData];
          this.customerState.offset += this.customerState.limit;
          this.customerState.hasMore = newData.length === this.customerState.limit;
        },
        error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load customers.' })
      });
  }

  public openCreateModal() {
    this.showCreateModal = true;
    this.cdr.markForCheck(); // 🚀 Forces Angular to render the dialog despite OnPush strategy
  }

  public navigateToCustomer(customerId: string) {
    this.router.navigate([
      '/banks', 
      this.bankId, 
      'branches', 
      this.branchId, 
      'customers', 
      customerId
    ]);
  }
}