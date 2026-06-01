param(
  [string]$TenantId = "",
  [string]$ClientId = "",
  [string]$ClientSecret = "",
  [string]$CsvPath = ".\scripts\CreateUsers.csv",
  [string]$BackendAppId = "",
  [string]$Issuer = "<tenant>.onmicrosoft.com",
  [string]$OutputMapping = "mapping_output.csv"
)

if (-not (Test-Path $CsvPath)) {
  Write-Error "CSV not found: $CsvPath"
  exit 1
}

function Get-Token {
  $tokenUrl = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
  $body = @{
    grant_type    = 'client_credentials'
    client_id     = $ClientId
    client_secret = $ClientSecret
    scope         = 'https://graph.microsoft.com/.default'
  }
  (Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType 'application/x-www-form-urlencoded').access_token
}

function Invoke-Graph {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$Token,
    $Body = $null
  )

  $headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }

  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 10
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $jsonBody
    }
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
  }
  catch {
    $status = if ($_.Exception.Response -and $_.Exception.Response.StatusCode) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $detail = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    throw "Graph API failed (HTTP $status): $detail"
  }
}

function Resolve-RoleId {
  param($AppRoles, [string]$RequestedRole)

  foreach ($r in $AppRoles) {
    if ($null -eq $r) { continue }
    if ($r.displayName -and $r.displayName.Equals($RequestedRole, [System.StringComparison]::OrdinalIgnoreCase)) { return $r.id }
    if ($r.value -and $r.value.Equals($RequestedRole, [System.StringComparison]::OrdinalIgnoreCase)) { return $r.id }
    if ($r.id -and $r.id.ToString().Equals($RequestedRole, [System.StringComparison]::OrdinalIgnoreCase)) { return $r.id }
  }

  return $null
}

function New-MappingRow {
  param(
    $Row,
    [string]$Username = '',
    [string]$DisplayName = '',
    [string]$SignInEmail = '',
    [string]$Email = '',
    [string]$Mobile = '',
    [string]$Role = '',
    [string]$TempPassword = '',
    [string]$EntraUserId = '',
    [string]$Error = ''
  )

  [PSCustomObject]@{
    username = $Username
    displayName = if ($DisplayName) { $DisplayName } elseif ($Row.displayName) { $Row.displayName } else { '' }
    signInEmail = $SignInEmail
    email = if ($Email) { $Email } elseif ($Row.email) { $Row.email } else { '' }
    mobile = if ($Mobile) { $Mobile } elseif ($Row.mobile) { $Row.mobile } else { '' }
    role = if ($Role) { $Role } elseif ($Row.role) { $Row.role } else { '' }
    tempPassword = $TempPassword
    entraUserId = $EntraUserId
    error = $Error
  }
}

Write-Host "Getting Graph token..."
$token = Get-Token

Write-Host "Resolving app and service principal..."
$appResp = Invoke-Graph -Method Get -Url "https://graph.microsoft.com/v1.0/applications?`$filter=appId eq '$BackendAppId'" -Token $token
if (-not $appResp.value -or $appResp.value.Count -eq 0) {
  Write-Error "Application not found for appId: $BackendAppId"
  exit 1
}
$app = $appResp.value[0]
$appRoles = $app.appRoles

$spResp = Invoke-Graph -Method Get -Url "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=appId eq '$BackendAppId'" -Token $token
if (-not $spResp.value -or $spResp.value.Count -eq 0) {
  Write-Error "Service principal not found for appId: $BackendAppId"
  exit 1
}
$sp = $spResp.value[0]

$rows = Import-Csv -Path $CsvPath
$mapping = @()

