param(
  [string]$EnvPath = ".env"
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

$envMap = Get-EnvMap -Path $EnvPath

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

Write-Host ""
Write-Host "Render env readiness:" -ForegroundColor Cyan
foreach ($key in $required) {
  $val = $envMap[$key]
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host ("[MISSING] " + $key) -ForegroundColor Red
  } else {
    Write-Host ("[OK]      " + $key) -ForegroundColor Green
  }
}

Write-Host ""

$db = [string]$envMap["DATABASE_URL"]
if ($db) {
  if ($db -match "^postgres(ql)?://") {
    Write-Host "[OK] DATABASE_URL scheme looks valid." -ForegroundColor Green
  } else {
    Write-Host "[WARN] DATABASE_URL must start with postgres:// or postgresql://." -ForegroundColor Yellow
  }
  if ($db -match "localhost|127\.0\.0\.1|::1") {
    Write-Host "[WARN] DATABASE_URL points to localhost. Render needs cloud DB URL (Neon/Render DB)." -ForegroundColor Yellow
  }
}

$web = [string]$envMap["WEBAPP_PUBLIC_URL"]
if ($web) {
  if (Is-ValidUrl -Value $web -RequireHttps) {
    Write-Host "[OK] WEBAPP_PUBLIC_URL is HTTPS." -ForegroundColor Green
  } else {
    Write-Host "[WARN] WEBAPP_PUBLIC_URL must be valid HTTPS URL." -ForegroundColor Yellow
  }
}

$secret = [string]$envMap["WEBAPP_HMAC_SECRET"]
if ($secret) {
  if ($secret.Length -lt 48 -or $secret -match "CHANGE|GENERATE|YOUR_") {
    Write-Host "[WARN] WEBAPP_HMAC_SECRET should be random and >= 48 chars." -ForegroundColor Yellow
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
Write-Host ""
Write-Host "If you also run local bot, stop one side to avoid 409 polling conflict."
Write-Host ""
