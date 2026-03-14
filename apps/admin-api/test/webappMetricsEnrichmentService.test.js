"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const service = require(path.join(
  process.cwd(),
  "apps",
  "admin-api",
  "src",
  "services",
  "webapp",
  "metricsEnrichmentService.js"
));

test("toRate clamps denominator and keeps four decimals", () => {
  assert.equal(service.toRate(7, 0), 0);
  assert.equal(service.toRate(2, 3), 0.6667);
  assert.equal(service.toRate(3, 3), 1);
});

test("resolveQualityBand returns expected thresholds", () => {
  assert.equal(service.resolveQualityBand(0.99), "green");
  assert.equal(service.resolveQualityBand(0.95), "yellow");
  assert.equal(service.resolveQualityBand(0.82), "red");
});

test("resolveConversionBand accounts for low volume and rate quality", () => {
  assert.equal(service.resolveConversionBand(0.8, 0.8, 12), "low_volume");
  assert.equal(service.resolveConversionBand(0.65, 0.58, 120), "green");
  assert.equal(service.resolveConversionBand(0.4, 0.42, 120), "yellow");
  assert.equal(service.resolveConversionBand(0.2, 0.3, 120), "red");
});

test("resolveSceneRuntimeHealthBand reflects runtime success quality", () => {
  assert.equal(service.resolveSceneRuntimeHealthBand(0, 0, 0), "no_data");
  assert.equal(service.resolveSceneRuntimeHealthBand(0.98, 40, 1), "green");
  assert.equal(service.resolveSceneRuntimeHealthBand(0.92, 40, 4), "yellow");
  assert.equal(service.resolveSceneRuntimeHealthBand(0.7, 40, 12), "red");
});

test("resolveSceneTrendDirection and alarm state detect degrading runtime windows", () => {
  assert.equal(service.resolveSceneTrendDirection(0.98, 0.9, 3), "improving");
  assert.equal(service.resolveSceneTrendDirection(0.88, 0.96, 3), "degrading");
  assert.equal(service.resolveSceneAlarmState([{ health_band: "red", failure_rate: 0.14 }]), "alert");
  assert.deepEqual(
    service.buildSceneAlarmReasons([
      { health_band: "red", failure_rate: 0.14, ready_rate: 0.88, low_end_share: 0.5 },
      { health_band: "red", failure_rate: 0.11, ready_rate: 0.89, low_end_share: 0.33 }
    ]),
    ["latest_failure_spike", "latest_ready_drop", "latest_low_end_pressure", "repeated_red_days"]
  );
});

test("normalizeSceneDailyRows keeps only stable daily runtime keys", () => {
  const rows = service.normalizeSceneDailyRows([
    { day: "2026-03-08", total_count: 12, ready_count: 10, failed_count: 2, low_end_count: 4 },
    { day: "2026-03-07", total_count: 9, ready_count: 8, failed_count: 1, low_end_count: 3 }
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].day, "2026-03-08");
  assert.equal(rows[0].total_count, 12);
  assert.equal(rows[0].ready_count, 10);
  assert.equal(rows[0].failed_count, 2);
  assert.equal(rows[0].low_end_count, 4);
  assert.equal(rows[0].ready_rate, 0.8333);
  assert.equal(rows[0].health_band, "red");
});

test("normalizeSceneLoopDailyRows keeps only day and total count", () => {
  const rows = service.normalizeSceneLoopDailyRows([
    { day: "2026-03-08", total_count: 14, district_count: 4, live_count: 10, blocked_count: 2, ignored: 1 },
    { day: "2026-03-07", total_count: 9, district_count: 2, live_count: 2, blocked_count: 4 }
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].day, "2026-03-08");
  assert.equal(rows[0].total_count, 14);
  assert.equal(rows[0].district_count, 4);
  assert.equal(rows[0].live_count, 10);
  assert.equal(rows[0].blocked_count, 2);
  assert.equal(rows[0].health_band, "green");
  assert.equal("ignored" in rows[0], false);
});

test("resolveSceneLoopHealthBand and alarm state reflect loop coverage quality", () => {
  assert.equal(service.resolveSceneLoopHealthBand(0, 0, 0, 0), "no_data");
  assert.equal(service.resolveSceneLoopHealthBand(12, 4, 0.75, 0.08), "green");
  assert.equal(service.resolveSceneLoopHealthBand(5, 2, 0.4, 0.2), "yellow");
  assert.equal(service.resolveSceneLoopHealthBand(5, 1, 0.2, 0.5), "red");
  assert.equal(
    service.resolveSceneLoopAlarmState([
      { health_band: "red", blocked_share: 0.5, district_count: 1 },
      { health_band: "red", blocked_share: 0.35, district_count: 2 }
    ]),
    "alert"
  );
  assert.deepEqual(
    service.buildSceneLoopAlarmReasons([
      { health_band: "red", blocked_share: 0.5, live_share: 0.2, district_count: 1 },
      { health_band: "red", blocked_share: 0.35, live_share: 0.3, district_count: 2 }
    ]),
    ["latest_blocked_share_spike", "latest_live_share_drop", "latest_district_coverage_low", "repeated_red_days"]
  );
});