foreach ($row in $rows) {
  $username = ($row.username).ToString().Trim().ToLower()
  if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Warning "Skipping row with empty username"
    $mapping += New-MappingRow -Row $row -Error 'invalid username: empty username in CSV'
    continue
  }

  if ($username -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    Write-Warning "Skipping row for '$username': username must be a valid email address"
    $mapping += New-MappingRow -Row $row -Username $username -Error 'invalid username: must be a valid email address'
    continue
  }

  $csvDisplayName = if ($row.displayName) { $row.displayName.ToString().Trim() } else { '' }
  $displayName = if (-not [string]::IsNullOrWhiteSpace($csvDisplayName)) { $csvDisplayName } else { $username }
  $signInEmail = $username
  $mailNickname = (($username -split '@')[0]).ToLower()
  $email = if ($row.email) { $row.email.ToString().Trim().ToLower() } else { $null }
  $mobileRaw = if ($row.mobile) { $row.mobile.ToString().Trim() } else { '' }
  $mobile = ''
  if (-not [string]::IsNullOrWhiteSpace($mobileRaw)) {
    # Accept +E.164 directly, or normalize digits-only values to +E.164.
    if ($mobileRaw -match '^\+[1-9]\d{7,14}$') {
      $mobile = $mobileRaw
    }
    elseif ($mobileRaw -match '^[1-9]\d{7,14}$') {
      $mobile = "+$mobileRaw"
    }
    else {
      Write-Warning "Invalid mobile format for '$username': '$mobileRaw'. Expected +E.164 (example: +919730011345)"
    }
  }
  $roleName = if ($row.role) { $row.role } else { $null }

  $tempPassword = "Temp#" + (Get-Random -Minimum 100000 -Maximum 999999) + "Aa!"

  $userBody = @{
    accountEnabled = $true
    displayName = $displayName
    mailNickname = $mailNickname
    passwordProfile = @{
      forceChangePasswordNextSignIn = $true
      password = $tempPassword
    }
    passwordPolicies = 'DisablePasswordExpiration'
    identities = @(
      @{
        signInType = 'emailAddress'
        issuer = $Issuer
        issuerAssignedId = $signInEmail
      }
    )
  }

  if ($email -and $email -match '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    $userBody.otherMails = @($email)
  }

  if ($mobile) {
    $userBody.mobilePhone = $mobile
  }

  $userId = ''
  $errorText = ''

  try {
    $createResp = Invoke-Graph -Method Post -Url 'https://graph.microsoft.com/v1.0/users' -Token $token -Body $userBody
    $userId = $createResp.id
    Write-Host "Created user $username -> $userId"
  }
  catch {
    $errorText = 'create failed: {0}' -f $_.Exception.Message
    Write-Warning ('Create failed for {0}: {1}' -f $username, $_.Exception.Message)
  }

  if ($userId -and $roleName) {
    $roleId = Resolve-RoleId -AppRoles $appRoles -RequestedRole $roleName
    if ($roleId) {
      try {
        $assignBody = @{ principalId = $userId; resourceId = $sp.id; appRoleId = $roleId }
        Invoke-Graph -Method Post -Url "https://graph.microsoft.com/v1.0/users/$userId/appRoleAssignments" -Token $token -Body $assignBody | Out-Null
        Write-Host "Assigned role $roleName to $username"
      }
      catch {
        $assignError = 'role assignment failed: {0}' -f $_.Exception.Message
        $errorText = if ($errorText) { '{0} | {1}' -f $errorText, $assignError } else { $assignError }
        Write-Warning ('Role assignment failed for {0}: {1}' -f $username, $_.Exception.Message)
      }
    }
    else {
      $roleError = "role '$roleName' not found on app"
      $errorText = if ($errorText) { '{0} | {1}' -f $errorText, $roleError } else { $roleError }
      Write-Warning "Role '$roleName' not found. Skipping assignment for $username"
    }
  }

  $mapping += New-MappingRow -Row $row -Username $username -DisplayName $displayName -SignInEmail $signInEmail -Email $email -Mobile $mobile -Role $roleName -TempPassword $tempPassword -EntraUserId $userId -Error $errorText
}

$mapping | Export-Csv -Path $OutputMapping -NoTypeInformation -Force
Write-Host "Done. Mapping written to $OutputMapping"