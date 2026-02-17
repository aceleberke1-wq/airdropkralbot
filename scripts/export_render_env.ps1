param(
  [string]$EnvPath = ".env",
  [switch]$MaskSecrets
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
    $value = $line.Substring($idx + 1).Trim()
    if ($key) { $map[$key] = $value }
  }
  return $map
}

function Is-SecretKey {
  param([string]$Key)
  if ($Key -match "_ENABLED$") { return $false }
  if ($Key -eq "BOT_INSTANCE_LOCK_KEY") { return $false }
  return $Key -match "(BOT_TOKEN|WEBAPP_HMAC_SECRET|ADMIN_API_TOKEN|DATABASE_URL|PASSWORD|PRIVATE|SECRET)"
}

function Mask-Value {
  param([string]$Value)
  if ([string]::IsNullOrEmpty($Value)) { return "" }
  if ($Value.Length -le 8) { return "********" }
  return ($Value.Substring(0, 4) + "..." + $Value.Substring($Value.Length - 4, 4))
}

$required = @(
  "BOT_TOKEN",
  "ADMIN_TELEGRAM_ID",
  "BOT_USERNAME",
  "DATABASE_URL",
  "DATABASE_SSL",
  "WEBAPP_PUBLIC_URL",
  "WEBAPP_VERSION_OVERRIDE",
  "WEBAPP_HMAC_SECRET",
  "ADMIN_API_TOKEN",
  "BOT_DRY_RUN",
  "BOT_ENABLED",
  "KEEP_ADMIN_ON_BOT_EXIT",
  "BOT_AUTO_RESTART",
  "BOT_INSTANCE_LOCK_KEY",
  "FLAG_SOURCE_MODE",
  "ARENA_AUTH_ENABLED",
  "RAID_AUTH_ENABLED",
  "PVP_WS_ENABLED",
  "TOKEN_CURVE_ENABLED",
  "TOKEN_AUTO_APPROVE_ENABLED",
  "WEBAPP_V3_ENABLED",
  "WEBAPP_TS_BUNDLE_ENABLED"
)

$envMap = Get-EnvMap -Path $EnvPath
$missing = @()

Write-Host "Render env export ($EnvPath)" -ForegroundColor Cyan
Write-Host ""
foreach ($key in $required) {
  $value = [string]$envMap[$key]
  if ($key -eq "WEBAPP_VERSION_OVERRIDE") {
    if ([string]::IsNullOrWhiteSpace($value)) {
      Write-Host ($key + "=")
    } else {
      Write-Host ($key + "=" + $value)
    }
    continue
  }

  if ([string]::IsNullOrWhiteSpace($value)) {
    $missing += $key
    Write-Host ("[MISSING] " + $key) -ForegroundColor Red
    continue
  }
  $display = $value
  if ($MaskSecrets -and (Is-SecretKey -Key $key)) {
    $display = Mask-Value -Value $value
  }
  Write-Host ($key + "=" + $display)
}

Write-Host ""
if ($missing.Count -gt 0) {
  Write-Host "Missing required env keys:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host (" - " + $_) -ForegroundColor Red }
  exit 1
}

Write-Host "[OK] Required Render env keys are present." -ForegroundColor Green
exit 0
