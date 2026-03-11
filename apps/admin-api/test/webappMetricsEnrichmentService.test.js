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
    { day: "2026-03-08", total_count: 14, ignored: 1 },
    { day: "2026-03-07", total_count: 9 }
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].day, "2026-03-08");
  assert.equal(rows[0].total_count, 14);
  assert.equal("ignored" in rows[0], false);
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
    scene_loop_daily_breakdown_7d: [
      { day: "2026-03-08", total_count: 11 },
      { day: "2026-03-07", total_count: 7 }
    ],
    scene_loop_district_breakdown_24h: [{ bucket_key: "arena_prime", item_count: 6 }],
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
  assert.equal(enriched.scene_loop_daily_breakdown_7d[0].day, "2026-03-08");
  assert.equal(enriched.scene_loop_district_breakdown_24h[0].bucket_key, "arena_prime");
  assert.equal(enriched.scene_loop_status_breakdown_24h[0].bucket_key, "active");
  assert.equal(enriched.scene_loop_sequence_breakdown_24h[0].bucket_key, "world_modal_kind_duel_sequence");
  assert.equal(enriched.scene_loop_entry_breakdown_24h[0].bucket_key, "world_entry_kind_duel_console");
});
