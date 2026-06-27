import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Shared Components
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component'; // Keep your existing path
import { UserOnboardModalComponent } from '../../../../../../shared/components/modals/user-onboard-modal/user-onboard-modal.component';

// PrimeNG
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
// 🚀 Removed DialogModule & ReactiveFormsModule since they are handled by the shared modal

interface TabState {
  data: any[]; limit: number; offset: number; hasMore: boolean; isLoading: boolean; searchQuery: string;
}

@Component({
  selector: 'app-branch-staff',
  standalone: true,
  imports: [CommonModule, TranslateModule, TableModule, TooltipModule, ButtonComponent, UserOnboardModalComponent,HasPermissionDirective],
  templateUrl: './branch-staff.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BranchStaffComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() branchId!: string; 
  @Input() currentLayout: string = 'standard';

  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  public staffState: TabState = { data: [], limit: 10, offset: 0, hasMore: true, isLoading: false, searchQuery: '' };
  
  public showCreateModal = false;

  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchPaginatedStaff(); 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncer() {
    this.searchSubject.pipe(takeUntil(this.destroy$), debounceTime(500), distinctUntilChanged())
      .subscribe((query) => {
        this.staffState.searchQuery = query;
        this.fetchPaginatedStaff(false);
      });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchPaginatedStaff(isLoadMore: boolean = false) {
    if (this.staffState.isLoading) return;
    if (isLoadMore && !this.staffState.hasMore) return;

    if (!isLoadMore) {
      this.staffState.offset = 0;
      this.staffState.data = [];
      this.staffState.hasMore = true;
    }

    this.staffState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams().set('limit', this.staffState.limit.toString()).set('offset', this.staffState.offset.toString());
    if (this.staffState.searchQuery) params = params.set('search', this.staffState.searchQuery);

    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/staff`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.staffState.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe((res) => {
        const newData = res.data || res || [];
        this.staffState.data = [...this.staffState.data, ...newData];
        this.staffState.offset += this.staffState.limit;
        this.staffState.hasMore = newData.length === this.staffState.limit;
      });
  }

  public openCreateModal() {
    this.showCreateModal = true;
  }

  // 🚀 Handles the event emitted from the shared modal
  public handleStaffCreated(newStaff: any) {
    this.staffState.data.unshift(newStaff);
    this.cdr.markForCheck();
  }

  public toggleUserStatus(staff: any, event: Event) {
    event.stopPropagation(); 

    if (staff.isUpdatingStatus) return;
    const newStatus = !staff.isActive;
    staff.isUpdatingStatus = true;

    this.http.patch(`/banks/${this.bankId}/users/${staff.id}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => { staff.isUpdatingStatus = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          staff.isActive = newStatus;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Access updated.` });
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message || 'Failed to update.' })
      });
  }

  public navigateToStaff(staffId: string) {
    this.router.navigate([
      '/banks', 
      this.bankId, 
      'branches', 
      this.branchId, 
      'staff', 
      staffId
    ]);
  }
}