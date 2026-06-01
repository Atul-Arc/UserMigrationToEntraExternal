import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MsalModule, MsalRedirectComponent } from '@azure/msal-angular';
import { PublicClientApplication, BrowserCacheLocation, InteractionType } from '@azure/msal-browser';

import { routes } from './app.routes';

const msalConfig = {
  auth: {
    clientId: '43c66cd5-9888-4c7e-8afc-d86ae632c93e',
    authority: 'https://agentportalpoc.ciamlogin.com/33271a02-1f66-4287-8dd6-84bf0d6701c2',
    knownAuthorities: ['agentportalpoc.ciamlogin.com'],
    redirectUri: 'http://localhost:4205'
  },
  cache: {
    cacheLocation: BrowserCacheLocation.LocalStorage,
    storeAuthStateInCookie: false
  }
};

const protectedResourceMap = new Map<string, Array<string>>();
protectedResourceMap.set('api://3c22f04f-169d-4340-9eba-208a59821f15', ['api://3c22f04f-169d-4340-9eba-208a59821f15/access_as_user']);

const pca = new PublicClientApplication(msalConfig);

function initializeMsal(): () => Promise<void> {
  return () => pca.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    importProvidersFrom(
      MsalModule.forRoot(
        pca,
        {
          interactionType: InteractionType.Redirect,
          authRequest: {
            scopes: ['openid', 'profile', 'email', 'api://3c22f04f-169d-4340-9eba-208a59821f15/access_as_user']
          }
        },
        {
          interactionType: InteractionType.Redirect,
          protectedResourceMap
        }
      )
    ),
    MsalRedirectComponent,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMsal,
      multi: true
    }
  ]
};
