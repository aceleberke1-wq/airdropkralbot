param(
  [string]$EnvPath = ".env",
  [switch]$Strict,
  [string]$ExpectedAdminTelegramId = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvPath)) {
  Write-Error "Env file not found: $EnvPath"
  exit 1
}

function Get-EnvMap {
  param([string]$Path)
  $map = @{}
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -notmatch "=") { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($key) { $map[$key] = $val }
  }
  return $map
}

function Is-ValidUrl {
  param([string]$Value, [switch]$RequireHttps)
  try {
    $uri = [Uri]$Value
    if ($RequireHttps -and $uri.Scheme -ne "https") { return $false }
    return $true
  } catch {
    return $false
  }
}

function Normalize-TelegramId {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }
  $clean = $Value.Trim().Trim("'`"")
  if ($clean -notmatch '^\d+$') {
    return ""
  }
  return $clean
}

$envMap = Get-EnvMap -Path $EnvPath
$criticalIssues = 0

$required = @(
  "BOT_TOKEN",
  "BOT_USERNAME",
  "ADMIN_TELEGRAM_ID",
  "DATABASE_URL",
  "WEBAPP_HMAC_SECRET",
  "WEBAPP_PUBLIC_URL",
  "ADMIN_API_TOKEN",
  "BOT_DRY_RUN",
  "BOT_ENABLED",
  "KEEP_ADMIN_ON_BOT_EXIT",
  "BOT_AUTO_RESTART",
  "BOT_INSTANCE_LOCK_KEY"
)

$featureFlags = @(
  "ARENA_AUTH_ENABLED",
  "RAID_AUTH_ENABLED",
  "TOKEN_CURVE_ENABLED",
  "TOKEN_AUTO_APPROVE_ENABLED",
  "WEBAPP_V3_ENABLED",
  "WEBAPP_TS_BUNDLE_ENABLED"
)

Write-Host ""
Write-Host "Render env readiness:" -ForegroundColor Cyan
foreach ($key in $required) {
  $val = $envMap[$key]
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host ("[MISSING] " + $key) -ForegroundColor Red
    $criticalIssues += 1
  } else {
    Write-Host ("[OK]      " + $key) -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "V3 feature flags:" -ForegroundColor Cyan
foreach ($key in $featureFlags) {
  $val = [string]$envMap[$key]
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host ("[WARN]    " + $key + " missing (default 0).") -ForegroundColor Yellow
  } elseif ($val -in @("0", "1")) {
    Write-Host ("[OK]      " + $key + "=" + $val) -ForegroundColor Green
  } else {
    Write-Host ("[WARN]    " + $key + " should be 0 or 1.") -ForegroundColor Yellow
  }
}

Write-Host ""

$db = [string]$envMap["DATABASE_URL"]
if ($db) {
  if ($db -match "^postgres(ql)?://") {
    Write-Host "[OK] DATABASE_URL scheme looks valid." -ForegroundColor Green
  } else {
    Write-Host "[WARN] DATABASE_URL must start with postgres:// or postgresql://." -ForegroundColor Yellow
    if ($Strict) { $criticalIssues += 1 }
  }
  if ($db -match "localhost|127\.0\.0\.1|::1") {
    Write-Host "[WARN] DATABASE_URL points to localhost. Render needs cloud DB URL (Neon/Render DB)." -ForegroundColor Yellow
    if ($Strict) { $criticalIssues += 1 }
  }
}

$adminRaw = [string]$envMap["ADMIN_TELEGRAM_ID"]
$adminNormalized = Normalize-TelegramId -Value $adminRaw
if ($adminNormalized) {
  Write-Host "[OK] ADMIN_TELEGRAM_ID format is numeric." -ForegroundColor Green
} else {
  Write-Host "[WARN] ADMIN_TELEGRAM_ID must be a numeric Telegram ID." -ForegroundColor Yellow
  if ($Strict) { $criticalIssues += 1 }
}
if (-not [string]::IsNullOrWhiteSpace($ExpectedAdminTelegramId)) {
  $expected = Normalize-TelegramId -Value $ExpectedAdminTelegramId
  if (-not $expected) {
    Write-Host "[WARN] ExpectedAdminTelegramId is invalid. Pass /whoami numeric id." -ForegroundColor Yellow
    if ($Strict) { $criticalIssues += 1 }
  } elseif ($expected -eq $adminNormalized) {
    Write-Host "[OK] ADMIN_TELEGRAM_ID matches /whoami id." -ForegroundColor Green
  } else {
    Write-Host ("[MISMATCH] ADMIN_TELEGRAM_ID=" + $adminNormalized + " but expected=" + $expected) -ForegroundColor Red
    $criticalIssues += 1
  }
}

$web = [string]$envMap["WEBAPP_PUBLIC_URL"]
if ($web) {
  if (Is-ValidUrl -Value $web -RequireHttps) {
    Write-Host "[OK] WEBAPP_PUBLIC_URL is HTTPS." -ForegroundColor Green
  } else {
    Write-Host "[WARN] WEBAPP_PUBLIC_URL must be valid HTTPS URL." -ForegroundColor Yellow
    if ($Strict) { $criticalIssues += 1 }
  }
}

$secret = [string]$envMap["WEBAPP_HMAC_SECRET"]
if ($secret) {
  if ($secret.Length -lt 48 -or $secret -match "CHANGE|GENERATE|YOUR_") {
    Write-Host "[WARN] WEBAPP_HMAC_SECRET should be random and >= 48 chars." -ForegroundColor Yellow
    if ($Strict) { $criticalIssues += 1 }
  } else {
    Write-Host "[OK] WEBAPP_HMAC_SECRET length looks good." -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Suggested Render values for free plan:" -ForegroundColor Cyan
Write-Host "  BOT_ENABLED=1"
Write-Host "  KEEP_ADMIN_ON_BOT_EXIT=1"
Write-Host "  BOT_AUTO_RESTART=1"
Write-Host "  BOT_INSTANCE_LOCK_KEY=7262026"
Write-Host "  BOT_DRY_RUN=0"
Write-Host "  ARENA_AUTH_ENABLED=1"
Write-Host "  RAID_AUTH_ENABLED=1"
Write-Host "  TOKEN_CURVE_ENABLED=1"
Write-Host "  TOKEN_AUTO_APPROVE_ENABLED=1"
Write-Host "  WEBAPP_V3_ENABLED=1"
Write-Host "  WEBAPP_TS_BUNDLE_ENABLED=1"
Write-Host ""
Write-Host "If you also run local bot, stop one side to avoid 409 polling conflict."
Write-Host ""

if ($Strict -and $criticalIssues -gt 0) {
  Write-Error "Render env readiness failed with $criticalIssues blocking issue(s)."
  exit 1
}
