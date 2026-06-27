import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { TableModule } from 'primeng/table';
import { HasPermissionDirective } from '../../../../../../shared/directives/has-permission.directive';
import { LoanProductOnboardModalComponent } from '../../../../../../shared/components/modals/loan-product-onboard-modal/loan-product-onboard-modal.component';

@Component({
  selector: 'app-bank-loans',
  standalone: true,
  // 🚀 FIXED: Removed ReactiveFormsModule & DialogModule since the form and dialog now live in the child modal!
  imports: [
    CommonModule, 
    TranslateModule, 
    TableModule, 
    ButtonComponent, 
    LoanProductOnboardModalComponent,
    HasPermissionDirective
  ],
  templateUrl: './bank-loan-products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankLoanProductsComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';

  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  public loanState = { data: [] as any[], limit: 10, offset: 0, hasMore: true, isLoading: false, searchQuery: '' };
  
  public showCreateModal = false;
  
  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchPaginatedLoans();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncer() {
    this.searchSubject.pipe(
      takeUntil(this.destroy$), 
      debounceTime(500), 
      distinctUntilChanged()
    ).subscribe((query) => {
      this.loanState.searchQuery = query;
      this.fetchPaginatedLoans(false);
    });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchPaginatedLoans(isLoadMore: boolean = false) {
    if (this.loanState.isLoading || (isLoadMore && !this.loanState.hasMore)) return;

    if (!isLoadMore) {
      this.loanState.offset = 0;
      this.loanState.data = [];
      this.loanState.hasMore = true;
    }

    this.loanState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams()
      .set('limit', this.loanState.limit.toString())
      .set('offset', this.loanState.offset.toString());
      
    if (this.loanState.searchQuery) {
      params = params.set('search', this.loanState.searchQuery);
    }

    this.http.get<any>(`/banks/${this.bankId}/loans`, { params })
      .pipe(
        takeUntil(this.destroy$), 
        finalize(() => { 
          this.loanState.isLoading = false; 
          this.cdr.detectChanges(); 
        })
      )
      .subscribe({
        next: (res) => {
          const newData = res.data || [];
          this.loanState.data = [...this.loanState.data, ...newData];
          this.loanState.offset += this.loanState.limit;
          this.loanState.hasMore = newData.length === this.loanState.limit;
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load loans.' });
        }
      });
  }

  // 🚀 FIXED: Opens the modal and forces UI update to ensure it renders over the layout
  public openCreateModal() {
    this.showCreateModal = true;
    this.cdr.detectChanges(); 
  }

  // 🚀 FIXED: Added the missing handler! When the child modal creates a loan, it sends the data here to update the table.
  public handleLoanCreated(newLoan: any) {
    this.showCreateModal = false; // Close the modal
    this.loanState.data.unshift(newLoan); // Push the new loan to the top of the table
    this.messageService.add({ severity: 'success', summary: 'Created', detail: 'Loan product successfully created.' });
    this.cdr.detectChanges(); // Force table to redraw
  }

  public toggleStatus(loan: any, event: Event) {
    event.stopPropagation();
    if (loan.isUpdating) return;
    
    const newStatus = !loan.isActive;
    loan.isUpdating = true;
    this.cdr.detectChanges();

    this.http.patch(`/banks/${this.bankId}/loans/${loan.id}/status`, { isActive: newStatus })
      .pipe(
        takeUntil(this.destroy$), 
        finalize(() => { 
          loan.isUpdating = false; 
          this.cdr.detectChanges(); 
        })
      )
      .subscribe({
        next: (res: any) => {
          loan.isActive = newStatus;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: res.message || `Product status updated.` });
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not update status.' });
        }
      });
  }

  public navigateToLoan(loanId: string) {
    this.router.navigate(['/banks', this.bankId, 'loans', loanId]);
  }
}