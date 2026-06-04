# Agents Portal User Migration to Entra External ID

## Overview

This project is an Angular-based Agents Portal integrated with Microsoft Entra External ID (CIAM) for authentication and account lifecycle onboarding.

This is useful for the legacy system which stores users in a local database and want to migrate user accounts to Entra External ID (CIAM). A migration script is provided at `scripts/create_entraid_users.ps1` to automate the transfer.

The solution includes:

- Frontend sign-in/sign-out experience using MSAL.
- Password change entry point from the logged-in user menu.
- A PowerShell migration utility that creates users in Entra via Microsoft Graph.
- App role assignment during user creation.
- CSV-driven bulk provisioning for legacy-to-new user migration.

## Technology

- Angular 20
- MSAL for Angular (`@azure/msal-angular`, `@azure/msal-browser`)
- Microsoft Graph REST API
- PowerShell for bulk user migration
- Entra External ID (CIAM): customer identity and authentication provider for external users.
- Azure AD tenant: the directory where app registrations and resources are managed.
- App registrations:
	- Frontend (SPA) app registration for Angular/MSAL authentication.
	- Backend (API) app registration for exposing scopes and defining app roles (`AgentAdmin`, `AgentUser`).
	- Entra Conditional Access and MFA configuration to enforce secure sign-in.

## Feature Validation (Code Scan)

The following requested features are present in this repository:

1. User sign in: Included. Implemented using `loginRedirect` in the Angular app.
2. Sign out: Included. Implemented using `logoutRedirect` in the Angular app.
3. Password change: Included. User menu has a `Change Password` action that opens Microsoft password reset.
4. Create users on Azure Entra External via Graph API: Included. PowerShell script calls `POST /v1.0/users`.
5. Assign users app roles (`AgentAdmin`, `AgentUser`): Included. Script resolves role IDs and assigns app roles through `appRoleAssignments`.
6. PowerShell script to create users from legacy system in bulk: Included. Script imports CSV rows and provisions users in a loop.
7. Password change at first login: Included. Script sets `forceChangePasswordNextSignIn = $true` in password profile.

## Authentication Flow

- Unauthenticated users see a `Sign In` button.
- After successful sign-in, the app stores account context and routes to the landing page.
- Authenticated users can open the user menu to:
	- Change password
	- Sign out

## Bulk User Provisioning

The migration script is located at `scripts/create_entraid_users.ps1` and reads input from `scripts/CreateUsers.csv`.

Per CSV row, it can:

- Validate and normalize username/email/mobile input.
- Create the user identity in Entra External ID.
- Generate a temporary password.
- Force password change at first sign-in.
- Assign application role if role is provided.
- Export creation output and errors to `mapping_output.csv`.

### CSV Input

Expected columns include:

- `username`
- `displayName`
- `email`
- `mobile`
- `role`

Example roles in this project: `AgentAdmin`, `AgentUser`.

## Azure Setup with 2 App Registrations

This project assumes two app registrations in the same Entra tenant:

- Frontend app: SPA used by Angular/MSAL for user sign-in.
- Backend app: API app used for exposed scope, app roles, and script authentication for Graph calls.

### 1) Configure Backend App Registration (API)

Use this app registration for API scope and app roles.

- Authentication:
- Usually no SPA redirect URI is required for backend API app.
- Expose an API:
- Set Application ID URI to `api://<backend-client-id>`.
- Create scope `access_as_user`.
- Scope example full value: `api://<backend-client-id>/access_as_user`.
- App roles:
- Create app roles `AgentAdmin` and `AgentUser`.
- Allowed member types: `Users/Groups` (or include `Applications` only if needed).
- Ensure role values/display names match what CSV provides.

### 2) Configure Frontend App Registration (SPA)

Use this app registration for interactive login from Angular.

