param(
  [switch]$ForceRotateAdminToken,
  [switch]$ForceRotateWebAppSecret
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
  } else {
    Write-Error ".env.example bulunamadi"
    exit 1
  }
}

$lines = Get-Content ".env"

function Set-OrAdd {
  param([string]$Key, [string]$Value)
  $script:lines = $script:lines | Where-Object { $_ -notmatch "^\s*$Key\s*=" }
  $script:lines += "$Key=$Value"
}

function Get-Value {
  param([string]$Key)
  $match = $script:lines | Where-Object { $_ -cmatch "^\s*$Key\s*=" } | Select-Object -First 1
  if (-not $match) { return "" }
  return (($match -split "=", 2)[1]).Trim()
}

function New-RandomToken {
  param([int]$Length = 48)
  $chars = (48..57) + (65..90) + (97..122)
  return -join ($chars | Get-Random -Count $Length | ForEach-Object { [char]$_ })
}

$adminToken = Get-Value "ADMIN_API_TOKEN"
if ($ForceRotateAdminToken -or -not $adminToken -or $adminToken -eq "CHANGEME") {
  Set-OrAdd "ADMIN_API_TOKEN" (New-RandomToken)
}

$webSecret = Get-Value "WEBAPP_HMAC_SECRET"
if ($ForceRotateWebAppSecret -or -not $webSecret -or $webSecret -eq "CHANGEME") {
  Set-OrAdd "WEBAPP_HMAC_SECRET" (New-RandomToken)
}

if (-not (Get-Value "BOT_USERNAME")) {
  Set-OrAdd "BOT_USERNAME" "airdropkral_2026_bot"
}
if (-not (Get-Value "WEBAPP_PUBLIC_URL")) {
  Set-OrAdd "WEBAPP_PUBLIC_URL" "http://localhost:4000/webapp"
}
if (-not (Get-Value "WEBAPP_AUTH_TTL_SEC")) {
  Set-OrAdd "WEBAPP_AUTH_TTL_SEC" "900"
}

if (-not (Get-Value "LOOP_V2_ENABLED")) {
  Set-OrAdd "LOOP_V2_ENABLED" "1"
}
if (-not (Get-Value "PAYOUT_BTC_THRESHOLD")) {
  Set-OrAdd "PAYOUT_BTC_THRESHOLD" "0.0001"
}
if (-not (Get-Value "HC_TO_BTC_RATE")) {
  Set-OrAdd "HC_TO_BTC_RATE" "0.00001"
}
if (-not (Get-Value "PAYOUT_COOLDOWN_HOURS")) {
  Set-OrAdd "PAYOUT_COOLDOWN_HOURS" "72"
}

$lines | Set-Content ".env"
Write-Host ".env bootstrap tamamlandi" -ForegroundColor Green
