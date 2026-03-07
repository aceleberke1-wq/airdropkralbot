param(
  [string]$TaskName = "AirdropKralBot-V5-LiveOps-15M",
  [int]$EveryMinutes = 15,
  [ValidateSet("LIMITED", "HIGHEST")]
  [string]$RunLevel = "LIMITED",
  [switch]$UnregisterOnly
)

$ErrorActionPreference = "Stop"

if ($EveryMinutes -lt 5 -or $EveryMinutes -gt 1440) {
  throw "EveryMinutes must be between 5 and 1440."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskRunnerDir = Join-Path $env:LOCALAPPDATA "AirdropKralBot"
if (-not (Test-Path $taskRunnerDir)) {
  New-Item -ItemType Directory -Path $taskRunnerDir -Force | Out-Null
}
$taskRunnerPath = Join-Path $taskRunnerDir "run_v5_live_ops_campaign_dispatch.cmd"
$runnerBody = @"
@echo off
setlocal
cd /d "$repoRoot"
call npm run liveops:v5:dispatch
endlocal
"@
Set-Content -Path $taskRunnerPath -Value $runnerBody -Encoding ASCII
$taskCommand = "`"$taskRunnerPath`""

if ($UnregisterOnly) {
  schtasks /Delete /TN $TaskName /F | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[warn] Task not found or remove failed: $TaskName"
    exit 0
  }
  Write-Host "[ok] Task removed: $TaskName"
  exit 0
}

$createArgs = @(
  "/Create",
  "/F",
  "/TN", $TaskName,
  "/SC", "MINUTE",
  "/MO", "$EveryMinutes",
  "/TR", $taskCommand,
  "/RL", $RunLevel
)

schtasks @createArgs | Out-Null
if ($LASTEXITCODE -ne 0) {
  if ($RunLevel -eq "HIGHEST") {
    Write-Host "[warn] HIGHEST failed, retrying with LIMITED"
    $retryArgs = @(
      "/Create",
      "/F",
      "/TN", $TaskName,
      "/SC", "MINUTE",
      "/MO", "$EveryMinutes",
      "/TR", $taskCommand,
      "/RL", "LIMITED"
    )
    schtasks @retryArgs | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Task registration failed: $TaskName"
    }
    Write-Host "[ok] Task registered with LIMITED: $TaskName (every $EveryMinutes minutes)"
    Write-Host "[info] To remove: powershell -ExecutionPolicy Bypass -File scripts/register_v5_live_ops_campaign_tasks.ps1 -TaskName `"$TaskName`" -UnregisterOnly"
    exit 0
  }
  throw "Task registration failed: $TaskName"
}
Write-Host "[ok] Task registered: $TaskName (every $EveryMinutes minutes, RL=$RunLevel)"
Write-Host "[info] To remove: powershell -ExecutionPolicy Bypass -File scripts/register_v5_live_ops_campaign_tasks.ps1 -TaskName `"$TaskName`" -UnregisterOnly"