- Platform:
- Add `Single-page application (SPA)` platform.
- Redirect URI:
- Add `http://localhost:4205` (must match app configuration).
- Optional logout URL:
- Add `http://localhost:4205/`.
- API permissions:
- Microsoft Graph (Delegated): `openid`, `profile`, `email`.
- Your backend API delegated permission: `access_as_user` from backend app.
- Grant admin consent where your tenant policy requires it.

### 3) Frontend to Backend Permission Wiring

- In backend app `Expose an API`, create `access_as_user` first.
- In frontend app `API permissions`, add permission to "My APIs" -> backend app -> `access_as_user`.
- Frontend scope in code must be exactly:
- `api://<backend-client-id>/access_as_user`

Current project mapping:

- Frontend client ID in app config: `43c66cd5-9888-4c7e-8afc-d86ae632c93e`.
- Backend client ID used as API App ID URI: `3c22f04f-169d-4340-9eba-208a59821f15`.
- Authority tenant ID: `33271a02-1f66-4287-8dd6-84bf0d6701c2`.

### 4) Which App Registration to Use for the Bulk Script

Use the backend app registration (or another confidential app with same Graph Application permissions) for script token generation.

- Script uses OAuth2 client credentials with `https://graph.microsoft.com/.default`.
- Therefore the app used in script must have Graph **Application** permissions.

Required Graph Application permissions for script app:

- `User.ReadWrite.All`
- `AppRoleAssignment.ReadWrite.All`
- `Application.Read.All`
- `ServicePrincipal.Read.All`

After assigning these, click `Grant admin consent`.

### 5) Script Parameter Mapping for 2-App Setup

- `TenantId`: tenant where users are created.
- `ClientId`: backend app (or dedicated automation app) client ID with Graph Application permissions.
- `ClientSecret`: secret value of that confidential client app.
- `BackendAppId`: backend API app client ID where roles `AgentAdmin` and `AgentUser` are defined.
- `Issuer`: tenant domain used for identities, for example `yourtenant.onmicrosoft.com`.
- `CsvPath`: input file, default `./scripts/CreateUsers.csv`.
- `OutputMapping`: output result mapping file.

### 6) Redirect URI and Scope Consistency Checks

- Frontend redirect URI in Entra must equal value in app config (`http://localhost:4205`).
- Frontend requested scope must match backend exposed scope exactly.
- `knownAuthorities` must match your CIAM domain.
- `BackendAppId` in script must point to the same backend app where roles are configured.

### 7) Security and Operations

- Do not commit real `ClientSecret` values to source control.
- Prefer environment variables or Key Vault for secrets.
- Validate with 1-2 test users before full bulk migration.

### 8) Azure Portal Click Paths

Use these exact portal paths to configure each requirement.

Backend app (API app registration)

1. Azure Portal -> Microsoft Entra ID -> App registrations -> Select backend app.
2. Expose an API -> Set Application ID URI -> Save.
3. Expose an API -> Add a scope -> Scope name `access_as_user` -> Add scope.
4. App roles -> Create app role -> Add `AgentAdmin`.
5. App roles -> Create app role -> Add `AgentUser`.

Frontend app (SPA app registration)

1. Azure Portal -> Microsoft Entra ID -> App registrations -> Select frontend app.
2. Authentication -> Add a platform -> Single-page application.
3. Authentication -> Redirect URIs -> Add `http://localhost:4205`.
4. Authentication -> Front-channel logout URL (optional) -> `http://localhost:4205/`.
5. API permissions -> Add a permission -> APIs my organization uses -> Select backend app -> Delegated permissions -> `access_as_user` -> Add permissions.
6. API permissions -> Add a permission -> Microsoft Graph -> Delegated permissions -> `openid`, `profile`, `email` -> Add permissions.
7. API permissions -> Grant admin consent for your tenant (if required by policy).

Script app for Graph client credentials

