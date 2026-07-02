import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

import { ButtonComponent } from '../../../../shared/components/modals/button/button.component';
import { ConfirmModalComponent } from '../../../../shared/components/modals/confirm-modal/confirm-modal.component';
import { RoleOnboardModalComponent } from '../../../../shared/components/modals/role-onboard-modal/role-onboard-modal.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { RoleGeneralComponent } from './tabs/role-general/role-general.component';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-role-detail',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    ButtonComponent, 
    ToastModule,
    ConfirmModalComponent, 
    RoleOnboardModalComponent, 
    HasPermissionDirective,
    RoleGeneralComponent
  ],
  templateUrl: './role-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  public bankId!: string;
  public roleId!: string;
  public role: any = null;
  public isLoading = true;
  
  public showEditModal = false;
  public showDeleteModal = false;
  public isDeleting = false;

  public activeTab: string = 'general';
  public readonly roleTabs = [
    { id: 'general', label: 'Configuration & Access', icon: 'pi-shield' }
  ];

  public setTab(tab: string) {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  ngOnInit() {
    let currentRoute: any = this.route.root;
    let params: any = {};
    while (currentRoute) {
      if (currentRoute.snapshot.params) {
        params = { ...params, ...currentRoute.snapshot.params };
      }
      currentRoute = currentRoute.firstChild;
    }

    this.bankId = params['bankId'] || '';
    this.roleId = params['roleId'] || '';

    if (this.roleId) {
      this.fetchRoleDetails();
    } else {
      // Navigate back appropriately
      if (this.bankId) {
        this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'roles' } });
      } else {
        this.router.navigate(['/roles']);
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public fetchRoleDetails() {
    this.isLoading = true;
    this.http.get<any>(`/roles/${this.roleId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          this.role = res.data || res;
          // Fill bankId from the role itself if not in the URL
          if (!this.bankId && this.role?.bankId) this.bankId = this.role.bankId;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Role not found.' });
          this.bankId ? this.router.navigate(['/banks', this.bankId]) : this.router.navigate(['/roles']);
        }
      });
  }

  public handleRoleUpdated(updatedRole: any) {
    this.role = updatedRole; 
    this.cdr.markForCheck();
  }

  public executeDelete() {
    this.isDeleting = true;
    this.http.delete(`/roles/${this.roleId}`)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.isDeleting = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Role successfully removed.' });
          this.router.navigate(['/banks', this.bankId], { queryParams: { tab: 'roles' } });
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Delete Failed', detail: err?.error?.message || 'Operation failed. Please try again.' });
          this.showDeleteModal = false;
        }
      });
  }
}