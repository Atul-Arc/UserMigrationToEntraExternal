import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { Subscription } from 'rxjs';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgIf],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('agents');
  protected readonly isLoggedIn = signal(false);
  protected readonly userName = signal<string | null>(null);
  protected readonly showMenu = signal(false);

  private readonly msal = inject(MsalService);
  private readonly msalBroadcast = inject(MsalBroadcastService);
  private readonly router = inject(Router);
  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.updateLoginStatus();
    
    const sub = this.msalBroadcast.inProgress$.subscribe(() => this.updateLoginStatus());
    this.subs.push(sub);
    const evtSub = this.msalBroadcast.msalSubject$.subscribe(() => this.updateLoginStatus());
    this.subs.push(evtSub);

    // Always attempt to process any redirect response so accounts are stored
    try {
      this.msal.handleRedirectObservable().subscribe({
        error: (err) => console.error('App: handleRedirectObservable error', err),
        complete: () => {
          this.updateLoginStatus();
        }
      });
    } catch (e) {
      console.warn('App: error calling handleRedirectObservable', e);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private cleanDisplayName(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private updateLoginStatus(): void {
    try {
      const accounts = (this.msal.instance as any).getAllAccounts?.() ?? [];
      const logged = accounts.length > 0;
      this.isLoggedIn.set(logged);
      if (logged) {
        const acct = (this.msal.instance as any).getActiveAccount?.() ?? accounts[0];
        const claims = acct?.idTokenClaims as Record<string, unknown> | undefined;
        const claimName = typeof claims?.['name'] === 'string' ? claims['name'] : null;
        const rawName = claimName ?? acct?.name ?? acct?.username ?? null;
        this.userName.set(this.cleanDisplayName(rawName));
      } else {
        this.userName.set(null);
      }
      if (accounts.length > 0 && (this.msal.instance as any).setActiveAccount) {
        try {
          (this.msal.instance as any).setActiveAccount(accounts[0]);
        } catch (e) {
          console.warn('Failed to set active account in updateLoginStatus', e);
        }
      }
      // If the user is logged in and currently at the root, navigate to the landing page.
      try {
        if (logged) {
          const current = this.router.url ?? window.location.pathname ?? '/';
          if (current === '/' || current === '') {
            this.router.navigateByUrl('/landing');
          }
        }
      } catch (e) {
        console.warn('Error navigating to landing after login status update', e);
      }
    } catch (e) {
      this.isLoggedIn.set(false);
    }
  }

  login(): void {
    try {
      this.msal.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'api://3c22f04f-169d-4340-9eba-208a59821f15/access_as_user']
      });
    } catch (err) {
      console.error('MSAL loginRedirect error', err);
      const authority = 'https://agentportalpoc.ciamlogin.com/33271a02-1f66-4287-8dd6-84bf0d6701c2/oauth2/v2.0/authorize';
      const clientId = '43c66cd5-9888-4c7e-8afc-d86ae632c93e';
      const redirect = encodeURIComponent('http://localhost:4205');
      const scope = encodeURIComponent('openid profile email offline_access api://3c22f04f-169d-4340-9eba-208a59821f15/access_as_user');
      const url = `${authority}?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&response_mode=query&scope=${scope}`;
      window.location.href = url;
    }
  }

  logout(): void {
    // close dropdown if open
    this.showMenu.set(false);
    this.msal.logoutRedirect({ postLogoutRedirectUri: 'http://localhost:4205/' });
  }

  toggleMenu(): void {
    this.showMenu.update((v) => !v);
  }

  changePassword(): void {
    // Redirect to Entra / Microsoft self-service password reset page.
    // Replace this URL with your tenant-specific self-service URL if required.
    try {
      this.showMenu.set(false);
      window.open('https://passwordreset.microsoftonline.com/', '_blank');
    } catch (e) {
      console.error('Failed to open password reset', e);
    }
  }
  
}
