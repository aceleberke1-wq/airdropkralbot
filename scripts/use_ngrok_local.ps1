param(
  [int]$Port = 4000,
  [string]$EnvPath = ".env",
  [switch]$StartAdmin,
  [switch]$StartBot
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
  if ($null -eq $lines) { $lines = @() }

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

function Get-NgrokPath {
  $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ngrok.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($candidate) { return $candidate }

  return $null
}

function Get-CloudflaredPath {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  $wingetCandidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter cloudflared.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($wingetCandidate) { return $wingetCandidate }

  return $null
}

function Start-NgrokTunnel {
  param(
    [string]$NgrokPath,
    [int]$Port
  )

  Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500

  $ngrokLog = Join-Path $env:TEMP "airdropkral_ngrok.log"
  $ngrokErr = Join-Path $env:TEMP "airdropkral_ngrok.err.log"
  Remove-Item $ngrokLog -ErrorAction SilentlyContinue
  Remove-Item $ngrokErr -ErrorAction SilentlyContinue

  Start-Process -FilePath $NgrokPath -ArgumentList "http", "http://127.0.0.1:$Port", "--log=stdout" -RedirectStandardOutput $ngrokLog -RedirectStandardError $ngrokErr | Out-Null

  $publicUrl = $null
  $deadline = (Get-Date).AddSeconds(25)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
      $publicUrl = ($resp.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1).public_url
      if ($publicUrl) { break }
    } catch {
      Start-Sleep -Milliseconds 600
    }
  }

  if ($publicUrl) {
    return @{ Provider = "ngrok"; Url = $publicUrl; Log = $ngrokLog }
  }

  $logTail = ""
  if (Test-Path $ngrokLog) {
    $logTail = (Get-Content $ngrokLog -ErrorAction SilentlyContinue | Select-Object -Last 20) -join "`n"
  }
  if (Test-Path $ngrokErr) {
    $errTail = (Get-Content $ngrokErr -ErrorAction SilentlyContinue | Select-Object -Last 20) -join "`n"
    if ($errTail) {
      if ($logTail) { $logTail += "`n" }
      $logTail += $errTail
    }
  }
  return @{ Provider = "ngrok"; Url = $null; Log = $ngrokLog; Error = $logTail }
}

function Start-CloudflaredTunnel {
  param(
    [string]$CloudflaredPath,
    [int]$Port
  )

  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500

  $cfLog = Join-Path $env:TEMP "airdropkral_cloudflared.log"
  Remove-Item $cfLog -ErrorAction SilentlyContinue

  Start-Process -FilePath $CloudflaredPath -ArgumentList "tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate", "--logfile", $cfLog, "--loglevel", "info" | Out-Null

  $publicUrl = $null
  $deadline = (Get-Date).AddSeconds(35)
  $regex = "https://[a-z0-9-]+\.trycloudflare\.com"
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $cfLog) {
      $content = Get-Content $cfLog -Raw -ErrorAction SilentlyContinue
      if ($content -match $regex) {
        $publicUrl = $matches[0]
        break
      }
    }
    Start-Sleep -Milliseconds 700
  }

  if ($publicUrl) {
    return @{ Provider = "cloudflared"; Url = $publicUrl; Log = $cfLog }
  }

  $logTail = ""
  if (Test-Path $cfLog) {
    $logTail = (Get-Content $cfLog -ErrorAction SilentlyContinue | Select-Object -Last 30) -join "`n"
  }
  return @{ Provider = "cloudflared"; Url = $null; Log = $cfLog; Error = $logTail }
}

function Wait-HttpReady {
  param([string]$Url, [int]$TimeoutSec = 45)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

function Stop-BotProcess {
  $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and $cmd -like "*apps\\bot\\src\\index.js*"
  }
  foreach ($proc in $nodeProcs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {}
  }
}

function Stop-AdminProcess {
  $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and $cmd -like "*apps\\admin-api\\src\\index.js*"
  }
  foreach ($proc in $nodeProcs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {}
  }
}

$repoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $repoPath
try {
  if ($StartAdmin) {
    Stop-AdminProcess
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repoPath'; npm run dev:admin" | Out-Null
  }

  $healthUrl = "http://127.0.0.1:$Port/health"
  if (-not (Wait-HttpReady -Url $healthUrl -TimeoutSec 50)) {
    Write-Error "Admin API not reachable at $healthUrl. Start admin first: npm run dev:admin"
    exit 1
  }

  $publicUrl = $null
  $provider = $null
  $debugError = ""

  $ngrokPath = Get-NgrokPath
  if ($ngrokPath) {
    $ngrokResult = Start-NgrokTunnel -NgrokPath $ngrokPath -Port $Port
    if ($ngrokResult.Url) {
      $publicUrl = $ngrokResult.Url
      $provider = $ngrokResult.Provider
    } else {
      $debugError += "ngrok failed.`n$($ngrokResult.Error)`n"
    }
  } else {
    $debugError += "ngrok not found.`n"
  }

  if (-not $publicUrl) {
    $cloudflaredPath = Get-CloudflaredPath
    if ($cloudflaredPath) {
      $cfResult = Start-CloudflaredTunnel -CloudflaredPath $cloudflaredPath -Port $Port
      if ($cfResult.Url) {
        $publicUrl = $cfResult.Url
        $provider = $cfResult.Provider
      } else {
        $debugError += "cloudflared failed.`n$($cfResult.Error)`n"
      }
    } else {
      $debugError += "cloudflared not found.`n"
    }
  }

  if (-not $publicUrl) {
    Write-Error "No HTTPS tunnel URL found. Diagnostics:`n$debugError"
    exit 1
  }

  $webappUrl = "$publicUrl/webapp"
  Set-EnvValue -Path $EnvPath -Key "WEBAPP_PUBLIC_URL" -Value $webappUrl
  Write-Host "WEBAPP_PUBLIC_URL updated ($provider): $webappUrl" -ForegroundColor Green

  if ($StartBot) {
    Stop-BotProcess
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repoPath'; `$env:BOT_DRY_RUN='0'; npm run dev:bot" | Out-Null
  }

  Write-Host ""
  Write-Host "Next:" -ForegroundColor Cyan
  Write-Host "1) Restart bot if not already restarted."
  Write-Host "2) Telegram -> /play"
  Write-Host "3) Tunnel URL can change on restart. Re-run this script when needed."
} finally {
  Pop-Location
}
