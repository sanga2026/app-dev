import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';

// PrimeNG
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { BankGeneralComponent } from './tabs/bank-general/bank-general.component';
import { BankAdminsComponent } from './tabs/bank-admins/bank-admins.component';
import { BankBranchesComponent } from './tabs/bank-branches/bank-branches.component';
import { BankLoanProductsComponent } from './tabs/bank-loan-products/bank-loan-products.component';
import { BankRolesComponent } from './tabs/bank-roles/bank-roles.component';
import { BankNumberRangesComponent }   from './tabs/bank-number-ranges/bank-number-ranges.component';
import { BankAccountProductsComponent } from './tabs/bank-account-products/bank-account-products.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-bank-detail',
  standalone: true,
  imports: [
    CommonModule, TranslateModule, ToastModule, TooltipModule, RouterLink,
    BankGeneralComponent, BankAdminsComponent, BankBranchesComponent,
    BankLoanProductsComponent, BankRolesComponent, BankNumberRangesComponent,
    BankAccountProductsComponent, HasPermissionDirective,
  ],
  templateUrl: './bank-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

public bankId!: string;
  public bank: any = null;
  public isLoading: boolean = true;
  public activeTab: string = ''; 
  public currentLayout: string = 'standard';
private router = inject(Router);

private readonly allBankTabs = [
    { id: 'general',       label: 'General Info',     icon: 'pi-info-circle', resource: 'banks',        action: 'read'   },
    { id: 'admins',        label: 'Admin Users',       icon: 'pi-users',       resource: 'users',        action: 'read'   },
    { id: 'branches',      label: 'Branches',          icon: 'pi-sitemap',     resource: 'branches',     action: 'read'   },
    { id: 'loansproducts', label: 'Loan Products',     icon: 'pi-briefcase',   resource: 'loan-products',action: 'read'   },
    { id: 'roles',           label: 'Custom Roles',      icon: 'pi-key',         resource: 'roles',        action: 'read' },
    { id: 'numberranges',    label: 'Number Sequences',  icon: 'pi-hashtag',     resource: 'master-data',  action: 'read' },
    { id: 'accountproducts', label: 'Account Products',  icon: 'pi-th-large',    resource: 'banks',        action: 'read' },
    { id: 'transactions',    label: 'Transactions',      icon: 'pi-sync',        resource: 'accounting',   action: 'read' },
  ];

  public visibleTabs: any[] = [];

  ngOnInit() {
    this.authService.dashboardLayout$?.pipe(takeUntil(this.destroy$)).subscribe((layout) => {
      this.currentLayout = layout || 'standard';
      this.cdr.markForCheck();
    });

   this.visibleTabs = this.allBankTabs.filter(tab => 
      this.authService.hasPermission(tab.resource, tab.action as 'read' | 'create' | 'update' | 'delete')
    );

    // 🚀 4. SMART DEFAULT: Auto-select the first tab they are allowed to see
    if (this.visibleTabs.length > 0) {
      this.activeTab = this.visibleTabs[0].id;
    }

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tabFromUrl = params['tab'];
      
      // Check if the tab from URL is allowed, otherwise default to first allowed tab
      const isAllowed = this.visibleTabs.find(t => t.id === tabFromUrl);
      this.activeTab = isAllowed ? tabFromUrl : (this.visibleTabs[0]?.id || '');
      
      this.cdr.markForCheck();
    });

    this.bankId = this.route.snapshot.paramMap.get('id') || '';
    if (this.bankId) {
      this.fetchBankDetails();
    } else {
      this.isLoading = false;
    }

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // 🚀 The Parent is in charge of fetching the top-level bank data
  public fetchBankDetails() {
    this.isLoading = true;
    this.http.get<any>(`/banks/${this.bankId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => { this.bank = res.data ? res.data : res; },
        error: () => this.messageService.add({ severity: 'error', summary: 'Sync Failed', detail: 'Tenant identity load failed.' }),
      });
  }

public setTab(tabId: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabId },
      queryParamsHandling: 'merge', // Keeps other query params (like bankId)
      replaceUrl: true // Optional: Prevents filling browser history with tab clicks
    });
  }
}