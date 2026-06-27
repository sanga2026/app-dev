import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastModule } from 'primeng/toast';
import { AdminGeneralComponent } from './tabs/admin-general/admin-general.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';

@Component({
  selector: 'app-admin-detail',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, AdminGeneralComponent, ToastModule,HasPermissionDirective],
  providers: [MessageService],
  templateUrl: './admin-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public branchId!: string; // 🚀 Added to detect branch context
  public adminId!: string;
  public branchName = 'Branch Details'; // 🚀 Fallback for breadcrumb
  public adminUser: any = null;
  public isLoading: boolean = true;
  public activeTab: string = 'general';

  public readonly adminTabs = [
    { id: 'general', label: 'Profile & Access', icon: 'pi-user' }
  ];

  ngOnInit() {
    // 🚀 BULLETPROOF ROUTE PARAMETER EXTRACTOR
    // This scans the entire URL tree so it never misses a nested parameter!
    let currentRoute: any = this.route.root;
    let params: any = {};
    while (currentRoute) {
      if (currentRoute.snapshot.params) {
         params = { ...params, ...currentRoute.snapshot.params };
      }
      currentRoute = currentRoute.firstChild;
    }

    this.bankId = params['bankId'] || '';
    this.branchId = params['branchId'] || '';
    // 🚀 Check for staffId (from Branch route) OR adminId (from Bank route)
    this.adminId = params['staffId'] || params['adminId'] || params['userId'] || '';

    if (this.adminId) {
      this.fetchAdminDetails();
    } else {
      this.isLoading = false;
    }

    // 🚀 ONLY Fetch Branch Name if we are in a branch context!
    if (this.branchId) {
      this.fetchBranchName();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public fetchAdminDetails() {
    this.isLoading = true;
    
    // 🚀 SINGLE PROFILE ENDPOINT: Works universally for Bank Admins and Branch Staff
    this.http.get<any>(`/banks/${this.bankId}/users/${this.adminId}`)
      .pipe(
        takeUntil(this.destroy$), 
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => { 
          this.adminUser = res.data ? res.data : res; 
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Sync Error', detail: 'User profile unavailable.' });
          this.router.navigate(['/banks', this.bankId]);
        },
      });
  }

  // 🚀 FETCH THE BRANCH NAME FOR THE BREADCRUMB
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

  public setTab(tab: string) {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }
}