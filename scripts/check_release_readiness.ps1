param(
  [string]$EnvPath = ".env",
  [string]$HealthBaseUrl = "",
  [switch]$SkipTests,
  [switch]$SkipWebAppBuild,
  [switch]$SkipMigrate,
  [switch]$SkipHealth,
  [string]$ExpectedAdminTelegramId = "1995400205",
  [string]$ExpectedWebAppPublicUrl = "https://webapp.k99-exchange.xyz/webapp?v=20260213-1"
)

$ErrorActionPreference = "Stop"

function Get-EnvMap {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Env file not found: $Path"
  }
  $map = @{}
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*#") { continue }
    if ($line -notmatch "=") { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($key) {
      $map[$key] = $value
    }
  }
  return $map
}

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  Write-Host ""
  Write-Host ("==> " + $Name) -ForegroundColor Cyan
  & $Action
}

function Parse-JsonSafely {
  param([string]$Raw)
  try {
    return $Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $null
  }
}

function Resolve-HealthBaseUrl {
  param(
    [string]$ExplicitUrl,
    [hashtable]$EnvMap
  )
  if (-not [string]::IsNullOrWhiteSpace($ExplicitUrl)) {
    return $ExplicitUrl.Trim().TrimEnd("/")
  }
  $web = [string]$EnvMap["WEBAPP_PUBLIC_URL"]
  if ([string]::IsNullOrWhiteSpace($web)) {
    return ""
  }
  $trimmed = $web.Trim()
  try {
    $uri = [Uri]$trimmed
    $authority = $uri.GetLeftPart([System.UriPartial]::Authority)
    if ([string]::IsNullOrWhiteSpace($authority)) {
      return $trimmed.TrimEnd("/")
    }
    return $authority.TrimEnd("/")
  } catch {
    $fallback = $trimmed.TrimEnd("/")
    if ($fallback.ToLower().EndsWith("/webapp")) {
      return $fallback.Substring(0, $fallback.Length - 7)
    }
    return $fallback
  }
}

function Compare-EnvKeys {
  param(
    [hashtable]$CurrentMap,
    [string]$ExamplePath
  )
  if (-not (Test-Path $ExamplePath)) {
    return @{
      Missing = @()
      Extra = @()
    }
  }
  $exampleMap = Get-EnvMap -Path $ExamplePath
  $expectedKeys = $exampleMap.Keys | Sort-Object -Unique
  $currentKeys = $CurrentMap.Keys | Sort-Object -Unique
  $missing = @($expectedKeys | Where-Object { $_ -notin $currentKeys })
  $extra = @($currentKeys | Where-Object { $_ -notin $expectedKeys })
  return @{
    Missing = $missing
    Extra = $extra
  }
}

$envMap = Get-EnvMap -Path $EnvPath
$root = Split-Path -Parent $PSScriptRoot
$failed = $false

try {
  Invoke-Step "Strict env validation" {
    $args = @(
      "-ExecutionPolicy", "Bypass",
      "-File", (Join-Path $PSScriptRoot "check_render_env.ps1"),
      "-EnvPath", $EnvPath,
      "-Strict"
    )
    if (-not [string]::IsNullOrWhiteSpace($ExpectedAdminTelegramId)) {
      $args += @("-ExpectedAdminTelegramId", $ExpectedAdminTelegramId)
    }
    if (-not [string]::IsNullOrWhiteSpace($ExpectedWebAppPublicUrl)) {
      $args += @("-ExpectedWebAppPublicUrl", $ExpectedWebAppPublicUrl)
    }
    & powershell @args
    if ($LASTEXITCODE -ne 0) {
      throw "check_render_env failed with exit code $LASTEXITCODE"
    }
  }

  if (-not $SkipTests) {
    Invoke-Step "Unit/integration tests (bot)" {
      & npm run test:bot
      if ($LASTEXITCODE -ne 0) {
        throw "npm run test:bot failed"
      }
    }
  }

  if (-not $SkipWebAppBuild) {
    Invoke-Step "WebApp bundle build" {
      & npm run build:webapp
      if ($LASTEXITCODE -ne 0) {
        throw "npm run build:webapp failed"
      }
    }
  }

  if (-not $SkipMigrate) {
    Invoke-Step "Migration check" {
      & npm run migrate:node
      if ($LASTEXITCODE -ne 0) {
        throw "npm run migrate:node failed"
      }
    }
  }

  Invoke-Step "Env key diff report (.env vs .env.example)" {
    $diff = Compare-EnvKeys -CurrentMap $envMap -ExamplePath (Join-Path $root ".env.example")
    if ($diff.Missing.Count -gt 0) {
      Write-Host "[MISSING IN .env]" -ForegroundColor Red
      $diff.Missing | ForEach-Object { Write-Host ("  - " + $_) -ForegroundColor Red }
      throw "Required keys missing in .env"
    }
    Write-Host "[OK] No missing keys from .env.example" -ForegroundColor Green
    if ($diff.Extra.Count -gt 0) {
      Write-Host "[INFO] Extra keys present in .env:" -ForegroundColor Yellow
      $diff.Extra | ForEach-Object { Write-Host ("  + " + $_) -ForegroundColor Yellow }
    }
  }

  if (-not $SkipHealth) {
    Invoke-Step "Health smoke check (/healthz + /health + /webapp)" {
      $base = Resolve-HealthBaseUrl -ExplicitUrl $HealthBaseUrl -EnvMap $envMap
      if ([string]::IsNullOrWhiteSpace($base)) {
        throw "HealthBaseUrl could not be resolved. Set WEBAPP_PUBLIC_URL or pass -HealthBaseUrl."
      }
      Write-Host ("Base URL: " + $base)

      $healthz = Invoke-WebRequest -UseBasicParsing -Uri ($base + "/healthz") -TimeoutSec 20
      if ($healthz.StatusCode -ne 200) {
        throw "/healthz status " + $healthz.StatusCode
      }
      $healthzPayload = Parse-JsonSafely -Raw $healthz.Content
      if (-not $healthzPayload -or -not $healthzPayload.ok) {
        throw "/healthz payload not healthy"
      }

      $health = Invoke-WebRequest -UseBasicParsing -Uri ($base + "/health") -TimeoutSec 20
      if ($health.StatusCode -ne 200) {
        throw "/health status " + $health.StatusCode
      }
      $healthPayload = Parse-JsonSafely -Raw $health.Content
      if (-not $healthPayload -or -not $healthPayload.ok) {
        throw "/health payload not healthy"
      }

      $webapp = Invoke-WebRequest -UseBasicParsing -Uri ($base + "/webapp") -TimeoutSec 20
      if ($webapp.StatusCode -ne 200) {
        throw "/webapp status " + $webapp.StatusCode
      }
      Write-Host "[OK] Health endpoints are reachable." -ForegroundColor Green
    }
  }
}
catch {
  $failed = $true
  Write-Host ""
  Write-Host ("Release readiness FAILED: " + $_.Exception.Message) -ForegroundColor Red
}

Write-Host ""
if ($failed) {
  exit 1
}

Write-Host "Release readiness PASS." -ForegroundColor Green
exit 0
