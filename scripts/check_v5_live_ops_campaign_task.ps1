param(
  [string]$TaskName = "AirdropKralBot-V5-LiveOps-15M",
  [int]$StaleMinutes = 60
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$latestJson = Join-Path $repoRoot ".runtime-artifacts\liveops\V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"
$latestAlertJson = Join-Path $repoRoot ".runtime-artifacts\liveops\V5_LIVE_OPS_OPS_ALERT_latest.json"

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
$alertJsonInfo = Get-FileInfoSafe -Path $latestAlertJson
$latestPayload = Read-JsonSafe -Path $latestJson
$latestAlertPayload = Read-JsonSafe -Path $latestAlertJson

$latestSummary = $null
if ($latestPayload -ne $null) {
  $scheduler = Get-PropValue -Source $latestPayload -Name "scheduler_summary"
  $schedulerSkip = Get-PropValue -Source $latestPayload -Name "scheduler_skip_summary"
  $pressureFocus = Get-PropValue -Source $latestPayload -Name "pressure_focus_summary"
  $targetingGuidance = Get-PropValue -Source $latestPayload -Name "targeting_guidance_summary"
  $opsAlertTrend = Get-PropValue -Source $latestPayload -Name "ops_alert_trend"
  $opsAlarm = Get-PropValue -Source $latestPayload -Name "ops_alarm"
  $recommendation = Get-PropValue -Source $scheduler -Name "recipient_cap_recommendation"
  $data = Get-PropValue -Source $latestPayload -Name "data"
  $selectionSummary = Get-PropValue -Source $latestPayload -Name "selection_summary"
  $selectionTrend = Get-PropValue -Source $latestPayload -Name "selection_trend_summary"
  $selectionPrefilter = Get-PropValue -Source $selectionSummary -Name "prefilter_summary"
  $selectionQueryStrategy = Get-PropValue -Source $selectionSummary -Name "query_strategy_summary"
  $selectionAdjustmentRows = @((Get-PropValue -Source $selectionQueryStrategy -Name "adjustment_rows" -Fallback @()))
  $topSelectionAdjustment = $selectionAdjustmentRows |
    Sort-Object { [math]::Abs([int](Get-PropValue -Source $_ -Name "delta_value" -Fallback 0)) } -Descending |
    Select-Object -First 1
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
    recommended_recipient_cap = [int](Get-PropValue -Source $recommendation -Name "recommended_recipient_cap" -Fallback 0)
    effective_cap_delta = [int](Get-PropValue -Source $recommendation -Name "effective_cap_delta" -Fallback 0)
    recommendation_pressure_band = [string](Get-PropValue -Source $recommendation -Name "pressure_band" -Fallback "clear")
    recommendation_reason = [string](Get-PropValue -Source $recommendation -Name "reason" -Fallback "")
    targeting_guidance_default_mode = [string](Get-PropValue -Source $targetingGuidance -Name "default_mode" -Fallback "balanced")
    targeting_guidance_state = [string](Get-PropValue -Source $targetingGuidance -Name "guidance_state" -Fallback "clear")
    targeting_guidance_reason = [string](Get-PropValue -Source $targetingGuidance -Name "guidance_reason" -Fallback "")
    targeting_guidance_cap = [int](Get-PropValue -Source ((Get-PropValue -Source $targetingGuidance -Name "mode_rows" -Fallback @()) | Where-Object { [string](Get-PropValue -Source $_ -Name "mode_key" -Fallback "") -eq [string](Get-PropValue -Source $targetingGuidance -Name "default_mode" -Fallback "balanced") } | Select-Object -First 1) -Name "suggested_recipient_cap" -Fallback 0)
    selection_prefilter = [pscustomobject]@{
      applied = [bool](Get-PropValue -Source $selectionPrefilter -Name "applied" -Fallback $false)
      dimension = [string](Get-PropValue -Source $selectionPrefilter -Name "dimension" -Fallback "")
      bucket = [string](Get-PropValue -Source $selectionPrefilter -Name "bucket" -Fallback "")
      reason = [string](Get-PropValue -Source $selectionPrefilter -Name "reason" -Fallback "")
      candidates_before = [int](Get-PropValue -Source $selectionPrefilter -Name "candidates_before" -Fallback 0)
      candidates_after = [int](Get-PropValue -Source $selectionPrefilter -Name "candidates_after" -Fallback 0)
      reduction_count = [math]::Max(0, [int](Get-PropValue -Source $selectionPrefilter -Name "candidates_before" -Fallback 0) - [int](Get-PropValue -Source $selectionPrefilter -Name "candidates_after" -Fallback 0))
      reduction_share = if ([int](Get-PropValue -Source $selectionPrefilter -Name "candidates_before" -Fallback 0) -gt 0) {
        [math]::Max(0, [double](([int](Get-PropValue -Source $selectionPrefilter -Name "candidates_before" -Fallback 0) - [int](Get-PropValue -Source $selectionPrefilter -Name "candidates_after" -Fallback 0)) / [double][int](Get-PropValue -Source $selectionPrefilter -Name "candidates_before" -Fallback 0)))
      } else { 0 }
    }
    selection_query_adjustment = [pscustomobject]@{
      applied = [bool]($selectionAdjustmentRows.Count -gt 0)
      count = [int]$selectionAdjustmentRows.Count
      total_delta = [int](($selectionAdjustmentRows | ForEach-Object { [math]::Abs([int](Get-PropValue -Source $_ -Name "delta_value" -Fallback 0)) } | Measure-Object -Sum).Sum)
      top_field = [string](Get-PropValue -Source $topSelectionAdjustment -Name "field_key" -Fallback "")
      top_field_family = [string](Get-PropValue -Source $selectionTrend -Name "latest_query_adjustment_field_family" -Fallback "")
      top_after_value = [int](Get-PropValue -Source $topSelectionAdjustment -Name "after_value" -Fallback 0)
      top_delta = [int](Get-PropValue -Source $topSelectionAdjustment -Name "delta_value" -Fallback 0)
      top_reason = [string](Get-PropValue -Source $topSelectionAdjustment -Name "reason_code" -Fallback "")
    }
    selection_trend = [pscustomobject]@{
      query_strategy_applied_24h = [int](Get-PropValue -Source $selectionTrend -Name "query_strategy_applied_24h" -Fallback 0)
      query_strategy_applied_7d = [int](Get-PropValue -Source $selectionTrend -Name "query_strategy_applied_7d" -Fallback 0)
      latest_query_strategy_reason = [string](Get-PropValue -Source $selectionTrend -Name "latest_query_strategy_reason" -Fallback "")
      latest_query_strategy_family = [string](Get-PropValue -Source $selectionTrend -Name "latest_query_strategy_family" -Fallback "")
      latest_segment_strategy_reason = [string](Get-PropValue -Source $selectionTrend -Name "latest_segment_strategy_reason" -Fallback "")
      latest_segment_strategy_family = [string](Get-PropValue -Source $selectionTrend -Name "latest_segment_strategy_family" -Fallback "")
      top_query_strategy_reason = [string](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "query_strategy_reason_breakdown" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      top_query_strategy_family = [string](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "query_strategy_family_breakdown" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      top_query_strategy_reason_count = [int](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "query_strategy_reason_breakdown" -Fallback @()) | Select-Object -First 1) -Name "item_count" -Fallback 0)
      top_segment_strategy_reason = [string](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "segment_strategy_reason_breakdown" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      top_segment_strategy_family = [string](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "segment_strategy_family_breakdown" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      top_segment_strategy_reason_count = [int](Get-PropValue -Source ((Get-PropValue -Source $selectionTrend -Name "segment_strategy_reason_breakdown" -Fallback @()) | Select-Object -First 1) -Name "item_count" -Fallback 0)
    }
    pressure_focus = [pscustomobject]@{
      pressure_band = [string](Get-PropValue -Source $pressureFocus -Name "pressure_band" -Fallback "clear")
      top_warning_dimension = [string](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "warning_rows" -Fallback @()) | Select-Object -First 1) -Name "dimension" -Fallback "")
      top_warning_bucket = [string](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "warning_rows" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      top_warning_matches_target = [bool](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "warning_rows" -Fallback @()) | Select-Object -First 1) -Name "matches_target" -Fallback $false)
      locale_bucket = [string](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "locale_cap_split" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      locale_cap = [int](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "locale_cap_split" -Fallback @()) | Select-Object -First 1) -Name "suggested_recipient_cap" -Fallback 0)
      variant_bucket = [string](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "variant_cap_split" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      variant_cap = [int](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "variant_cap_split" -Fallback @()) | Select-Object -First 1) -Name "suggested_recipient_cap" -Fallback 0)
      cohort_bucket = [string](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "cohort_cap_split" -Fallback @()) | Select-Object -First 1) -Name "bucket_key" -Fallback "")
      cohort_cap = [int](Get-PropValue -Source ((Get-PropValue -Source $pressureFocus -Name "cohort_cap_split" -Fallback @()) | Select-Object -First 1) -Name "suggested_recipient_cap" -Fallback 0)
    }
    scheduler_skip_24h = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_24h" -Fallback 0)
    scheduler_skip_7d = [int](Get-PropValue -Source $schedulerSkip -Name "skipped_7d" -Fallback 0)
    scheduler_skip_alarm_state = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_state" -Fallback (Get-PropValue -Source $opsAlarm -Name "state" -Fallback "clear"))
    scheduler_skip_alarm_reason = [string](Get-PropValue -Source $schedulerSkip -Name "alarm_reason" -Fallback (Get-PropValue -Source $opsAlarm -Name "reason" -Fallback ""))
    ops_alert_delta_24h = [int](Get-PropValue -Source $opsAlertTrend -Name "effective_cap_delta_24h" -Fallback 0)
    ops_alert_delta_7d = [int](Get-PropValue -Source $opsAlertTrend -Name "effective_cap_delta_7d" -Fallback 0)
    ops_alert_delta_latest = [int](Get-PropValue -Source $opsAlertTrend -Name "latest_effective_cap_delta" -Fallback 0)
    ops_alert_delta_max_7d = [int](Get-PropValue -Source $opsAlertTrend -Name "max_effective_cap_delta_7d" -Fallback 0)
  }
}

