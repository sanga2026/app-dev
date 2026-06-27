import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Shared Components
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component'; // Ensure path is correct
import { BranchOnboardModalComponent } from '../../../../../../shared/components/modals/branch-onboard-modal/branch-onboard-modal.component';

// PrimeNG
import { TableModule } from 'primeng/table';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
interface TabState {
  data: any[];
  limit: number;
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  searchQuery: string;
}

@Component({
  selector: 'app-bank-branches',
  standalone: true,
  // 🚀 Replaced ReactiveFormsModule & DialogModule with BranchOnboardModalComponent
  imports: [
    CommonModule,
    TranslateModule,
    TableModule,
    ButtonComponent,
    BranchOnboardModalComponent,
    HasPermissionDirective
  ],
  templateUrl: './bank-branches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankBranchesComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';

  private router = inject(Router);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // 📊 Table State
  public branchState: TabState = {
    data: [],
    limit: 10,
    offset: 0,
    hasMore: true,
    isLoading: false,
    searchQuery: '',
  };

  // 🏢 Modal State
  public showBranchModal = false;

  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchPaginatedBranches();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🔍 Pagination & Search
  private setupSearchDebouncer() {
    this.searchSubject
      .pipe(takeUntil(this.destroy$), debounceTime(500), distinctUntilChanged())
      .subscribe((query) => {
        this.branchState.searchQuery = query;
        this.fetchPaginatedBranches(false); // Fetches data from offset 0
      });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchPaginatedBranches(isLoadMore: boolean = false) {
    if (this.branchState.isLoading) return;
    if (isLoadMore && !this.branchState.hasMore) return;

    if (!isLoadMore) {
      this.branchState.offset = 0;
      this.branchState.data = [];
      this.branchState.hasMore = true; 
    }

    this.branchState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams()
      .set('limit', this.branchState.limit.toString())
      .set('offset', this.branchState.offset.toString());

    if (this.branchState.searchQuery) {
      params = params.set('search', this.branchState.searchQuery);
    }

    this.http
      .get<any>(`/banks/${this.bankId}/branches`, { params })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.branchState.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe((res) => {
        const newData = res.data || res || [];
        this.branchState.data = [...this.branchState.data, ...newData];
        this.branchState.offset += this.branchState.limit;
        this.branchState.hasMore = newData.length === this.branchState.limit;
      });
  }

  // 🚀 Modal Controls
  public openCreateBranchModal() {
    this.showBranchModal = true;
  }

  // 🚀 Receives the new branch from the shared modal component
  public handleBranchCreated(newBranch: any) {
    this.branchState.data.unshift(newBranch);
    this.cdr.markForCheck();
  }

  // 🔗 Navigation
  public navigateToBranch(branchId: string) {
    this.router.navigate(['/banks', this.bankId, 'branches', branchId]);
  }

  // 🛑 TOGGLE BRANCH STATUS
  public toggleBranchStatus(branch: any, event: Event) {
    event.stopPropagation(); // Prevent row click

    if (branch.isUpdatingStatus) return;
    
    const newStatus = !branch.isActive;
    branch.isUpdatingStatus = true;

    this.http.patch(`/banks/${this.bankId}/branches/${branch.id}/status`, { isActive: newStatus })
      .pipe(
        takeUntil(this.destroy$), 
        finalize(() => { 
          branch.isUpdatingStatus = false; 
          this.cdr.detectChanges(); 
        })
      )
      .subscribe({
        next: (res: any) => {
          branch.isActive = newStatus;
          this.messageService.add({ 
            severity: 'success', 
            summary: 'Updated', 
            detail: res.message || `Branch is now ${newStatus ? 'Operational' : 'Suspended'}.` 
          });
        },
        error: (err) => {
          this.messageService.add({ 
            severity: 'error', 
            summary: 'Failed', 
            detail: err.error?.message || 'Could not update branch status.' 
          });
        }
      });
  }
}