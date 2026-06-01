import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MsalService } from '@azure/msal-angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:1rem;text-align:center;">
      <h3>Signing you in…</h3>
      <p>Please wait while we complete the sign-in process.</p>
    </div>
  `
})
export class AuthCallbackComponent implements OnInit {
  constructor(private msal: MsalService, private router: Router) {}

  ngOnInit(): void {
    // Diagnostic logging removed

    // Use MsalService's observable handler so angular-msal broadcasts events
    this.msal.handleRedirectObservable().subscribe({
      next: (result) => {
        try {
          const accounts = (this.msal.instance as any).getAllAccounts?.() ?? [];
          if (accounts.length > 0 && (this.msal.instance as any).setActiveAccount) {
            (this.msal.instance as any).setActiveAccount(accounts[0]);
          }
        } catch (e) {
          console.warn('Error setting active account after redirect', e);
        }
      },
      error: (err) => {
        console.error('handleRedirectObservable error', err);
      },
      complete: () => {
        // navigate to landing after successful login
        this.router.navigateByUrl('/landing');
        setTimeout(() => {
          if (window.location.pathname !== '/') {
            // if the router didn't navigate, ensure we land on /landing
            if (window.location.pathname !== '/landing') {
              this.router.navigateByUrl('/landing');
            }
          }
        }, 1500);
      }
    });
  }
}
