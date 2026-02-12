Write-Host "AirdropKralBot Doctor" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan

$tools = @("node", "npm", "docker", "psql")
foreach ($tool in $tools) {
  $cmd = Get-Command $tool -ErrorAction SilentlyContinue
  if ($null -eq $cmd) {
    Write-Host "[MISSING] $tool" -ForegroundColor Yellow
  } else {
    Write-Host "[OK] $tool -> $($cmd.Source)" -ForegroundColor Green
  }
}

$dockerCompose = $null
try {
  $dockerCompose = docker compose version 2>$null
} catch {}
if ($dockerCompose) {
  Write-Host "[OK] docker compose" -ForegroundColor Green
} else {
  $dockerCompose = Get-Command docker-compose -ErrorAction SilentlyContinue
  if ($dockerCompose) {
    Write-Host "[OK] docker-compose" -ForegroundColor Green
  } else {
    Write-Host "[MISSING] docker compose or docker-compose" -ForegroundColor Yellow
  }
}

if (Test-Path ".env") {
  Write-Host "[OK] .env present" -ForegroundColor Green

  $requiredEnv = @(
    "BOT_TOKEN",
    "BOT_USERNAME",
    "ADMIN_TELEGRAM_ID",
    "BTC_PAYOUT_ADDRESS_PRIMARY",
    "TRX_PAYOUT_ADDRESS",
    "ETH_PAYOUT_ADDRESS",
    "SOL_PAYOUT_ADDRESS",
    "TON_PAYOUT_ADDRESS",
    "DATABASE_URL",
    "ADMIN_API_TOKEN",
    "WEBAPP_PUBLIC_URL",
    "WEBAPP_HMAC_SECRET"
  )

  $lines = Get-Content ".env"
  $found = @{}
  $malformed = @()
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match "^\s*$" -or $line -match "^\s*#") {
      continue
    }
    if ($line -cmatch "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
      $found[$matches[1]] = $true
      continue
    }
    $malformed += ($i + 1)
  }

  if ($malformed.Count -gt 0) {
    Write-Host ("[WARN] .env malformed line(s): " + ($malformed -join ", ")) -ForegroundColor Yellow
  } else {
    Write-Host "[OK] .env syntax looks valid" -ForegroundColor Green
  }

  $missing = @()
  foreach ($key in $requiredEnv) {
    if (-not $found.ContainsKey($key)) {
      $missing += $key
    }
  }

  if ($missing.Count -gt 0) {
    Write-Host ("[WARN] Missing required env key(s): " + ($missing -join ", ")) -ForegroundColor Yellow
  } else {
    Write-Host "[OK] Required env keys are present" -ForegroundColor Green
  }

  $webAppLine = $lines | Where-Object { $_ -match "^\s*WEBAPP_PUBLIC_URL\s*=" } | Select-Object -First 1
  if ($webAppLine) {
    $webAppUrl = ($webAppLine -split "=", 2)[1].Trim()
    if ($webAppUrl) {
      try {
        $uri = [Uri]$webAppUrl
        if ($uri.Scheme -ne "https") {
          Write-Host "[WARN] WEBAPP_PUBLIC_URL is not HTTPS. Telegram web_app button requires HTTPS." -ForegroundColor Yellow
        } else {
          Write-Host "[OK] WEBAPP_PUBLIC_URL is HTTPS" -ForegroundColor Green
        }

        $hostName = $uri.Host
        if ($hostName) {
          try {
            $parts = $hostName.Split(".")
            if ($parts.Length -ge 2) {
              $root = "$($parts[$parts.Length - 2]).$($parts[$parts.Length - 1])"
              $nsRecords = Resolve-DnsName -Type NS $root -ErrorAction Stop
              $nsHosts = @($nsRecords | ForEach-Object { $_.NameHost } | Where-Object { $_ })
              if ($nsHosts.Count -gt 0) {
                Write-Host ("[INFO] NS for " + $root + ": " + ($nsHosts -join ", ")) -ForegroundColor Cyan
                $isNamecheapNs = ($nsHosts | Where-Object { $_ -like "*registrar-servers.com*" }).Count -gt 0
                if (-not $isNamecheapNs) {
                  Write-Host "[WARN] Domain is not using Namecheap BasicDNS. Namecheap Advanced DNS records will be ignored." -ForegroundColor Yellow
                }
              }
            }
          } catch {
            Write-Host "[INFO] Could not resolve NS records for WEBAPP_PUBLIC_URL host." -ForegroundColor Yellow
          }
        }
      } catch {
        Write-Host "[WARN] WEBAPP_PUBLIC_URL is not a valid URL." -ForegroundColor Yellow
      }
    }
  }
} else {
  Write-Host "[INFO] .env missing (copy from .env.example)" -ForegroundColor Yellow
}

Write-Host "====================" -ForegroundColor Cyan
Write-Host "Run from repo root: $PWD" -ForegroundColor Cyan
