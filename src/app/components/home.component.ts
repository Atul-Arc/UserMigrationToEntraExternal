import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="content" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;max-width:700px;min-height:60vh;margin:0 auto;">
      <ng-container *ngIf="!isLoggedIn(); else logged">
        <h1 style="margin-top:0.5rem;">Welcome</h1>
        <p style="margin:0.75rem 0 1.5rem 0;">Manage agents and access the portal.</p>

        <div style="display:flex;gap:1rem;justify-content:center;margin-bottom:1rem;flex-wrap:wrap;align-items:center;">
          <a class="pill" href="/agent-registration" role="link">Agent Registration</a>
        </div>

        <p style="color:var(--gray-700);margin-top:0.5rem;">
          For more information about Agent registration, please check
          <a href="https://agents.tasheer.com/AgentTasheer/auth/download-pdf" target="_blank" rel="noopener">Agent Registration Manual</a>
        </p>
      </ng-container>
      <ng-template #logged>
        <h1 style="margin-top:0.5rem;">Login successful</h1>
        <p style="margin:0.75rem 0 1.5rem 0;">You're signed in. Visit your <a href="/landing">landing page</a>.</p>
      </ng-template>
    </div>
  `
})
export class HomeComponent {
  private readonly msal = inject(MsalService);

  isLoggedIn(): boolean {
    try {
      const accounts = (this.msal.instance as any).getAllAccounts?.() ?? [];
      return accounts.length > 0;
    } catch {
      return false;
    }
  }
}
