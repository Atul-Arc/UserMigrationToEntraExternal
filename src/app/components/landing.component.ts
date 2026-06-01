import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:2rem;text-align:center;max-width:800px;margin:0 auto;">
     
      @if (roleMessage()) {
        <p style="margin-top:1rem;font-weight:600;">{{ roleMessage() }}</p>
      }
        <br/><br/><br/>
      <div style="margin-top:1.5rem;color:var(--gray-700);">
        <p>This page is protected by MSAL and only accessible after sign-in.</p>
      </div>
    </div>
  `
})
export class LandingComponent implements OnInit {
  private readonly msal = inject(MsalService);
  private readonly apiScope = 'api://3c22f04f-169d-4340-9eba-208a59821f15/access_as_user';
  readonly roleMessage = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadRoleFromAccessToken();
  }

  private get account(): any {
    return (this.msal.instance as any).getActiveAccount?.() ?? (this.msal.instance as any).getAllAccounts?.()[0] ?? null;
  }

  get userName(): string | null {
    const account = this.account;
    return account ? account.name ?? account.username ?? null : null;
  }

  private async loadRoleFromAccessToken(): Promise<void> {
    const account = this.account;
    if (!account) {
      this.roleMessage.set(null);
      return;
    }

    try {
      const result = await this.msal.instance.acquireTokenSilent({
        account,
        scopes: [this.apiScope]
      });

      const claims = this.decodeJwtClaims(result.accessToken);
      const roleClaim = claims?.['roles'] ?? claims?.['role'];
      const role = Array.isArray(roleClaim) ? roleClaim[0] : roleClaim;
      const normalizedRole = typeof role === 'string' ? role.replace(/[\s_-]/g, '').toLowerCase() : '';

      if (normalizedRole === 'agentadmin') {
        this.roleMessage.set('Logged in successfully as Agent Admin Role. You have access to Appointment Booking and Sub-User Management.');
        return;
      }

      if (normalizedRole === 'agentuser') {
        this.roleMessage.set('Logged in successfully as Agent User Role. You have access to Appointment Booking.');
        return;
      }

      this.roleMessage.set(null);
    } catch {
      this.roleMessage.set(null);
    }
  }

  private decodeJwtClaims(token: string): Record<string, unknown> | undefined {
    const payload = token?.split('.')?.[1];
    if (!payload) {
      return undefined;
    }

    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
}