1. Azure Portal -> Microsoft Entra ID -> App registrations -> Select script app (or backend app if reused).
2. Certificates & secrets -> New client secret -> Copy secret value.
3. API permissions -> Add a permission -> Microsoft Graph -> Application permissions.
4. Add `User.ReadWrite.All`, `AppRoleAssignment.ReadWrite.All`, `Application.Read.All`, `ServicePrincipal.Read.All`.
5. API permissions -> Grant admin consent for your tenant.

Collect and map values to script parameters

1. Overview -> Directory (tenant) ID -> map to `TenantId`.
2. Overview -> Application (client) ID of script app -> map to `ClientId`.
3. Certificates & secrets -> secret value -> map to `ClientSecret`.
4. Overview -> Application (client) ID of backend API app -> map to `BackendAppId`.
5. Entra tenant domain (for example `contoso.onmicrosoft.com`) -> map to `Issuer`.

## Run the Application

Install dependencies and start:

```bash
npm install
npm start
```

Default local URL is configured in the app for localhost development.

## Run Tests

```bash
npm test
```

## Run Bulk Provisioning Script

From project root:

```powershell
./scripts/create_entraid_users.ps1
```

If your system does not allow script execution due to restricted PowerShell policy and you do not have admin access, run the script inline in the current terminal session:

```powershell
$sb = [scriptblock]::Create((Get-Content -Raw ".\scripts\create_entraid_users_min.ps1")); & $sb
```

If you are using the standard script file, replace the file name with `.\scripts\create_entraid_users.ps1`.

You can override parameters such as tenant/app identifiers, CSV path, and output mapping file.

## Notes

- The script currently supports CSV-based migration from a legacy source into Entra.
- Ensure Entra app permissions for Microsoft Graph are granted before running provisioning.

## Enable SMS OTP MFA in Entra External ID (POC)

Use these steps to enable mobile OTP (SMS) as MFA for users created by the bulk provisioning script.

### Prerequisites

- You are signed in to the correct External tenant (customer tenant), not a different workforce tenant.
- The external tenant is linked to an active Azure subscription (required for SMS usage).
- Your target users sign in with a first factor such as Email + Password.

### Important Behavior

- MFA enforcement is policy-driven (Authentication methods + Conditional Access), not user-creation-driven.
- Setting `mobilePhone` in Graph helps with profile data, but does not by itself enforce MFA.
- SMS for External ID is billed separately from base MAU usage.

### Portal Steps (Simple Flow)

1. Switch to the external tenant
	- Entra admin center -> Settings (top bar) -> Directories + subscriptions -> select your External tenant.

2. Confirm billing/subscription link for SMS
	- Home -> Billing.
	- If not linked, use upgrade/add subscription flow and link an active subscription.

3. Enable SMS method
	- Entra ID -> Authentication methods -> SMS.
	- Set Enable to On.
	- Target: All users (or a POC group).
	- Save.

4. Create Conditional Access policy to require MFA
	- Entra ID -> Conditional Access -> Policies -> New policy.
	- Users: include target external users.
	- Target resources: select your frontend app registration.
	- Grant: Require multifactor authentication.
	- Enable policy: On.
	- Save.

5. If you get this error
	- Error: "Security defaults must be disabled to enable Conditional Access policy."
	- Fix in same tenant: Entra ID -> Overview -> Properties -> Manage security defaults -> Disable -> Save.
	- Then immediately enable your Conditional Access MFA policy.

6. Validate
	- Sign in with a newly created user.
	- Verify Email + Password first factor.
	- Verify SMS OTP challenge appears as second factor.

### Scope and Impact Clarification

- Security Defaults and Conditional Access are tenant-scoped settings.
- Changes affect only the tenant currently selected in Entra admin center.
- They do not globally change other tenants.

### Rollback

- To re-enable Security Defaults later:
  - Entra ID -> Overview -> Properties -> Manage security defaults -> Enable -> Save.
  - If Conditional Access policies are On, disable those policies first.
