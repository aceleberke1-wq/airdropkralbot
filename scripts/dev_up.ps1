param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$WithTunnel,
  [int]$Port = 4000
)

$ErrorActionPreference = "Stop"

function Stop-BotNodeProcesses {
  $patterns = @(
    "apps\\bot\\src\\index.js",
    "apps\\admin-api\\src\\index.js"
  )

  $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) {
      return $false
    }
    foreach ($pattern in $patterns) {
      if ($cmd -like "*$pattern*") {
        return $true
      }
    }
    return $false
  }

  foreach ($proc in $nodeProcs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
      Write-Host "Stopped old node process: $($proc.ProcessId)"
    } catch {
      Write-Host "Skip stop process $($proc.ProcessId): $($_.Exception.Message)"
    }
  }
}

function Escape-SingleQuote([string]$value) {
  return $value -replace "'", "''"
}

Push-Location $RepoPath
try {
  Write-Host "Repo: $RepoPath"
  Stop-BotNodeProcesses

  Write-Host "Running migrations..."
  powershell -ExecutionPolicy Bypass -File ".\\scripts\\migrate.ps1"

  $repoEscaped = Escape-SingleQuote $RepoPath
  $adminCmd = "cd '$repoEscaped'; npm run dev:admin"
  $botCmd = "cd '$repoEscaped'; `$env:BOT_DRY_RUN='0'; npm run dev:bot"

  Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd | Out-Null
  Start-Sleep -Seconds 2

  if ($WithTunnel) {
    Write-Host "Setting HTTPS tunnel URL for WEBAPP_PUBLIC_URL..."
    powershell -ExecutionPolicy Bypass -File ".\\scripts\\use_ngrok_local.ps1" -Port $Port
  }

  Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd | Out-Null

  Write-Host "Admin API and Bot started in two new PowerShell windows."
  if ($WithTunnel) {
    Write-Host "Tunnel mode active: WEBAPP_PUBLIC_URL was updated to HTTPS tunnel."
  }
  Write-Host "If Telegram still does not respond, check bot window for 409 conflict."
} finally {
  Pop-Location
}
