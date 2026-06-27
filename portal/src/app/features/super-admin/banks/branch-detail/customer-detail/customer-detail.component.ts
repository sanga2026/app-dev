import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

// PrimeNG Modules
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  // 🚀 Added ToastModule and TooltipModule to prevent plugin errors!
  imports: [CommonModule, RouterLink, ToastModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './customer-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public branchId!: string;
  public customerId!: string;
  
  public branchName = 'Branch Details';
  public customer: any = null;
  public isLoading: boolean = true;
  public isUpdatingStatus: boolean = false;
  public activeTab: string = 'profile';
  public currentLayout: string = 'standard';

  public readonly customerTabs = [
    { id: 'profile', label: 'Profile & KYC', icon: 'pi-id-card' },
    { id: 'accounts', label: 'Accounts (0)', icon: 'pi-wallet' },
    { id: 'loans', label: 'Loan Facilities', icon: 'pi-file' },
    { id: 'transactions', label: 'Transactions', icon: 'pi-list' }
  ];

  ngOnInit() {
    // 🚀 FOOLPROOF ROUTE PARAMETER EXTRACTOR (Prevents the blank screen blink!)
    // Scans UP the routing tree to guarantee no parameters are missed.
    let params: any = { ...this.route.snapshot.params };
    let parent = this.route.parent;
    
    while (parent) {
      params = { ...params, ...parent.snapshot.params };
      parent = parent.parent;
    }

    this.bankId = params['bankId'] || '';
    this.branchId = params['branchId'] || '';
    this.customerId = params['customerId'] || '';

    if (this.customerId) {
      this.fetchCustomerDetails();
      if (this.branchId) {
        this.fetchBranchName();
      }
    } else {
      console.error('🚨 Routing Error: Could not extract Customer ID from URL!', params);
      this.isLoading = false; 
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🚀 Fetch Core Customer Data
  public fetchCustomerDetails() {
    this.isLoading = true;
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => { this.customer = res.data || res; },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Customer profile unavailable.' });
          this.router.navigate(['/banks', this.bankId, 'branches', this.branchId]);
        },
      });
  }

  // 🚀 Fetch Branch Name for Breadcrumb
  public fetchBranchName() {
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.branchName = res.data?.name || res?.name || 'Branch Details';
          this.cdr.markForCheck();
        }
      });
  }

  // 🚀 Toggle Customer Access Status
  public toggleCustomerStatus() {
    if (!this.customer || this.isUpdatingStatus) return;
    
    this.isUpdatingStatus = true;
    const newStatus = !this.customer.isActive;

    this.http.patch(`/banks/${this.bankId}/branches/${this.branchId}/customers/${this.customerId}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.isUpdatingStatus = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.customer.isActive = newStatus;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Customer account ${newStatus ? 'activated' : 'suspended'}.` });
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Failed to update status.' })
      });
  }

  public setTab(tab: string) {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }
}