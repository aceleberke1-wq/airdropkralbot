param(
  [string]$WebAppHost = "webapp.k99-exchange.xyz",
  [string]$DnsTarget = "airdropkral-admin.onrender.com",
  [string]$EnvPath = ".env"
)

$ErrorActionPreference = "Stop"

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $lines = Get-Content $Path -ErrorAction SilentlyContinue
  if ($null -eq $lines) {
    $lines = @()
  }

  $pattern = "^\s*$([Regex]::Escape($Key))\s*="
  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines += "$Key=$Value"
  }

  Set-Content -Path $Path -Value $lines
}

function Get-EnvValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  $pattern = "^\s*$([Regex]::Escape($Key))\s*=\s*(.*)\s*$"
  foreach ($line in Get-Content $Path) {
    if ($line -match $pattern) {
      return $matches[1]
    }
  }
  return ""
}

if (-not (Test-Path $EnvPath) -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" $EnvPath -Force
}

$secret = Get-EnvValue -Path $EnvPath -Key "WEBAPP_HMAC_SECRET"
if ([string]::IsNullOrWhiteSpace($secret) -or $secret -match "^GENERATE_WITH_") {
  $secret = [Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
}

$publicUrl = "https://$WebAppHost/webapp"
Set-EnvValue -Path $EnvPath -Key "WEBAPP_PUBLIC_URL" -Value $publicUrl
Set-EnvValue -Path $EnvPath -Key "WEBAPP_HMAC_SECRET" -Value $secret

Write-Host ""
Write-Host "Env updated:" -ForegroundColor Green
Write-Host "  WEBAPP_PUBLIC_URL=$publicUrl"
Write-Host "  WEBAPP_HMAC_SECRET=SET"
Write-Host ""
Write-Host "Namecheap (or active DNS provider) records:" -ForegroundColor Cyan
Write-Host "  Type: CNAME"
Write-Host "  Host:  webapp"
Write-Host "  Value: $DnsTarget"
Write-Host "  TTL:   Automatic"

$parts = $WebAppHost.Split(".")
if ($parts.Length -ge 2) {
  $root = "$($parts[$parts.Length - 2]).$($parts[$parts.Length - 1])"
  try {
    $nsRecords = Resolve-DnsName -Type NS $root -ErrorAction Stop
    $nsHosts = @($nsRecords | ForEach-Object { $_.NameHost } | Where-Object { $_ })
    if ($nsHosts.Count -gt 0) {
      Write-Host ""
      Write-Host ("Active NS for " + $root + ": " + ($nsHosts -join ", ")) -ForegroundColor Cyan
      $usesNamecheap = ($nsHosts | Where-Object { $_ -like "*registrar-servers.com*" }).Count -gt 0
      if (-not $usesNamecheap) {
        Write-Host "DNS records must be created in the current NS provider panel (not Namecheap Advanced DNS)." -ForegroundColor Yellow
      }
    }
  } catch {
    Write-Host ""
    Write-Host "Could not resolve NS records for $root yet." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "After DNS is live, restart services:"
Write-Host "  npm run dev:admin"
Write-Host "  `$env:BOT_DRY_RUN='0'; npm run dev:bot"
Write-Host ""
Write-Host "Render checklist (critical):" -ForegroundColor Cyan
Write-Host "  1) Web service airdropkral-admin -> Settings -> Custom Domains"
Write-Host "  2) Add: $WebAppHost"
Write-Host "  3) Wait until SSL status is Active/Issued"
Write-Host "  4) Test: https://$WebAppHost/health"
