import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Shared Components
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component'; // Check path
import { UserOnboardModalComponent } from '../../../../../../shared/components/modals/user-onboard-modal/user-onboard-modal.component';

// PrimeNG
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
// 🚀 Removed DialogModule because the shared component handles it now!

interface TabState {
  data: any[]; limit: number; offset: number; hasMore: boolean; isLoading: boolean; searchQuery: string;
}

@Component({
  selector: 'app-bank-admins',
  standalone: true,
  // 🚀 Replaced ReactiveFormsModule & DialogModule with UserOnboardModalComponent
  imports: [CommonModule, TranslateModule, TableModule, TooltipModule, ButtonComponent, UserOnboardModalComponent,HasPermissionDirective],
  templateUrl: './bank-admins.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankAdminsComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';

  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  public adminState: TabState = { data: [], limit: 10, offset: 0, hasMore: true, isLoading: false, searchQuery: '' };

  // 🎛️ Modal trigger flag
  public showAdminModal = false;

  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchPaginatedAdmins(); 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncer() {
    this.searchSubject.pipe(takeUntil(this.destroy$), debounceTime(500), distinctUntilChanged())
      .subscribe((query) => {
        this.adminState.searchQuery = query;
        this.fetchPaginatedAdmins(false);
      });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchPaginatedAdmins(isLoadMore: boolean = false) {
    if (this.adminState.isLoading) return;
    if (isLoadMore && !this.adminState.hasMore) return;

    if (!isLoadMore) {
      this.adminState.offset = 0;
      this.adminState.data = [];
      this.adminState.hasMore = true;
    }

    this.adminState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams().set('limit', this.adminState.limit.toString()).set('offset', this.adminState.offset.toString());
    if (this.adminState.searchQuery) params = params.set('search', this.adminState.searchQuery);

    this.http.get<any>(`/banks/${this.bankId}/admins`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.adminState.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe((res) => {
        const newData = res.data || res || [];
        this.adminState.data = [...this.adminState.data, ...newData];
        this.adminState.offset += this.adminState.limit;
        this.adminState.hasMore = newData.length === this.adminState.limit;
      });
  }

  public openCreateAdminModal() {
    this.showAdminModal = true;
  }

  // 🚀 NEW: This receives the new user from the shared modal and updates the table
  public handleUserCreated(newUser: any) {
    this.adminState.data.unshift(newUser);
    this.cdr.markForCheck();
  }

  // 🚀 STATUS TOGGLE
  public toggleUserStatus(admin: any, event: Event) {
    event.stopPropagation(); // 🛡️ Prevents row click navigation

    if (admin.isUpdatingStatus) return;
    const newStatus = !admin.isActive;
    admin.isUpdatingStatus = true;

    this.http.patch(`/banks/${this.bankId}/users/${admin.id}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => { admin.isUpdatingStatus = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          admin.isActive = newStatus;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Access updated.` });
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message })
      });
  }

  // 🚀 NAVIGATION LOGIC
  public navigateToAdmin(adminId: string) {
    this.router.navigate(['/banks', this.bankId, 'admins', adminId]);
  }
}