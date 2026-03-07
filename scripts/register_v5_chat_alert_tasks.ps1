param(
  [string]$TaskName = "AirdropKralBot-V5-ChatAlerts-1H",
  [int]$EveryHours = 1,
  [ValidateSet("LIMITED", "HIGHEST")]
  [string]$RunLevel = "LIMITED",
  [switch]$UnregisterOnly
)

$ErrorActionPreference = "Stop"

if ($EveryHours -lt 1 -or $EveryHours -gt 24) {
  throw "EveryHours must be between 1 and 24."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskRunnerDir = Join-Path $env:LOCALAPPDATA "AirdropKralBot"
if (-not (Test-Path $taskRunnerDir)) {
  New-Item -ItemType Directory -Path $taskRunnerDir -Force | Out-Null
}
$taskRunnerPath = Join-Path $taskRunnerDir "run_v5_chat_alert_dispatch.cmd"
$runnerBody = @"
@echo off
setlocal
cd /d "$repoRoot"
call npm run alerts:v5:dispatch
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
  "/SC", "HOURLY",
  "/MO", "$EveryHours",
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
      "/SC", "HOURLY",
      "/MO", "$EveryHours",
      "/TR", $taskCommand,
      "/RL", "LIMITED"
    )
    schtasks @retryArgs | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Task registration failed: $TaskName"
    }
    Write-Host "[ok] Task registered with LIMITED: $TaskName (every $EveryHours hours)"
    Write-Host "[info] To remove: powershell -ExecutionPolicy Bypass -File scripts/register_v5_chat_alert_tasks.ps1 -TaskName `"$TaskName`" -UnregisterOnly"
    exit 0
  }
  throw "Task registration failed: $TaskName"
}
Write-Host "[ok] Task registered: $TaskName (every $EveryHours hours, RL=$RunLevel)"
Write-Host "[info] To remove: powershell -ExecutionPolicy Bypass -File scripts/register_v5_chat_alert_tasks.ps1 -TaskName `"$TaskName`" -UnregisterOnly"
