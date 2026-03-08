param(
  [string]$TaskName = "AirdropKralBot-V5-LiveOps-15M",
  [int]$StaleMinutes = 60
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$latestJson = Join-Path $repoRoot ".runtime-artifacts\liveops\V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"

function Get-TaskStatus {
  param([string]$Name)
  $raw = cmd /c "schtasks /Query /TN ""$Name"" /FO LIST" 2>&1
  if ($LASTEXITCODE -ne 0) {
    return [pscustomobject]@{
      exists = $false
      status = "missing"
      next_run = ""
      logon_mode = ""
      raw = ($raw -join "`n")
    }
  }
  $status = ""
  $nextRun = ""
  $logonMode = ""
  foreach ($line in $raw) {
    $text = [string]$line
    if ($text -match "^Status:\s*(.+)$") { $status = $matches[1].Trim() }
    if ($text -match "^Next Run Time:\s*(.+)$") { $nextRun = $matches[1].Trim() }
    if ($text -match "^Logon Mode:\s*(.+)$") { $logonMode = $matches[1].Trim() }
  }
  return [pscustomobject]@{
    exists = $true
    status = $status
    next_run = $nextRun
    logon_mode = $logonMode
    raw = ($raw -join "`n")
  }
}

function Get-FileInfoSafe {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return [pscustomobject]@{
      exists = $false
      path = $Path
      last_write = $null
      age_min = $null
      size = 0
    }
  }
  $item = Get-Item $Path
  $ageMin = [math]::Round(((Get-Date).ToUniversalTime() - $item.LastWriteTimeUtc).TotalMinutes, 2)
  return [pscustomobject]@{
    exists = $true
    path = $Path
    last_write = $item.LastWriteTimeUtc.ToString("o")
    age_min = $ageMin
    size = [int64]$item.Length
  }
}

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return $null
  }
  try {
    return Get-Content $Path -Raw | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Get-PropValue {
  param(
    [object]$Source,
    [string]$Name,
    $Fallback = $null
  )
  if ($null -eq $Source) {
    return $Fallback
  }
  $prop = $Source.PSObject.Properties[$Name]
  if ($null -eq $prop) {
    return $Fallback
  }
  if ($null -eq $prop.Value) {
    return $Fallback
  }
  return $prop.Value
}

$task = Get-TaskStatus -Name $TaskName
$jsonInfo = Get-FileInfoSafe -Path $latestJson
$latestPayload = Read-JsonSafe -Path $latestJson

$latestSummary = $null
if ($latestPayload -ne $null) {
  $scheduler = Get-PropValue -Source $latestPayload -Name "scheduler_summary"
  $schedulerSkip = Get-PropValue -Source $latestPayload -Name "scheduler_skip_summary"
  $opsAlarm = Get-PropValue -Source $latestPayload -Name "ops_alarm"
  $data = Get-PropValue -Source $latestPayload -Name "data"
  $latestSummary = [pscustomobject]@{
    ok = [bool](Get-PropValue -Source $latestPayload -Name "ok" -Fallback $false)
    skipped = [bool](Get-PropValue -Source $latestPayload -Name "skipped" -Fallback $false)
    reason = [string](Get-PropValue -Source $latestPayload -Name "reason" -Fallback "")
    dispatch_ref = [string](Get-PropValue -Source $data -Name "dispatch_ref" -Fallback "")
    dispatch_source = [string](Get-PropValue -Source $data -Name "dispatch_source" -Fallback "")
    scene_gate_state = [string](Get-PropValue -Source $scheduler -Name "scene_gate_state" -Fallback (Get-PropValue -Source $data -Name "scene_gate_state" -Fallback ""))
    scene_gate_effect = [string](Get-PropValue -Source $scheduler -Name "scene_gate_effect" -Fallback (Get-PropValue -Source $data -Name "scene_gate_effect" -Fallback ""))
    scene_gate_reason = [string](Get-PropValue -Source $scheduler -Name "scene_gate_reason" -Fallback (Get-PropValue -Source $data -Name "scene_gate_reason" -Fallback ""))
    scene_gate_recipient_cap = [int](Get-PropValue -Source $scheduler -Name "scene_gate_recipient_cap" -Fallback (Get-PropValue -Source $data -Name "scene_gate_recipient_cap" -Fallback 0))
    scheduler_skip_24h = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_24h" -Fallback 0)
    scheduler_skip_7d = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_7d" -Fallback 0)
    scheduler_skip_alarm_state = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_state" -Fallback (Get-PropValue -Source $opsAlarm -Name "state" -Fallback "clear"))
    scheduler_skip_alarm_reason = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_reason" -Fallback (Get-PropValue -Source $opsAlarm -Name "reason" -Fallback ""))
  }
}

$ok = $true
if (-not $task.exists) { $ok = $false }
if (-not $jsonInfo.exists -or [double]$jsonInfo.age_min -gt $StaleMinutes) { $ok = $false }
if ($latestSummary -ne $null -and [string]$latestSummary.scheduler_skip_alarm_state -eq "alert") { $ok = $false }

$opsAlarmSummary = $null
if ($latestPayload -ne $null) {
  $schedulerSkip = Get-PropValue -Source $latestPayload -Name "scheduler_skip_summary"
  $opsAlarm = Get-PropValue -Source $latestPayload -Name "ops_alarm"
  $opsAlarmSummary = [pscustomobject]@{
    state = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_state" -Fallback (Get-PropValue -Source $opsAlarm -Name "state" -Fallback "clear"))
    reason = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_reason" -Fallback (Get-PropValue -Source $opsAlarm -Name "reason" -Fallback ""))
    skipped_24h = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_24h" -Fallback (Get-PropValue -Source $opsAlarm -Name "skipped_24h" -Fallback 0))
    skipped_7d = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_7d" -Fallback (Get-PropValue -Source $opsAlarm -Name "skipped_7d" -Fallback 0))
    latest_skip_reason = [string](Get-PropValue -Source $schedulerSkip -Name "latest_skip_reason" -Fallback (Get-PropValue -Source $opsAlarm -Name "latest_skip_reason" -Fallback ""))
    latest_skip_at = (Get-PropValue -Source $schedulerSkip -Name "latest_skip_at" -Fallback (Get-PropValue -Source $opsAlarm -Name "latest_skip_at" -Fallback $null))
  }
}

$payload = [pscustomobject]@{
  success = $ok
  task = $task
  latest_json = $jsonInfo
  latest_summary = $latestSummary
  ops_alarm = $opsAlarmSummary
  stale_minutes_threshold = $StaleMinutes
}

$payload | ConvertTo-Json -Depth 6

if (-not $ok) {
  exit 1
}
