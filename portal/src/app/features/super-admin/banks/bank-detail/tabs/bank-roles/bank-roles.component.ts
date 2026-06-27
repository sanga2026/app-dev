import { Component, OnInit, OnDestroy, Input, inject, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router'; // 🚀 Added Router
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { TableModule } from 'primeng/table';
import { ButtonComponent } from '../../../../../../shared/components/modals/button/button.component';
import { HasPermissionDirective } from '../../../../..//../shared/directives/has-permission.directive';
import { RoleOnboardModalComponent } from '../../../../../../shared/components/modals/role-onboard-modal/role-onboard-modal.component';

@Component({
  selector: 'app-bank-roles',
  standalone: true,
  imports: [
    CommonModule, 
    TranslateModule, 
    TableModule, 
    ButtonComponent, 
    HasPermissionDirective,
    RoleOnboardModalComponent
  ],
  templateUrl: './bank-roles.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BankRolesComponent implements OnInit, OnDestroy {
  @Input() bankId!: string;
  @Input() currentLayout: string = 'standard';

  private http = inject(HttpClient);
  private router = inject(Router); // 🚀 Injected Router
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  public roleState = { data: [] as any[], limit: 10, offset: 0, hasMore: true, isLoading: false, searchQuery: '' };
  public showRoleModal = false;

  ngOnInit() {
    this.setupSearchDebouncer();
    this.fetchRoles();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebouncer() {
    this.searchSubject.pipe(takeUntil(this.destroy$), debounceTime(500), distinctUntilChanged()).subscribe((query) => {
      this.roleState.searchQuery = query;
      this.fetchRoles(false);
    });
  }

  public onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  public fetchRoles(isLoadMore: boolean = false) {
    if (this.roleState.isLoading || (isLoadMore && !this.roleState.hasMore)) return;

    if (!isLoadMore) {
      this.roleState.offset = 0;
      this.roleState.data = [];
      this.roleState.hasMore = true;
    }

    this.roleState.isLoading = true;
    this.cdr.markForCheck();

    let params = new HttpParams()
      .set('bankId', this.bankId) 
      .set('limit', this.roleState.limit.toString())
      .set('offset', this.roleState.offset.toString());
      
    if (this.roleState.searchQuery) params = params.set('search', this.roleState.searchQuery);

    this.http.get<any>(`/roles`, { params })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.roleState.isLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (res) => {
          const newData = res.data || res || [];
          this.roleState.data = [...this.roleState.data, ...newData];
          this.roleState.offset += this.roleState.limit;
          this.roleState.hasMore = newData.length === this.roleState.limit;
        }
      });
  }

  public openCreateModal() {
    this.showRoleModal = true;
  }

  public handleRoleCreated(newRole: any) {
    this.roleState.data.unshift(newRole);
    this.cdr.markForCheck();
  }

    public toggleRoleStatus(role: any, event: Event) {
    event.stopPropagation(); // 🛡️ Prevents row click navigation

    if (role.isUpdatingStatus) return;
    const newStatus = !role.isActive;
    role.isUpdatingStatus = true;

    this.http.patch(`/roles/${role.id}/status`, { isActive: newStatus })
      .pipe(takeUntil(this.destroy$), finalize(() => { role.isUpdatingStatus = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: () => {
          role.isActive = newStatus;
          this.messageService.add({ severity: 'success', summary: 'Updated', detail: `Access updated.` });
        },
        error: (err) => this.messageService.add({ severity: 'error', summary: 'Failed', detail: err.error?.message })
      });
  }
  // 🚀 Added Navigation Logic
  public navigateToRole(roleId: string) {
    this.router.navigate(['/banks', this.bankId, 'roles', roleId]);
  }
}