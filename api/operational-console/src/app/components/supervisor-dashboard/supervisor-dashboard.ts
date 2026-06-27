import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // CRITICAL: Required for *ngFor, *ngIf and | json
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule], // Logic: This allows the HTML to use Angular directives
  templateUrl: './supervisor-dashboard.html',
  styleUrls: []
})
export class SupervisorDashboardComponent implements OnInit {
  pendingLoans: any[] = [];
  loading: boolean = true;

  constructor(private vaultService: VaultService) {}

  ngOnInit(): void {
    this.refreshVault();
  }

  refreshVault() {
    this.loading = true;
    this.vaultService.getPendingLoans().subscribe({
      next: (data) => {
        console.log('📡 Data arrived from Vault:', data);
        
        // Logic: Using the spread operator [...] ensures Angular's 
        // change detection sees this as a new array and updates the UI.
        this.pendingLoans = [...data]; 
        
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Vault Retrieval Error:', err);
        this.loading = false;
      }
    });
  }

  approveLoan(loanId: string) {
    console.log('Initiating approval for ID:', loanId);
    // Next step: Build the backend Patch request for this
  }
}