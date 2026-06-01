import { Routes } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { HomeComponent } from './components/home.component';
import { AgentRegistrationComponent } from './components/agent-registration.component';
import { PrivacyComponent } from './components/privacy.component';
import { TermsComponent } from './components/terms.component';
import { CopyrightComponent } from './components/copyright.component';
import { AuthCallbackComponent } from './components/auth-callback.component';
import { LandingComponent } from './components/landing.component';

export const routes: Routes = [
	{ path: '', component: HomeComponent, pathMatch: 'full' },
	{ path: 'auth-callback', component: AuthCallbackComponent },
	{ path: 'landing', component: LandingComponent, canActivate: [MsalGuard] },
	{ path: 'agent-registration', component: AgentRegistrationComponent },
	{ path: 'privacy-policy', component: PrivacyComponent, canActivate: [MsalGuard] },
	{ path: 'terms', component: TermsComponent, canActivate: [MsalGuard] },
	{ path: 'copyright', component: CopyrightComponent, canActivate: [MsalGuard] },
	{ path: '**', redirectTo: '' }
];