test("buildSceneLoopRiskContext preserves explicit nested context over derived fallbacks", () => {
  const context = service.buildSceneLoopRiskContext({
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    latest_health_band: "yellow",
    attention_band: "watch",
    trend_direction: "degrading",
    action_context: {
      district_key: "ops_citadel",
      family_key: "dispatch_gate",
      flow_key: "dispatch_gate:dispatch",
      microflow_key: "dispatch",
      focus_key: "ops_citadel:dispatch_gate:dispatch",
      risk_key: "red:alert:degrading",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch|red:alert:degrading",
      entry_kind_key: "world_entry_kind_dispatch_console",
      sequence_kind_key: "world_modal_kind_dispatch_sequence",
      action_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
    },
    risk_context: {
      district_key: "ops_citadel",
      family_key: "dispatch_gate",
      flow_key: "dispatch_gate:dispatch",
      microflow_key: "dispatch",
      focus_key: "ops_citadel:dispatch_gate:dispatch",
      risk_key: "red:alert:degrading",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch|red:alert:degrading",
      risk_health_band_key: "red",
      risk_attention_band_key: "alert",
      risk_trend_direction_key: "degrading",
      entry_kind_key: "world_entry_kind_dispatch_console",
      sequence_kind_key: "world_modal_kind_dispatch_sequence",
      risk_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|red:alert:degrading|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
    }
  });

  assert.equal(context.district_key, "ops_citadel");
  assert.equal(context.loop_family_key, "dispatch_gate");
  assert.equal(context.flow_key, "dispatch_gate:dispatch");
  assert.equal(context.loop_microflow_key, "dispatch");
  assert.equal(context.focus_key, "ops_citadel:dispatch_gate:dispatch");
  assert.equal(context.risk_key, "red:alert:degrading");
  assert.equal(context.risk_health_band_key, "red");
  assert.equal(context.risk_attention_band_key, "alert");
  assert.equal(context.entry_kind_key, "world_entry_kind_dispatch_console");
  assert.equal(context.sequence_kind_key, "world_modal_kind_dispatch_sequence");
  assert.equal(
    context.action_context_signature,
    "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    context.risk_context_signature,
    "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|red:alert:degrading|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(context.contract_ready, true);
  assert.equal(context.action_context?.microflow_key, "dispatch");
  assert.equal(context.action_context?.contract_ready, true);
  assert.equal(context.risk_context?.risk_attention_band_key, "alert");
  assert.equal(context.risk_context?.contract_ready, true);
});

test("daily microflow risk derived views prefer contract-ready representative context on same day", () => {
  const readyRow = {
    day: "2026-03-08",
    district_key: "ops_citadel",
    loop_family_key: "dispatch_gate",
    loop_microflow_key: "dispatch",
    flow_key: "dispatch_gate:dispatch",
    focus_key: "ops_citadel:dispatch_gate:dispatch",
    risk_key: "yellow:watch:stable",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch|yellow:watch:stable",
    entry_kind_key: "world_entry_kind_dispatch_console",
    sequence_kind_key: "world_modal_kind_dispatch_sequence",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|yellow:watch:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    action_context: {
      district_key: "ops_citadel",
      family_key: "dispatch_gate",
      flow_key: "dispatch_gate:dispatch",
      microflow_key: "dispatch",
      focus_key: "ops_citadel:dispatch_gate:dispatch",
      risk_key: "yellow:watch:stable",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch|yellow:watch:stable",
      risk_health_band_key: "yellow",
      risk_attention_band_key: "watch",
      risk_trend_direction_key: "stable",
      entry_kind_key: "world_entry_kind_dispatch_console",
      sequence_kind_key: "world_modal_kind_dispatch_sequence",
      action_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      contract_ready: true,
      contract_state_key: "ready",
      contract_missing_keys: [],
      context_lookup_required: false,
      context_lookup_resolved: true
    },
    risk_context: {
      district_key: "ops_citadel",
      family_key: "dispatch_gate",
      flow_key: "dispatch_gate:dispatch",
      microflow_key: "dispatch",
      focus_key: "ops_citadel:dispatch_gate:dispatch",
      risk_key: "yellow:watch:stable",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch|yellow:watch:stable",
      risk_health_band_key: "yellow",
      risk_attention_band_key: "watch",
      risk_trend_direction_key: "stable",
      entry_kind_key: "world_entry_kind_dispatch_console",
      sequence_kind_key: "world_modal_kind_dispatch_sequence",
      action_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      risk_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|yellow:watch:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      contract_ready: true,
      contract_state_key: "ready",
      contract_missing_keys: [],
      context_lookup_required: false,
      context_lookup_resolved: true
    },
    latest_health_band: "yellow",
    attention_band: "watch",
    trend_direction: "stable",
    trend_delta: 1,
    total_count: 8,
    live_count: 5,
    blocked_count: 1,
    priority_score: 1200
  };
  const staleHigherPriorityRow = {
    ...readyRow,
    focus_key: "ops_citadel:dispatch_gate:dispatch_stale",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch_stale|yellow:watch:stable",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch_stale|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch_stale|yellow:watch:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false,
    action_context: {
      ...readyRow.action_context,
      focus_key: "ops_citadel:dispatch_gate:dispatch_stale",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch_stale|yellow:watch:stable",
      action_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch_stale|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      contract_ready: false,
      contract_state_key: "missing",
      contract_missing_keys: ["action_context_lookup"],
      context_lookup_required: true,
      context_lookup_resolved: false
    },
    risk_context: {
      ...readyRow.risk_context,
      focus_key: "ops_citadel:dispatch_gate:dispatch_stale",
      risk_focus_key: "ops_citadel:dispatch_gate:dispatch_stale|yellow:watch:stable",
      action_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch_stale|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      risk_context_signature:
        "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch_stale|yellow:watch:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
      contract_ready: false,
      contract_state_key: "missing",
      contract_missing_keys: ["action_context_lookup"],
      context_lookup_required: true,
      context_lookup_resolved: false
    },
    priority_score: 4200
  };

  const riskBreakdownDaily = service.buildSceneLoopDistrictMicroflowRiskBreakdownDaily(
    [staleHigherPriorityRow, readyRow],
    10
  );
  const flowBreakdownDaily = service.buildSceneLoopDimensionBreakdownDaily(
    [staleHigherPriorityRow, readyRow],
    "flow_key",
    10
  );
  const riskMatrix = service.buildSceneLoopDistrictMicroflowRiskMatrix([staleHigherPriorityRow, readyRow], 10);

  assert.equal(riskBreakdownDaily[0].focus_key, "ops_citadel:dispatch_gate:dispatch");
  assert.equal(riskBreakdownDaily[0].contract_ready, true);
  assert.equal(riskBreakdownDaily[0].risk_context?.contract_ready, true);
  assert.equal(riskBreakdownDaily[0].priority_score, 4200);

  assert.equal(flowBreakdownDaily[0].focus_key, "ops_citadel:dispatch_gate:dispatch");
  assert.equal(flowBreakdownDaily[0].contract_ready, true);
  assert.equal(flowBreakdownDaily[0].action_context?.context_lookup_resolved, true);
  assert.equal(flowBreakdownDaily[0].priority_score, 4200);

  assert.equal(riskMatrix[0].focus_key, "ops_citadel:dispatch_gate:dispatch");
  assert.equal(riskMatrix[0].contract_ready, true);
  assert.equal(riskMatrix[0].risk_context_signature, readyRow.risk_context_signature);
  assert.equal(riskMatrix[0].priority_score, 4200);
});

test("daily microflow risk lists sort contract-ready rows ahead of equally ranked stale rows", () => {
  const readyRow = {
    day: "2026-03-09",
    district_key: "mission_quarter",
    loop_family_key: "claim_lane",
    loop_microflow_key: "claim",
    flow_key: "claim_lane:claim",
    focus_key: "mission_quarter:claim_lane:claim",
    risk_key: "yellow:watch:stable",
    risk_focus_key: "mission_quarter:claim_lane:claim|yellow:watch:stable",
    entry_kind_key: "world_entry_kind_claim_terminal",
    sequence_kind_key: "world_modal_kind_contract_sequence",
    action_context_signature:
      "claim_lane:claim|mission_quarter:claim_lane:claim|world_entry_kind_claim_terminal|world_modal_kind_contract_sequence",
    risk_context_signature:
      "claim_lane:claim|mission_quarter:claim_lane:claim|yellow:watch:stable|world_entry_kind_claim_terminal|world_modal_kind_contract_sequence",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    latest_health_band: "yellow",
    attention_band: "watch",
    trend_direction: "stable",
    trend_delta: 0,
    total_count: 6,
    live_count: 4,
    blocked_count: 1
  };
  const staleRow = {
    ...readyRow,
    focus_key: "mission_quarter:claim_lane:claim_stale",
    risk_focus_key: "mission_quarter:claim_lane:claim_stale|yellow:watch:stable",
    action_context_signature:
      "claim_lane:claim|mission_quarter:claim_lane:claim_stale|world_entry_kind_claim_terminal|world_modal_kind_contract_sequence",
    risk_context_signature:
      "claim_lane:claim|mission_quarter:claim_lane:claim_stale|yellow:watch:stable|world_entry_kind_claim_terminal|world_modal_kind_contract_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false
  };

  const riskRowsDaily = service.buildSceneLoopDistrictMicroflowRiskRowsDaily([staleRow, readyRow], 10);
  const trendDailyBreakdown = service.buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyBreakdown(
    [staleRow, readyRow],
    10
  );
  const riskPriorityDaily = service.buildSceneLoopDistrictMicroflowRiskPriorityDaily([staleRow, readyRow], 10);
  const dimensionPriorityDaily = service.buildSceneLoopDimensionPriorityDaily(
    service.buildSceneLoopDistrictMicroflowRiskRowsDaily([staleRow, readyRow], 10),
    "flow_key",
    10
  );
  const trendDailyMatrix = service.buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyMatrix(
    [staleRow, readyRow],
    10
  );

  assert.equal(riskRowsDaily[0].focus_key, "mission_quarter:claim_lane:claim");
  assert.equal(riskRowsDaily[0].contract_ready, true);

  assert.equal(trendDailyBreakdown[0].focus_key, "mission_quarter:claim_lane:claim");
  assert.equal(trendDailyBreakdown[0].contract_ready, true);

  assert.equal(riskPriorityDaily[0].focus_key, "mission_quarter:claim_lane:claim");
  assert.equal(riskPriorityDaily[0].contract_ready, true);

  assert.equal(dimensionPriorityDaily[0].focus_key, "mission_quarter:claim_lane:claim");
  assert.equal(dimensionPriorityDaily[0].contract_ready, true);

  assert.equal(trendDailyMatrix[0].focus_key, "mission_quarter:claim_lane:claim");
  assert.equal(trendDailyMatrix[0].contract_ready, true);
});

test("daily microflow breakdown buckets sort contract-ready context ahead of equally sized stale buckets", () => {
  const readyRow = {
    day: "2026-03-10",
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    flow_key: "wallet_link:wallet",
    focus_key: "exchange_district:wallet_link:wallet",
    risk_key: "yellow:watch:stable",
    risk_focus_key: "exchange_district:wallet_link:wallet|yellow:watch:stable",
    entry_kind_key: "world_entry_kind_wallet_terminal",
    sequence_kind_key: "world_modal_kind_wallet_terminal",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|yellow:watch:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    latest_health_band: "yellow",
    attention_band: "watch",
    trend_direction: "stable",
    trend_delta: 0,
    total_count: 4,
    live_count: 3,
    blocked_count: 1,
    priority_score: 900
  };
  const staleRow = {
    ...readyRow,
    loop_family_key: "dispatch_gate",
    loop_microflow_key: "dispatch",
    flow_key: "dispatch_gate:dispatch",
    focus_key: "ops_citadel:dispatch_gate:dispatch",
    risk_key: "red:alert:stable",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch|red:alert:stable",
    entry_kind_key: "world_entry_kind_dispatch_console",
    sequence_kind_key: "world_modal_kind_dispatch_sequence",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|red:alert:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false,
    latest_health_band: "red",
    attention_band: "alert"
  };

  const riskBreakdown = service.buildSceneLoopDistrictMicroflowRiskBreakdown([staleRow, readyRow], 10);
  const riskBreakdownDaily = service.buildSceneLoopDistrictMicroflowRiskBreakdownDaily([staleRow, readyRow], 10);
  const flowBreakdown = service.buildSceneLoopDimensionBreakdown([staleRow, readyRow], "flow_key", 10);
  const flowBreakdownDaily = service.buildSceneLoopDimensionBreakdownDaily([staleRow, readyRow], "flow_key", 10);

  assert.equal(riskBreakdown[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(riskBreakdown[0].contract_ready, true);
  assert.equal(riskBreakdown[0].bucket_key, "yellow:watch:stable");

  assert.equal(riskBreakdownDaily[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(riskBreakdownDaily[0].contract_ready, true);
  assert.equal(riskBreakdownDaily[0].bucket_key, "yellow:watch:stable");

  assert.equal(flowBreakdown[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(flowBreakdown[0].contract_ready, true);
  assert.equal(flowBreakdown[0].bucket_key, "wallet_link:wallet");

  assert.equal(flowBreakdownDaily[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(flowBreakdownDaily[0].contract_ready, true);
  assert.equal(flowBreakdownDaily[0].bucket_key, "wallet_link:wallet");
});

test("daily family loop views preserve explicit risk context and prefer contract-ready rows", () => {
  const readyRow = {
    day: "2026-03-11",
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    flow_key: "wallet_link:wallet",
    focus_key: "exchange_district:wallet_link:wallet",
    risk_key: "yellow:watch:stable",
    risk_focus_key: "exchange_district:wallet_link:wallet|yellow:watch:stable",
    entry_kind_key: "world_entry_kind_wallet_terminal",
    sequence_kind_key: "world_modal_kind_wallet_terminal",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|yellow:watch:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    latest_health_band: "yellow",
    attention_band: "watch",
    trend_direction: "stable",
    trend_delta: 0,
    total_count: 4,
    live_count: 3,
    blocked_count: 1
  };
  const staleRow = {
    ...readyRow,
    district_key: "ops_citadel",
    loop_family_key: "dispatch_gate",
    loop_microflow_key: "dispatch",
    flow_key: "dispatch_gate:dispatch",
    focus_key: "ops_citadel:dispatch_gate:dispatch",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch|yellow:watch:stable",
    entry_kind_key: "world_entry_kind_dispatch_console",
    sequence_kind_key: "world_modal_kind_dispatch_sequence",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|yellow:watch:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false
  };

  const familyDailyBreakdown = service.buildSceneLoopDistrictFamilyHealthAttentionTrendDailyBreakdown(
    [staleRow, readyRow],
    10
  );
  const familyDailyMatrix = service.buildSceneLoopDistrictFamilyHealthAttentionTrendDailyMatrix([staleRow, readyRow], 10);
  const familyPriorityDaily = service.buildSceneLoopDistrictFamilyAttentionPriorityDaily([staleRow, readyRow], 10);

  assert.equal(familyDailyBreakdown[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyDailyBreakdown[0].contract_ready, true);
  assert.equal(familyDailyBreakdown[0].risk_context?.contract_ready, true);

  assert.equal(familyDailyMatrix[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyDailyMatrix[0].contract_ready, true);
  assert.equal(familyDailyMatrix[0].risk_context_signature, readyRow.risk_context_signature);

  assert.equal(familyPriorityDaily[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyPriorityDaily[0].contract_ready, true);
  assert.equal(familyPriorityDaily[0].action_context_signature, readyRow.action_context_signature);
});

test("aggregate family loop views preserve explicit risk context and prefer contract-ready rows", () => {
  const readyRow = {
    day: "2026-03-12",
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    flow_key: "wallet_link:wallet",
    focus_key: "exchange_district:wallet_link:wallet",
    risk_key: "red:alert:stable",
    risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:stable",
    entry_kind_key: "world_entry_kind_wallet_terminal",
    sequence_kind_key: "world_modal_kind_wallet_terminal",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    health_band: "red",
    latest_health_band: "red",
    attention_band: "alert",
    trend_direction: "stable",
    trend_delta: 0,
    total_count: 8,
    live_count: 4,
    blocked_count: 2,
    day_count: 2
  };
  const staleRow = {
    ...readyRow,
    district_key: "ops_citadel",
    loop_family_key: "dispatch_gate",
    loop_microflow_key: "dispatch",
    flow_key: "dispatch_gate:dispatch",
    focus_key: "ops_citadel:dispatch_gate:dispatch",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch|red:alert:stable",
    entry_kind_key: "world_entry_kind_dispatch_console",
    sequence_kind_key: "world_modal_kind_dispatch_sequence",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|red:alert:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false
  };

  const familyMatrix = service.buildSceneLoopDistrictFamilyMatrix([staleRow, readyRow], 10);
  const familyRiskMatrix = service.buildSceneLoopDistrictFamilyHealthAttentionTrendMatrix([staleRow, readyRow], 10);
  const familyPriority = service.buildSceneLoopDistrictFamilyAttentionPriority([staleRow, readyRow], 10);

  assert.equal(familyMatrix[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyMatrix[0].contract_ready, true);
  assert.equal(familyMatrix[0].risk_context_signature, readyRow.risk_context_signature);

  assert.equal(familyRiskMatrix[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyRiskMatrix[0].contract_ready, true);
  assert.equal(familyRiskMatrix[0].action_context_signature, readyRow.action_context_signature);

  assert.equal(familyPriority[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyPriority[0].contract_ready, true);
  assert.equal(familyPriority[0].risk_context?.contract_ready, true);
});

test("family matrix prefers contract-ready latest row on same day", () => {
  const staleRow = {
    day: "2026-03-12",
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    flow_key: "wallet_link:wallet",
    focus_key: "exchange_district:wallet_link:wallet_stale",
    risk_key: "red:alert:stable",
    risk_focus_key: "exchange_district:wallet_link:wallet_stale|red:alert:stable",
    entry_kind_key: "world_entry_kind_wallet_terminal",
    sequence_kind_key: "world_modal_kind_wallet_terminal",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet_stale|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet_stale|red:alert:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false,
    health_band: "red",
    total_count: 7,
    live_count: 3,
    blocked_count: 2
  };
  const readyRow = {
    ...staleRow,
    focus_key: "exchange_district:wallet_link:wallet",
    risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:stable",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true
  };

  const familyMatrix = service.buildSceneLoopDistrictFamilyMatrix([staleRow, readyRow], 10);

  assert.equal(familyMatrix[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(familyMatrix[0].contract_ready, true);
  assert.equal(familyMatrix[0].risk_context_signature, readyRow.risk_context_signature);
});

test("family breakdown buckets preserve representative risk context", () => {
  const readyRow = {
    day: "2026-03-13",
    latest_day: "2026-03-13",
    district_key: "exchange_district",
    loop_family_key: "wallet_link",
    loop_microflow_key: "wallet",
    flow_key: "wallet_link:wallet",
    focus_key: "exchange_district:wallet_link:wallet",
    risk_key: "red:alert:stable",
    risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:stable",
    entry_kind_key: "world_entry_kind_wallet_terminal",
    sequence_kind_key: "world_modal_kind_wallet_terminal",
    action_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    risk_context_signature:
      "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:stable|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
    contract_ready: true,
    contract_state_key: "ready",
    contract_missing_keys: [],
    context_lookup_required: false,
    context_lookup_resolved: true,
    latest_health_band: "red",
    attention_band: "alert",
    trend_direction: "stable",
    total_count: 5
  };
  const staleRow = {
    ...readyRow,
    district_key: "ops_citadel",
    loop_family_key: "dispatch_gate",
    loop_microflow_key: "dispatch",
    flow_key: "dispatch_gate:dispatch",
    focus_key: "ops_citadel:dispatch_gate:dispatch",
    risk_focus_key: "ops_citadel:dispatch_gate:dispatch|red:alert:stable",
    entry_kind_key: "world_entry_kind_dispatch_console",
    sequence_kind_key: "world_modal_kind_dispatch_sequence",
    action_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    risk_context_signature:
      "dispatch_gate:dispatch|ops_citadel:dispatch_gate:dispatch|red:alert:stable|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence",
    contract_ready: false,
    contract_state_key: "missing",
    contract_missing_keys: ["action_context_lookup"],
    context_lookup_required: true,
    context_lookup_resolved: false
  };

  const latestBand = service.buildSceneLoopDistrictFamilyLatestBandBreakdown([staleRow, readyRow]);
  const trend = service.buildSceneLoopDistrictFamilyTrendBreakdown([staleRow, readyRow]);
  const healthTrend = service.buildSceneLoopDistrictFamilyHealthTrendBreakdown([staleRow, readyRow]);
  const attention = service.buildSceneLoopDistrictFamilyAttentionBreakdown([staleRow, readyRow]);
  const healthAttention = service.buildSceneLoopDistrictFamilyHealthAttentionBreakdown([staleRow, readyRow]);
  const attentionTrend = service.buildSceneLoopDistrictFamilyAttentionTrendBreakdown([staleRow, readyRow]);
  const healthAttentionTrend = service.buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown([staleRow, readyRow]);

  assert.equal(latestBand[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(latestBand[0].contract_ready, true);
  assert.equal(latestBand[0].risk_context_signature, readyRow.risk_context_signature);

  assert.equal(trend[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(trend[0].contract_ready, true);

  assert.equal(healthTrend[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(healthTrend[0].contract_ready, true);

  assert.equal(attention[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(attention[0].contract_ready, true);

  assert.equal(healthAttention[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(healthAttention[0].contract_ready, true);

  assert.equal(attentionTrend[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(attentionTrend[0].contract_ready, true);

  assert.equal(healthAttentionTrend[0].focus_key, "exchange_district:wallet_link:wallet");
  assert.equal(healthAttentionTrend[0].contract_ready, true);
});

test("enrichWebappRevenueMetrics computes quality and funnel rates", () => {
  const enriched = service.enrichWebappRevenueMetrics({
    ui_events_ingested_24h: 100,
    ui_events_valid_24h: 94,
    ui_events_with_funnel_24h: 78,
    ui_events_value_usd_24h: 321.987654321,
    funnel_intent_24h: 80,
    funnel_tx_submit_24h: 50,
    funnel_approved_24h: 30,
    funnel_pass_purchase_24h: 4,
    funnel_cosmetic_purchase_24h: 6,
    funnel_value_usd_24h: 120.9999999,
    scene_runtime_ready_24h: 24,
    scene_runtime_failed_24h: 2,
    scene_runtime_low_end_24h: 8,
    scene_runtime_avg_loaded_bundles_24h: 3.6666667,
    scene_runtime_daily_breakdown_7d: [
      { day: "2026-03-08", total_count: 12, ready_count: 10, failed_count: 2, low_end_count: 4 },
      { day: "2026-03-07", total_count: 9, ready_count: 8, failed_count: 1, low_end_count: 3 }
    ],
    scene_runtime_quality_breakdown_24h: [{ bucket_key: "high", item_count: 14 }],
    scene_runtime_perf_breakdown_24h: [{ bucket_key: "mid", item_count: 10 }],
    scene_runtime_device_breakdown_24h: [{ bucket_key: "mobile", item_count: 20 }],
    scene_runtime_profile_breakdown_24h: [{ bucket_key: "cinematic", item_count: 12 }],
    scene_loop_events_24h: 11,
    scene_loop_live_24h: 7,
    scene_loop_blocked_24h: 3,
    scene_loop_district_coverage_24h: 3,
    scene_loop_daily_breakdown_7d: [
      { day: "2026-03-08", total_count: 11, district_count: 3, live_count: 7, blocked_count: 3 },
      { day: "2026-03-07", total_count: 7, district_count: 2, live_count: 3, blocked_count: 2 }
    ],
    scene_loop_district_daily_breakdown_7d: [
      { day: "2026-03-08", district_key: "arena_prime", total_count: 6, live_count: 4, blocked_count: 1 },
      { day: "2026-03-07", district_key: "arena_prime", total_count: 3, live_count: 2, blocked_count: 1 },
      { day: "2026-03-08", district_key: "exchange_district", total_count: 3, live_count: 2, blocked_count: 1 },
      { day: "2026-03-07", district_key: "exchange_district", total_count: 2, live_count: 1, blocked_count: 0 }
    ],
    scene_loop_district_family_daily_breakdown_7d: [
      { day: "2026-03-08", district_key: "arena_prime", loop_family_key: "duel_flow", total_count: 4, live_count: 3, blocked_count: 1 },
      { day: "2026-03-07", district_key: "arena_prime", loop_family_key: "duel_flow", total_count: 2, live_count: 1, blocked_count: 1 },
      { day: "2026-03-08", district_key: "exchange_district", loop_family_key: "payout_flow", total_count: 3, live_count: 2, blocked_count: 1 },
      { day: "2026-03-07", district_key: "exchange_district", loop_family_key: "wallet_flow", total_count: 2, live_count: 1, blocked_count: 0 }
    ],
    scene_loop_district_microflow_daily_breakdown_7d: [
      { day: "2026-03-08", district_key: "arena_prime", loop_microflow_key: "world_modal_lane_duel_sync:duel", total_count: 4, live_count: 3, blocked_count: 1 },
      { day: "2026-03-07", district_key: "arena_prime", loop_microflow_key: "world_modal_lane_duel_sync:duel", total_count: 2, live_count: 1, blocked_count: 1 },
      {
        day: "2026-03-08",
        district_key: "exchange_district",
        loop_family_key: "payout_lane",
        loop_microflow_key: "world_modal_lane_payout_lane:payout",
        flow_key: "payout_lane:payout",
        focus_key: "exchange_district:payout_lane:payout",
        risk_key: "yellow:watch:no_data",
        risk_focus_key: "exchange_district:payout_lane:payout|yellow:watch:no_data",
        entry_kind_key: "world_entry_kind_payout_terminal",
        sequence_kind_key: "world_modal_kind_payout_route",
        action_context_signature:
          "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route",
        risk_context_signature:
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route",
        contract_state_key: "ready",
        contract_ready: true,
        action_context: {
          district_key: "exchange_district",
          family_key: "payout_lane",
          flow_key: "payout_lane:payout",
          microflow_key: "payout",
          focus_key: "exchange_district:payout_lane:payout",
          entry_kind_key: "world_entry_kind_payout_terminal",
          sequence_kind_key: "world_modal_kind_payout_route",
          action_context_signature:
            "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route",
          contract_state_key: "ready",
          contract_ready: true,
          contract_missing_keys: []
        },
        risk_context: {
          district_key: "exchange_district",
          family_key: "payout_lane",
          flow_key: "payout_lane:payout",
          microflow_key: "payout",
          focus_key: "exchange_district:payout_lane:payout",
          risk_key: "yellow:watch:no_data",
          risk_focus_key: "exchange_district:payout_lane:payout|yellow:watch:no_data",
          risk_health_band_key: "yellow",
          risk_attention_band_key: "watch",
          risk_trend_direction_key: "no_data",
          entry_kind_key: "world_entry_kind_payout_terminal",
          sequence_kind_key: "world_modal_kind_payout_route",
          risk_context_signature:
            "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route",
          contract_state_key: "ready",
          contract_ready: true,
          contract_missing_keys: []
        },
        total_count: 3,
        live_count: 2,
        blocked_count: 1
      },
      {
        day: "2026-03-07",
        district_key: "exchange_district",
        loop_family_key: "wallet_link",
        loop_microflow_key: "world_modal_lane_wallet_link:wallet",
        flow_key: "wallet_link:wallet",
        focus_key: "exchange_district:wallet_link:wallet",
        risk_key: "red:alert:no_data",
        risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
        entry_kind_key: "world_entry_kind_wallet_terminal",
        sequence_kind_key: "world_modal_kind_wallet_terminal",
        action_context_signature:
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
        risk_context_signature:
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
        contract_state_key: "missing",
        contract_ready: false,
        contract_missing_keys: ["action_context_lookup"],
        action_context: {
          district_key: "exchange_district",
          family_key: "wallet_link",
          flow_key: "wallet_link:wallet",
          microflow_key: "wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          entry_kind_key: "world_entry_kind_wallet_terminal",
          sequence_kind_key: "world_modal_kind_wallet_terminal",
          action_context_signature:
            "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
          contract_state_key: "missing",
          contract_ready: false,
          contract_missing_keys: ["action_context_lookup"],
          context_lookup_required: true,
          context_lookup_resolved: false
        },
        risk_context: {
          district_key: "exchange_district",
          family_key: "wallet_link",
          flow_key: "wallet_link:wallet",
          microflow_key: "wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "red:alert:no_data",
          risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
          risk_health_band_key: "red",
          risk_attention_band_key: "alert",
          risk_trend_direction_key: "no_data",
          entry_kind_key: "world_entry_kind_wallet_terminal",
          sequence_kind_key: "world_modal_kind_wallet_terminal",
          risk_context_signature:
            "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
          contract_state_key: "missing",
          contract_ready: false,
          contract_missing_keys: ["action_context_lookup"],
          context_lookup_required: true,
          context_lookup_resolved: false
        },
        total_count: 2,
        live_count: 1,
        blocked_count: 0
      }
    ],
    scene_loop_district_breakdown_24h: [{ bucket_key: "arena_prime", item_count: 6 }],
    scene_loop_family_breakdown_24h: [{ bucket_key: "duel_flow", item_count: 4 }, { bucket_key: "payout_flow", item_count: 3 }],
    scene_loop_microflow_breakdown_24h: [
      { bucket_key: "world_modal_lane_duel_sync:duel", item_count: 4 },
      { bucket_key: "world_modal_lane_payout_lane:payout", item_count: 3 }
    ],
    scene_loop_status_breakdown_24h: [{ bucket_key: "active", item_count: 8 }],
    scene_loop_sequence_breakdown_24h: [{ bucket_key: "world_modal_kind_duel_sequence", item_count: 4 }],
    scene_loop_entry_breakdown_24h: [{ bucket_key: "world_entry_kind_duel_console", item_count: 4 }]
  });

  assert.equal(enriched.ui_event_quality_score_24h, 0.94);
  assert.equal(enriched.ui_event_quality_band_24h, "yellow");
  assert.equal(enriched.funnel_intent_to_submit_rate_24h, 0.625);
  assert.equal(enriched.funnel_submit_to_approved_rate_24h, 0.6);
  assert.equal(enriched.funnel_conversion_band_24h, "green");
  assert.equal(enriched.ui_events_value_usd_24h, 321.98765432);
  assert.equal(enriched.funnel_value_usd_24h, 120.9999999);
  assert.equal(enriched.scene_runtime_total_24h, 26);
  assert.equal(enriched.scene_runtime_ready_rate_24h, 0.9231);
  assert.equal(enriched.scene_runtime_failure_rate_24h, 0.0769);
  assert.equal(enriched.scene_runtime_low_end_share_24h, 0.3077);
  assert.equal(enriched.scene_runtime_avg_loaded_bundles_24h, 3.67);
  assert.equal(enriched.scene_runtime_health_band_24h, "yellow");
  assert.equal(enriched.scene_runtime_daily_breakdown_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_runtime_daily_breakdown_7d[0].total_count, 12);
  assert.equal(enriched.scene_runtime_daily_breakdown_7d[0].ready_rate, 0.8333);
  assert.equal(enriched.scene_runtime_ready_rate_7d_avg, 0.8611);
  assert.equal(enriched.scene_runtime_failure_rate_7d_avg, 0.1389);
  assert.equal(enriched.scene_runtime_trend_direction_7d, "degrading");
  assert.equal(enriched.scene_runtime_alarm_state_7d, "alert");
  assert.equal(enriched.scene_runtime_band_breakdown_7d[0].bucket_key, "red");
  assert.equal(enriched.scene_runtime_worst_day_7d.day, "2026-03-08");
  assert.deepEqual(enriched.scene_runtime_alarm_reasons_7d, ["latest_failure_spike", "latest_ready_drop", "repeated_red_days"]);
  assert.equal(enriched.scene_runtime_quality_breakdown_24h[0].bucket_key, "high");
  assert.equal(enriched.scene_runtime_perf_breakdown_24h[0].bucket_key, "mid");
  assert.equal(enriched.scene_runtime_device_breakdown_24h[0].bucket_key, "mobile");
  assert.equal(enriched.scene_runtime_profile_breakdown_24h[0].bucket_key, "cinematic");
  assert.equal(enriched.scene_loop_events_24h, 11);
  assert.equal(enriched.scene_loop_events_7d, 18);
  assert.equal(enriched.scene_loop_live_share_24h, 0.6364);
  assert.equal(enriched.scene_loop_blocked_share_24h, 0.2727);
  assert.equal(enriched.scene_loop_health_band_24h, "yellow");
  assert.equal(enriched.scene_loop_trend_direction_7d, "improving");
  assert.equal(enriched.scene_loop_alarm_state_7d, "watch");
  assert.equal(enriched.scene_loop_band_breakdown_7d[0].bucket_key, "yellow");
  assert.equal(enriched.scene_loop_peak_day_7d.day, "2026-03-08");
  assert.equal(enriched.scene_loop_daily_breakdown_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_daily_breakdown_7d[0].district_count, 3);
  assert.equal(enriched.scene_loop_daily_breakdown_7d[0].live_count, 7);
  assert.equal(enriched.scene_loop_daily_breakdown_7d[0].blocked_count, 3);
  assert.equal(enriched.scene_loop_district_matrix_7d[0].district_key, "arena_prime");
  assert.equal(enriched.scene_loop_district_matrix_7d[0].total_count, 9);
  assert.equal(enriched.scene_loop_district_matrix_7d[0].trend_direction, "improving");
  assert.equal(enriched.scene_loop_district_matrix_7d[0].health_band, "yellow");
  assert.equal(enriched.scene_loop_district_matrix_7d[0].green_days, 0);
  assert.equal(enriched.scene_loop_district_matrix_7d[0].yellow_days, 2);
  assert.equal(enriched.scene_loop_district_matrix_7d[0].red_days, 0);
  assert.equal(enriched.scene_loop_district_matrix_7d[0].latest_health_band, "yellow");
  assert.equal(enriched.scene_loop_district_matrix_7d[0].attention_band, "watch");
  assert.equal(enriched.scene_loop_district_latest_band_breakdown_7d[0].bucket_key, "yellow");
  assert.equal(enriched.scene_loop_district_latest_band_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_trend_breakdown_7d[0].bucket_key, "improving");
  assert.equal(enriched.scene_loop_district_trend_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_health_trend_breakdown_7d[0].bucket_key, "yellow:improving");
  assert.equal(enriched.scene_loop_district_health_trend_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_attention_breakdown_7d[0].bucket_key, "watch");
  assert.equal(enriched.scene_loop_district_attention_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_breakdown_24h[0].bucket_key, "arena_prime");
  assert.equal(enriched.scene_loop_family_breakdown_24h[0].bucket_key, "duel");
  assert.equal(enriched.scene_loop_status_breakdown_24h[0].bucket_key, "active");
  assert.equal(enriched.scene_loop_sequence_breakdown_24h[0].bucket_key, "world_modal_kind_duel_sequence");
  assert.equal(enriched.scene_loop_entry_breakdown_24h[0].bucket_key, "world_entry_kind_duel_console");
  assert.equal(enriched.scene_loop_district_family_matrix_7d[0].district_key, "arena_prime");
  assert.equal(enriched.scene_loop_district_family_matrix_7d[0].loop_family_key, "duel");
  assert.equal(enriched.scene_loop_district_family_matrix_7d[0].latest_health_band, "yellow");
  assert.equal(enriched.scene_loop_district_family_matrix_7d[0].attention_band, "watch");
  assert.equal(enriched.scene_loop_district_family_latest_band_breakdown_7d[0].bucket_key, "yellow");
  assert.equal(enriched.scene_loop_district_family_latest_band_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_family_trend_breakdown_7d[0].bucket_key, "no_data");
  assert.equal(enriched.scene_loop_district_family_trend_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_family_health_trend_breakdown_7d[0].bucket_key, "red:no_data");
  assert.equal(enriched.scene_loop_district_family_health_trend_breakdown_7d[0].item_count, 1);
  assert.equal(enriched.scene_loop_district_family_attention_breakdown_7d[0].bucket_key, "watch");
  assert.equal(enriched.scene_loop_district_family_attention_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_family_health_attention_breakdown_7d[0].bucket_key, "yellow:watch");
  assert.equal(enriched.scene_loop_district_family_health_attention_breakdown_7d[0].item_count, 2);
  assert.equal(enriched.scene_loop_district_family_attention_trend_breakdown_7d[0].bucket_key, "alert:no_data");
  assert.equal(enriched.scene_loop_district_family_attention_trend_breakdown_7d[0].item_count, 1);
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_breakdown_7d[0].bucket_key, "red:alert:no_data");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_breakdown_7d[0].item_count, 1);
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_matrix_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_matrix_7d[0].loop_family_key, "wallet");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_matrix_7d[0].latest_health_band, "red");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_matrix_7d[0].attention_band, "alert");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_matrix_7d[0].trend_direction, "no_data");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].loop_family_key, "payout");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].latest_health_band, "yellow");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].attention_band, "watch");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_breakdown_7d[0].trend_direction, "no_data");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_matrix_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_matrix_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_matrix_7d[0].loop_family_key, "payout");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_matrix_7d[0].latest_health_band, "yellow");
  assert.equal(enriched.scene_loop_district_family_health_attention_trend_daily_matrix_7d[0].attention_band, "watch");
  assert.equal(enriched.scene_loop_district_family_attention_priority_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_family_attention_priority_7d[0].loop_family_key, "wallet");
  assert.equal(enriched.scene_loop_district_family_attention_priority_7d[0].latest_health_band, "red");
  assert.equal(enriched.scene_loop_district_family_attention_priority_7d[0].attention_band, "alert");
  assert.ok(enriched.scene_loop_district_family_attention_priority_7d[0].priority_score > 3000);
  assert.equal(enriched.scene_loop_district_family_attention_priority_daily_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_family_attention_priority_daily_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_family_attention_priority_daily_7d[0].loop_family_key, "payout");
  assert.equal(enriched.scene_loop_district_family_attention_priority_daily_7d[0].attention_band, "watch");
  assert.ok(enriched.scene_loop_district_family_attention_priority_daily_7d[0].priority_score > 2000);
  assert.equal(enriched.scene_loop_microflow_breakdown_24h[0].bucket_key, "duel");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].district_key, "arena_prime");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].loop_family_key, "duel_sync");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].loop_microflow_key, "duel");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].focus_key, "arena_prime:duel_sync:duel");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].risk_key, "yellow:watch:improving");
  assert.equal(
    enriched.scene_loop_district_microflow_matrix_7d[0].risk_focus_key,
    "arena_prime:duel_sync:duel|yellow:watch:improving"
  );
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(
    enriched.scene_loop_district_microflow_matrix_7d[0].action_context_signature,
    "duel_sync:duel|arena_prime:duel_sync:duel|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_matrix_7d[0].risk_context?.risk_context_signature,
    "duel_sync:duel|arena_prime:duel_sync:duel|yellow:watch:improving|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_matrix_7d[0].latest_health_band, "yellow");
  assert.equal(enriched.scene_loop_district_microflow_latest_band_breakdown_7d[0].bucket_key, "yellow");
  assert.equal(enriched.scene_loop_district_microflow_trend_breakdown_7d[0].bucket_key, "no_data");
  assert.equal(enriched.scene_loop_district_microflow_attention_breakdown_7d[0].bucket_key, "watch");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_breakdown_7d[0].bucket_key, "yellow:watch");
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_breakdown_7d[0].risk_context?.microflow_key,
    "duel"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_breakdown_7d[0].risk_context?.entry_kind_key,
    "world_entry_kind_duel_console"
  );
  assert.equal(enriched.scene_loop_district_microflow_attention_trend_breakdown_7d[0].bucket_key, "alert:no_data");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_breakdown_7d[0].bucket_key, "red:alert:no_data");
  assert.ok(
    enriched.scene_loop_district_microflow_health_attention_breakdown_7d.some(
      (row) =>
        row.bucket_key === "red:alert" &&
        row.flow_key === "wallet_link:wallet" &&
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_context?.risk_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_attention_trend_breakdown_7d.some(
      (row) =>
        row.bucket_key === "alert:no_data" &&
        row.flow_key === "wallet_link:wallet" &&
        row.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.sequence_kind_key === "world_modal_kind_wallet_terminal" &&
        row.action_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_health_attention_trend_breakdown_7d.some(
      (row) =>
        row.bucket_key === "red:alert:no_data" &&
        row.flow_key === "wallet_link:wallet" &&
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        row.contract_state_key === "missing" &&
        row.contract_ready === false &&
        row.risk_context?.context_lookup_required === true &&
        row.risk_context?.context_lookup_resolved === false
    )
  );
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].loop_family_key, "wallet_link");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].loop_microflow_key, "wallet");
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].focus_key,
    "exchange_district:wallet_link:wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].risk_focus_key,
    "exchange_district:wallet_link:wallet|red:alert:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].entry_kind_key,
    "world_entry_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].sequence_kind_key,
    "world_modal_kind_wallet_terminal"
  );
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_matrix_7d[0].attention_band, "alert");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].loop_family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].loop_microflow_key, "payout");
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].focus_key,
    "exchange_district:payout_lane:payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].risk_focus_key,
    "exchange_district:payout_lane:payout|yellow:watch:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].entry_kind_key,
    "world_entry_kind_payout_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d[0].sequence_kind_key,
    "world_modal_kind_payout_route"
  );
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_7d[0].loop_family_key, "wallet_link");
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_7d[0].loop_microflow_key, "wallet");
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_7d[0].focus_key,
    "exchange_district:wallet_link:wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_7d[0].risk_focus_key,
    "exchange_district:wallet_link:wallet|red:alert:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_7d[0].risk_context?.microflow_key,
    "wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_7d[0].risk_context?.sequence_kind_key,
    "world_modal_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_7d[0].action_context_signature,
    "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
  );
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_7d[0].contract_ready, false);
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].loop_family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].loop_microflow_key, "payout");
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].focus_key,
    "exchange_district:payout_lane:payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_context?.microflow_key,
    "payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_context?.entry_kind_key,
    "world_entry_kind_payout_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_focus_key,
    "exchange_district:payout_lane:payout|yellow:watch:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].action_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].action_context?.action_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_context?.risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].contract_state_key, "ready");
  assert.deepEqual(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].contract_missing_keys, []);
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].action_context?.contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_attention_priority_daily_7d[0].risk_context?.contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].loop_family_key, "wallet_link");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].loop_microflow_key, "wallet");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].family_key, "wallet_link");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].flow_key, "wallet_link:wallet");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].microflow_key, "wallet");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].entry_kind_key, "world_entry_kind_wallet_terminal");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].sequence_kind_key, "world_modal_kind_wallet_terminal");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_key, "red:alert:no_data");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_health_band_key, "red");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_attention_band_key, "alert");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_trend_direction_key, "no_data");
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.flow_key,
    "wallet_link:wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.focus_key,
    "exchange_district:wallet_link:wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.risk_focus_key,
    "exchange_district:wallet_link:wallet|red:alert:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.entry_kind_key,
    "world_entry_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.sequence_kind_key,
    "world_modal_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context_signature,
    "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].action_context_signature,
    "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].action_context?.action_context_signature,
    "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.risk_context_signature,
    "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
  );
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].contract_ready, false);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].contract_state_key, "missing");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_7d[0].contract_missing_keys, ["action_context_lookup"]);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].action_context?.contract_ready, false);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].action_context?.contract_state_key, "missing");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_7d[0].action_context?.contract_missing_keys, ["action_context_lookup"]);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.contract_ready, false);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.contract_state_key, "missing");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_context?.contract_missing_keys, ["action_context_lookup"]);
  assert.ok(enriched.scene_loop_district_microflow_risk_rows_7d[0].priority_score > 3000);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].district_key, "exchange_district");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].loop_family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].loop_microflow_key, "payout");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].flow_key, "payout_lane:payout");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].microflow_key, "payout");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].entry_kind_key, "world_entry_kind_payout_terminal");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].sequence_kind_key, "world_modal_kind_payout_route");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_key, "yellow:watch:no_data");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_health_band_key, "yellow");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_attention_band_key, "watch");
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_trend_direction_key, "no_data");
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.flow_key,
    "payout_lane:payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.focus_key,
    "exchange_district:payout_lane:payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.risk_focus_key,
    "exchange_district:payout_lane:payout|yellow:watch:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.entry_kind_key,
    "world_entry_kind_payout_terminal"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.sequence_kind_key,
    "world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].action_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].action_context?.action_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].contract_state_key, "ready");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].contract_missing_keys, []);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].action_context?.contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].action_context?.contract_state_key, "ready");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].action_context?.contract_missing_keys, []);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.contract_ready, true);
  assert.equal(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.contract_state_key, "ready");
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_context?.contract_missing_keys, []);
  assert.ok(enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].priority_score > 2000);
  const walletDailyRiskRow = enriched.scene_loop_district_microflow_risk_rows_daily_7d.find(
    (row) =>
      row.day === "2026-03-07" &&
      row.loop_family_key === "wallet_link" &&
      row.loop_microflow_key === "wallet"
  );
  assert.ok(walletDailyRiskRow);
  assert.equal(walletDailyRiskRow.contract_ready, false);
  assert.equal(walletDailyRiskRow.contract_state_key, "missing");
  assert.deepEqual(walletDailyRiskRow.contract_missing_keys, ["action_context_lookup"]);
  assert.equal(walletDailyRiskRow.action_context?.contract_ready, false);
  assert.equal(walletDailyRiskRow.risk_context?.contract_ready, false);
  assert.equal(walletDailyRiskRow.action_context?.context_lookup_required, true);
  assert.equal(walletDailyRiskRow.action_context?.context_lookup_resolved, false);
  assert.equal(walletDailyRiskRow.risk_context?.context_lookup_required, true);
  assert.equal(walletDailyRiskRow.risk_context?.context_lookup_resolved, false);
  assert.ok(
    enriched.scene_loop_district_microflow_risk_matrix_7d.some(
      (row) =>
        row.district_key === "exchange_district" &&
        row.loop_family_key === "wallet_link" &&
        row.loop_microflow_key === "wallet" &&
        row.risk_key === "red:alert:no_data" &&
        Number(row.day_count || 0) >= 1
    )
  );
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].loop_family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].loop_microflow_key, "payout");
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].risk_key, "yellow:watch:no_data");
  assert.equal(
    enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].risk_context?.risk_context_signature,
    "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].contract_ready, true);
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].contract_missing_keys, []);
  assert.equal(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].risk_context?.contract_ready, true);
  assert.deepEqual(enriched.scene_loop_district_microflow_risk_matrix_daily_7d[0].risk_context?.contract_missing_keys, []);
  assert.ok(
    enriched.scene_loop_district_microflow_risk_priority_7d.some(
      (row) =>
        row.district_key === "exchange_district" &&
        row.loop_family_key === "wallet_link" &&
        row.loop_microflow_key === "wallet" &&
        row.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.sequence_kind_key === "world_modal_kind_wallet_terminal" &&
        row.risk_context?.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_context?.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        row.risk_key === "red:alert:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.loop_family_key === "payout_lane" &&
        row.loop_microflow_key === "payout" &&
        row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_7d.some(
      (row) =>
        row.district_key === "exchange_district" &&
        row.loop_family_key === "wallet_link" &&
        row.loop_microflow_key === "wallet" &&
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_wallet_terminal" &&
        row.risk_key === "red:alert:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.loop_family_key === "payout_lane" &&
        row.loop_microflow_key === "payout" &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_7d.some(
      (row) =>
        row.bucket_key === "red:alert:no_data" &&
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_context?.flow_key === "wallet_link:wallet" &&
        row.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.sequence_kind_key === "world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "yellow:watch:no_data" &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.risk_context?.flow_key === "payout_lane:payout" &&
        row.risk_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.entry_kind_key === "world_entry_kind_payout_terminal" &&
        row.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].focus_key,
    "exchange_district:wallet_link:wallet"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_7d[0].risk_focus_key,
    "exchange_district:wallet_link:wallet|red:alert:no_data"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].focus_key,
    "exchange_district:payout_lane:payout"
  );
  assert.equal(
    enriched.scene_loop_district_microflow_risk_rows_daily_7d[0].risk_focus_key,
    "exchange_district:payout_lane:payout|yellow:watch:no_data"
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_key_breakdown_7d.some(
      (row) =>
        row.bucket_key === "exchange_district:wallet_link:wallet" &&
        Number(row.item_count || 0) >= 1 &&
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_key_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "exchange_district:payout_lane:payout" &&
        Number(row.item_count || 0) >= 1 &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.risk_context?.entry_kind_key === "world_entry_kind_payout_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_key_matrix_7d.some(
      (row) =>
        row.bucket_key === "exchange_district:wallet_link:wallet" &&
        row.risk_key === "red:alert:no_data" &&
        Number(row.day_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_focus_key_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "exchange_district:payout_lane:payout" &&
        row.risk_key === "yellow:watch:no_data" &&
        row.risk_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_breakdown_7d.some(
      (row) =>
        row.bucket_key === "wallet_link:wallet" &&
        Number(row.item_count || 0) >= 1 &&
        row.flow_key === "wallet_link:wallet" &&
        row.risk_context?.focus_key === "exchange_district:wallet_link:wallet"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "payout_lane:payout" &&
        Number(row.item_count || 0) >= 1 &&
        row.flow_key === "payout_lane:payout" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_matrix_7d.some(
      (row) =>
        row.bucket_key === "wallet_link:wallet" &&
        row.risk_key === "red:alert:no_data" &&
        row.risk_context?.entry_kind_key === "world_entry_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "payout_lane:payout" &&
        row.risk_key === "yellow:watch:no_data" &&
        row.risk_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_priority_7d.some(
      (row) =>
        row.flow_key === "wallet_link:wallet" &&
        row.loop_family_key === "wallet_link" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        Number(row.priority_score || 0) >= 3000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_flow_key_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.flow_key === "payout_lane:payout" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route" &&
        Number(row.priority_score || 0) >= 2000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_matrix_7d.some(
      (row) =>
        row.focus_key === "exchange_district:wallet_link:wallet" &&
        row.flow_key === "wallet_link:wallet" &&
        row.risk_context?.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.risk_context?.flow_key === "wallet_link:wallet" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.flow_key === "payout_lane:payout" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "world_entry_kind_payout_terminal" &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.flow_key === "payout_lane:payout" &&
        row.risk_context?.flow_key === "payout_lane:payout"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_priority_7d.some(
      (row) =>
        row.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        Number(row.priority_score || 0) >= 3000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.entry_kind_key === "world_entry_kind_payout_terminal" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route" &&
        Number(row.priority_score || 0) >= 2000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.focus_key === "exchange_district:payout_lane:payout" &&
        row.risk_focus_key === "exchange_district:payout_lane:payout|yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_breakdown_7d.some(
      (row) =>
        row.bucket_key === "world_entry_kind_wallet_terminal" &&
        Number(row.item_count || 0) >= 1 &&
        row.entry_kind_key === "world_entry_kind_wallet_terminal" &&
        row.risk_context?.focus_key === "exchange_district:wallet_link:wallet"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "world_entry_kind_payout_terminal" &&
        Number(row.item_count || 0) >= 1 &&
        row.entry_kind_key === "world_entry_kind_payout_terminal" &&
        row.risk_context?.risk_focus_key === "exchange_district:payout_lane:payout|yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_matrix_7d.some(
      (row) => row.bucket_key === "world_entry_kind_wallet_terminal" && row.risk_key === "red:alert:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_entry_kind_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "world_entry_kind_payout_terminal" &&
        row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_breakdown_7d.some(
      (row) =>
        row.bucket_key === "world_modal_kind_wallet_terminal" &&
        Number(row.item_count || 0) >= 1 &&
        row.sequence_kind_key === "world_modal_kind_wallet_terminal" &&
        row.risk_context?.flow_key === "wallet_link:wallet"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "world_modal_kind_payout_route" &&
        Number(row.item_count || 0) >= 1 &&
        row.sequence_kind_key === "world_modal_kind_payout_route" &&
        row.risk_context?.flow_key === "payout_lane:payout"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_matrix_7d.some(
      (row) => row.bucket_key === "world_modal_kind_wallet_terminal" && row.risk_key === "red:alert:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "world_modal_kind_payout_route" &&
        row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_priority_7d.some(
      (row) =>
        row.sequence_kind_key === "world_modal_kind_wallet_terminal" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        Number(row.priority_score || 0) >= 3000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_sequence_kind_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.sequence_kind_key === "world_modal_kind_payout_route" &&
        row.risk_context?.entry_kind_key === "world_entry_kind_payout_terminal" &&
        Number(row.priority_score || 0) >= 2000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_breakdown_7d.some(
      (row) =>
        row.bucket_key ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.flow_key === "wallet_link:wallet" &&
        row.risk_context?.focus_key === "exchange_district:wallet_link:wallet"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_matrix_7d.some(
      (row) =>
        row.bucket_key ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.risk_key === "red:alert:no_data" &&
        row.risk_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.risk_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_priority_7d.some(
      (row) =>
        row.risk_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.loop_microflow_key === "wallet" &&
        Number(row.priority_score || 0) >= 3000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_signature_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.risk_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|yellow:watch:no_data|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.loop_microflow_key === "payout" &&
        Number(row.priority_score || 0) >= 2000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_breakdown_7d.some(
      (row) =>
        row.bucket_key ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.flow_key === "wallet_link:wallet" &&
        row.risk_context?.focus_key === "exchange_district:wallet_link:wallet"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key ===
          "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_matrix_7d.some(
      (row) =>
        row.bucket_key ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.risk_key === "red:alert:no_data" &&
        row.action_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key ===
          "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.action_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_priority_7d.some(
      (row) =>
        row.action_context_signature ===
          "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal" &&
        row.loop_microflow_key === "wallet" &&
        Number(row.priority_score || 0) >= 3000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_action_signature_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.action_context_signature ===
          "payout_lane:payout|exchange_district:payout_lane:payout|world_entry_kind_payout_terminal|world_modal_kind_payout_route" &&
        row.loop_microflow_key === "payout" &&
        Number(row.priority_score || 0) >= 2000
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_breakdown_7d.some(
      (row) =>
        row.bucket_key === "ready" &&
        row.contract_state_key === "ready" &&
        row.risk_context?.contract_state_key === "ready" &&
        row.risk_context?.risk_context_signature
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_breakdown_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "ready" &&
        row.risk_context?.flow_key === "payout_lane:payout"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_matrix_7d.some(
      (row) =>
        row.bucket_key === "ready" &&
        row.contract_state_key === "ready" &&
        row.risk_context?.contract_state_key === "ready" &&
        row.risk_context_signature
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "ready" &&
        row.contract_state_key === "ready" &&
        row.risk_context?.sequence_kind_key === "world_modal_kind_payout_route"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_priority_7d.some(
      (row) =>
        row.contract_state_key === "missing" &&
        row.risk_focus_key === "exchange_district:wallet_link:wallet|red:alert:no_data" &&
        row.risk_context?.context_lookup_required === true &&
        row.risk_context?.context_lookup_resolved === false
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_contract_state_priority_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.contract_state_key === "ready" &&
        row.focus_key === "exchange_district:payout_lane:payout"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_latest_band_breakdown_7d.some(
      (row) => row.bucket_key === "red" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_attention_breakdown_7d.some(
      (row) => row.bucket_key === "alert" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_trend_breakdown_7d.some(
      (row) => row.bucket_key === "no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_health_attention_trend_breakdown_7d.some(
      (row) => row.bucket_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.equal(enriched.scene_loop_district_microflow_risk_health_attention_trend_daily_matrix_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_microflow_risk_health_attention_trend_daily_matrix_7d[0].loop_family_key, "payout_lane");
  assert.equal(enriched.scene_loop_district_microflow_risk_health_attention_trend_daily_matrix_7d[0].loop_microflow_key, "payout");
  assert.equal(enriched.scene_loop_district_microflow_risk_health_attention_trend_daily_matrix_7d[0].attention_band, "watch");
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_7d.some(
      (row) => row.bucket_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_7d.some(
      (row) => row.bucket_key === "yellow:watch:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "yellow:watch:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-07" && row.bucket_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_district_breakdown_7d.some(
      (row) => row.bucket_key === "exchange_district" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_district_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "exchange_district" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_district_matrix_7d.some(
      (row) =>
        row.bucket_key === "exchange_district" &&
        row.risk_key === "red:alert:no_data" &&
        Number(row.day_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_district_matrix_daily_7d.some(
      (row) =>
        row.day === "2026-03-08" &&
        row.bucket_key === "exchange_district" &&
        row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_family_breakdown_7d.some(
      (row) => row.bucket_key === "wallet_link" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_family_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "payout_lane" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_family_matrix_7d.some(
      (row) => row.bucket_key === "wallet_link" && row.risk_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_family_matrix_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "payout_lane" && row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_microflow_breakdown_7d.some(
      (row) => row.bucket_key === "wallet" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_microflow_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "payout" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_microflow_matrix_7d.some(
      (row) => row.bucket_key === "wallet" && row.risk_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_microflow_matrix_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "payout" && row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_health_band_breakdown_7d.some(
      (row) => row.bucket_key === "red" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_health_band_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "yellow" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_health_band_matrix_7d.some(
      (row) => row.bucket_key === "red" && row.risk_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_health_band_matrix_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "yellow" && row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_attention_band_breakdown_7d.some(
      (row) => row.bucket_key === "alert" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_attention_band_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "watch" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_attention_band_matrix_7d.some(
      (row) => row.bucket_key === "alert" && row.risk_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_attention_band_matrix_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "watch" && row.risk_key === "yellow:watch:no_data"
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_trend_direction_breakdown_7d.some(
      (row) => row.bucket_key === "no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_trend_direction_breakdown_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_trend_direction_matrix_7d.some(
      (row) => row.bucket_key === "no_data" && row.risk_key === "red:alert:no_data" && Number(row.item_count || 0) >= 1
    )
  );
  assert.ok(
    enriched.scene_loop_district_microflow_risk_trend_direction_matrix_daily_7d.some(
      (row) => row.day === "2026-03-08" && row.bucket_key === "no_data" && row.risk_key === "yellow:watch:no_data"
    )
  );
});