$ok = $true
if (-not $task.exists) { $ok = $false }
if (-not $jsonInfo.exists -or [double]$jsonInfo.age_min -gt $StaleMinutes) { $ok = $false }
if ($latestSummary -ne $null -and [string]$latestSummary.scheduler_skip_alarm_state -eq "alert") { $ok = $false }

$latestAlertSummary = $null
if ($latestAlertPayload -ne $null) {
  $evaluation = Get-PropValue -Source $latestAlertPayload -Name "evaluation"
  $telegram = Get-PropValue -Source $latestAlertPayload -Name "telegram"
  $latestAlertSummary = [pscustomobject]@{
    alarm_state = [string](Get-PropValue -Source $evaluation -Name "alarm_state" -Fallback "clear")
    should_notify = [bool](Get-PropValue -Source $evaluation -Name "should_notify" -Fallback $false)
    notification_reason = [string](Get-PropValue -Source $evaluation -Name "notification_reason" -Fallback "")
    fingerprint = [string](Get-PropValue -Source $evaluation -Name "fingerprint" -Fallback "")
    pressure_focus_escalation_band = [string](Get-PropValue -Source $evaluation -Name "pressure_focus_escalation_band" -Fallback "clear")
    pressure_focus_escalation_reason = [string](Get-PropValue -Source $evaluation -Name "pressure_focus_escalation_reason" -Fallback "")
    pressure_focus_escalation_dimension = [string](Get-PropValue -Source $evaluation -Name "pressure_focus_escalation_dimension" -Fallback "")
    pressure_focus_escalation_bucket = [string](Get-PropValue -Source $evaluation -Name "pressure_focus_escalation_bucket" -Fallback "")
    pressure_focus_escalation_share = [double](Get-PropValue -Source $evaluation -Name "pressure_focus_escalation_share" -Fallback 0)
    pressure_focus_effective_delta_ratio = [double](Get-PropValue -Source $evaluation -Name "pressure_focus_effective_delta_ratio" -Fallback 0)
    selection_family_escalation_band = [string](Get-PropValue -Source $evaluation -Name "selection_family_escalation_band" -Fallback "clear")
    selection_family_escalation_reason = [string](Get-PropValue -Source $evaluation -Name "selection_family_escalation_reason" -Fallback "")
    selection_family_escalation_dimension = [string](Get-PropValue -Source $evaluation -Name "selection_family_escalation_dimension" -Fallback "")
    selection_family_escalation_bucket = [string](Get-PropValue -Source $evaluation -Name "selection_family_escalation_bucket" -Fallback "")
    selection_family_escalation_score = [int](Get-PropValue -Source $evaluation -Name "selection_family_escalation_score" -Fallback 0)
    selection_family_daily_weight = [int](Get-PropValue -Source $evaluation -Name "selection_family_daily_weight" -Fallback 0)
    selection_query_family_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_family_weight" -Fallback 0)
    selection_segment_family_weight = [int](Get-PropValue -Source $evaluation -Name "selection_segment_family_weight" -Fallback 0)
    selection_field_family_weight = [int](Get-PropValue -Source $evaluation -Name "selection_field_family_weight" -Fallback 0)
    selection_query_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_query_family_match_days" -Fallback 0)
    selection_segment_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_segment_family_match_days" -Fallback 0)
    selection_field_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_field_family_match_days" -Fallback 0)
    selection_query_strategy_applied_24h = [int](Get-PropValue -Source $evaluation -Name "selection_query_strategy_applied_24h" -Fallback 0)
    selection_query_strategy_applied_7d = [int](Get-PropValue -Source $evaluation -Name "selection_query_strategy_applied_7d" -Fallback 0)
    selection_latest_query_strategy_reason = [string](Get-PropValue -Source $evaluation -Name "selection_latest_query_strategy_reason" -Fallback "")
    selection_latest_query_strategy_family = [string](Get-PropValue -Source $evaluation -Name "selection_latest_query_strategy_family" -Fallback "")
    selection_latest_segment_strategy_reason = [string](Get-PropValue -Source $evaluation -Name "selection_latest_segment_strategy_reason" -Fallback "")
    selection_latest_segment_strategy_family = [string](Get-PropValue -Source $evaluation -Name "selection_latest_segment_strategy_family" -Fallback "")
    selection_top_query_strategy_reason = [string](Get-PropValue -Source $evaluation -Name "selection_top_query_strategy_reason" -Fallback "")
    selection_top_query_strategy_family = [string](Get-PropValue -Source $evaluation -Name "selection_top_query_strategy_family" -Fallback "")
    selection_top_query_strategy_reason_count = [int](Get-PropValue -Source $evaluation -Name "selection_top_query_strategy_reason_count" -Fallback 0)
    selection_top_segment_strategy_reason = [string](Get-PropValue -Source $evaluation -Name "selection_top_segment_strategy_reason" -Fallback "")
    selection_top_segment_strategy_family = [string](Get-PropValue -Source $evaluation -Name "selection_top_segment_strategy_family" -Fallback "")
    selection_top_segment_strategy_reason_count = [int](Get-PropValue -Source $evaluation -Name "selection_top_segment_strategy_reason_count" -Fallback 0)
    selection_query_adjustment_applied = [bool](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_applied" -Fallback $false)
    selection_query_adjustment_count = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_count" -Fallback 0)
    selection_query_adjustment_total_delta = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_total_delta" -Fallback 0)
    selection_query_adjustment_top_field = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_field" -Fallback "")
    selection_query_adjustment_top_after_value = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_after_value" -Fallback 0)
    selection_query_adjustment_top_delta = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_delta" -Fallback 0)
    selection_query_adjustment_top_direction = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_direction" -Fallback "")
    selection_query_adjustment_top_reason = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_reason" -Fallback "")
    selection_query_adjustment_escalation_band = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_band" -Fallback "clear")
    selection_query_adjustment_escalation_reason = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_reason" -Fallback "")
    selection_query_adjustment_escalation_dimension = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_dimension" -Fallback "")
    selection_query_adjustment_escalation_bucket = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_bucket" -Fallback "")
    selection_query_adjustment_escalation_field = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_field" -Fallback "")
    selection_query_adjustment_escalation_score = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_escalation_score" -Fallback 0)
    selection_query_adjustment_daily_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_daily_weight" -Fallback 0)
    selection_query_adjustment_total_delta_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_total_delta_weight" -Fallback 0)
    selection_query_adjustment_top_delta_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_top_delta_weight" -Fallback 0)
    selection_query_adjustment_field_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_field_weight" -Fallback 0)
    selection_query_adjustment_field_family = [string](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_field_family" -Fallback "")
    selection_query_adjustment_field_family_weight = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_field_family_weight" -Fallback 0)
    selection_query_adjustment_query_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_query_family_match_days" -Fallback 0)
    selection_query_adjustment_segment_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_segment_family_match_days" -Fallback 0)
    selection_query_adjustment_field_family_match_days = [int](Get-PropValue -Source $evaluation -Name "selection_query_adjustment_field_family_match_days" -Fallback 0)
    selection_prefilter_applied = [bool](Get-PropValue -Source $evaluation -Name "selection_prefilter_applied" -Fallback $false)
    selection_prefilter_dimension = [string](Get-PropValue -Source $evaluation -Name "selection_prefilter_dimension" -Fallback "")
    selection_prefilter_bucket = [string](Get-PropValue -Source $evaluation -Name "selection_prefilter_bucket" -Fallback "")
    selection_prefilter_reason = [string](Get-PropValue -Source $evaluation -Name "selection_prefilter_reason" -Fallback "")
    selection_prefilter_candidates_before = [int](Get-PropValue -Source $evaluation -Name "selection_prefilter_candidates_before" -Fallback 0)
    selection_prefilter_candidates_after = [int](Get-PropValue -Source $evaluation -Name "selection_prefilter_candidates_after" -Fallback 0)
    selection_prefilter_reduction_count = [int](Get-PropValue -Source $evaluation -Name "selection_prefilter_reduction_count" -Fallback 0)
    selection_prefilter_reduction_share = [double](Get-PropValue -Source $evaluation -Name "selection_prefilter_reduction_share" -Fallback 0)
    telegram_sent = [bool](Get-PropValue -Source $telegram -Name "sent" -Fallback $false)
    telegram_reason = [string](Get-PropValue -Source $telegram -Name "reason" -Fallback "")
    telegram_sent_at = (Get-PropValue -Source $telegram -Name "sent_at" -Fallback $null)
  }
}

if ($latestAlertSummary -ne $null -and $latestAlertSummary.should_notify -and -not $latestAlertSummary.telegram_sent) {
  $ok = $false
}

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
  latest_alert_json = $alertJsonInfo
  latest_summary = $latestSummary
  ops_alarm = $opsAlarmSummary
  latest_alert = $latestAlertSummary
  stale_minutes_threshold = $StaleMinutes
}

$payload | ConvertTo-Json -Depth 6

if (-not $ok) {
  exit 1
}
