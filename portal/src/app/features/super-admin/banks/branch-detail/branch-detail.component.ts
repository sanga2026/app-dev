import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../../../auth/auth.service';

// 🚀 Inject Child Tabs as you build them
import { BranchGeneralComponent } from './tabs/branch-general/branch-general.component';
import { ButtonComponent } from '../../../../shared/components/modals/button/button.component';
import { ToastModule } from 'primeng/toast';
import { BranchStaffComponent } from './tabs/branch-users/branch-staff.component';
import { BranchCustomersComponent } from './tabs/branch-customers/branch-customers.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-branch-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    RouterLink,
    ButtonComponent,
    BranchGeneralComponent, // 👈 The General Tab,
    BranchStaffComponent,
    BranchCustomersComponent,
    ToastModule,
    TranslateModule,
    HasPermissionDirective
  ],
  providers: [MessageService],
  templateUrl: './branch-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public branchId!: string;
  public branch: any = null;
  public isLoading: boolean = true;
 public activeTab: string = '';
  public currentLayout: string = 'standard';

  // 📚 Dynamic Tab Configuration for Branches
 private readonly allBranchTabs = [
    { id: 'general', label: 'General Info', icon: 'pi-info-circle', resource: 'branches', action: 'read' },
    { id: 'users', label: 'Branch Staff', icon: 'pi-users', resource: 'users', action: 'read' },
    { id: 'customers', label: 'Customers', icon: 'pi-id-card', resource: 'customers', action: 'read' }, 
    { id: 'transactions', label: 'Transactions', icon: 'pi-sync', resource: 'transactions', action: 'read' },
    { id: 'products', label: 'Products', icon: 'pi-box', resource: 'products', action: 'read' },
  ];
  

  public visibleTabs: any[] = [];
// Add the inject(ActivatedRoute) and inject(Router) as you have, 
// and ensure these methods are updated:

ngOnInit() {
  this.authService.dashboardLayout$?.pipe(takeUntil(this.destroy$)).subscribe((layout) => {
    this.currentLayout = layout || 'standard';
    this.cdr.markForCheck();
  });

  // 1. FILTER TABS
  this.visibleTabs = this.allBranchTabs.filter(tab => 
    this.authService.hasPermission(tab.resource, tab.action as 'read' | 'create' | 'update' | 'delete')
  );

  // 2. 🚀 SMART DEFAULT: Read from URL, fallback to first visible tab
  this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
    const tabFromUrl = params['tab'];
    const isAllowed = this.visibleTabs.find(t => t.id === tabFromUrl);
    this.activeTab = isAllowed ? tabFromUrl : (this.visibleTabs[0]?.id || '');
    this.cdr.markForCheck();
  });

  this.bankId = this.route.snapshot.paramMap.get('bankId') || '';
  this.branchId = this.route.snapshot.paramMap.get('branchId') || ''; 

  if (this.bankId && this.branchId) {
    this.fetchBranchDetails();
  } else {
    this.isLoading = false;
  }
}

// 3. 🚀 Update URL instead of local state
public setTab(tabId: string) {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { tab: tabId },
    queryParamsHandling: 'merge', 
    replaceUrl: true 
  });
}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public fetchBranchDetails() {
    this.isLoading = true;
    this.http.get<any>(`/banks/${this.bankId}/branches/${this.branchId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => { this.branch = res.data ? res.data : res; },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Sync Failed', detail: 'Failed to load branch details.' });
          this.router.navigate(['/banks', this.bankId]);
        },
      });
  }
}