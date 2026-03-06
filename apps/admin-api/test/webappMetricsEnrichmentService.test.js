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
    funnel_value_usd_24h: 120.9999999
  });

  assert.equal(enriched.ui_event_quality_score_24h, 0.94);
  assert.equal(enriched.ui_event_quality_band_24h, "yellow");
  assert.equal(enriched.funnel_intent_to_submit_rate_24h, 0.625);
  assert.equal(enriched.funnel_submit_to_approved_rate_24h, 0.6);
  assert.equal(enriched.funnel_conversion_band_24h, "green");
  assert.equal(enriched.ui_events_value_usd_24h, 321.98765432);
  assert.equal(enriched.funnel_value_usd_24h, 120.9999999);
});
