param(
  [string]$TaskName = "AirdropKralBot-V5-KPI-6H",
  [int]$StaleMinutes = 480
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$latestJson = Join-Path $repoRoot "docs\V5_KPI_BUNDLE_latest.json"
$latestMd = Join-Path $repoRoot "docs\V5_KPI_BUNDLE_latest.md"

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

$task = Get-TaskStatus -Name $TaskName
$jsonInfo = Get-FileInfoSafe -Path $latestJson
$mdInfo = Get-FileInfoSafe -Path $latestMd

$ok = $true
if (-not $task.exists) { $ok = $false }
if (-not $jsonInfo.exists -or [double]$jsonInfo.age_min -gt $StaleMinutes) { $ok = $false }
if (-not $mdInfo.exists -or [double]$mdInfo.age_min -gt $StaleMinutes) { $ok = $false }

$payload = [pscustomobject]@{
  success = $ok
  task = $task
  latest_json = $jsonInfo
  latest_md = $mdInfo
  stale_minutes_threshold = $StaleMinutes
}

$payload | ConvertTo-Json -Depth 6

if (-not $ok) {
  exit 1
}
