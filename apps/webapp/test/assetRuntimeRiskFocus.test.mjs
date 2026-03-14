import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssetRiskFocusRows,
  decorateRiskRowsWithAssetRuntime,
  summarizeAssetRiskFocusRows
} from "../src/core/admin/assetRuntimeRiskFocus.js";

function createLocalManifest() {
  return {
    district_family_asset_runtime_rows: [
      {
        district_key: "exchange_district",
        family_key: "wallet",
        asset_key: "exchange_artifact",
        focus_key: "exchange_district:wallet:exchange_artifact",
        runtime_state_key: "partial",
        domain_state_key: "ready",
        runtime_contract_ready: false,
        runtime_contract_signature:
          "exchange_district:wallet:exchange_artifact|partial|ready|guard_match|exchange_khronos_damaged_helmet",
        asset_contract_signature: "exchange_district:wallet:exchange_artifact|partial|exchange_khronos_damaged_helmet",
        file_name: "exchange-artifact.glb"
      }
    ],
    district_family_asset_variation_runtime_rows: [
      {
        district_key: "exchange_district",
        family_key: "premium",
        asset_key: "exchange_vial",
        variant_key: "exchange_premium_vial",
        variant_role: "ambient",
        variant_tier: "secondary",
        focus_key: "exchange_district:premium:exchange_premium_vial",
        runtime_state_key: "ready",
        domain_state_key: "ready",
        runtime_contract_ready: true,
        runtime_contract_signature:
          "exchange_district:premium:exchange_premium_vial|ready|ready|guard_match|exchange_khronos_waterbottle_vial",
        asset_contract_signature: "exchange_district:premium:exchange_premium_vial|ready|exchange_khronos_waterbottle_vial",
        file_name: "exchange-vial.glb"
      }
    ]
  };
}

test("buildAssetRiskFocusRows matches family aggregate rows to asset runtime contracts", () => {
  const rows = buildAssetRiskFocusRows({
    metrics: {
      scene_loop_district_family_attention_priority_7d: [
        {
          district_key: "exchange_district",
          loop_family_key: "wallet_link",
          flow_key: "wallet_link:wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "red:alert:no_data",
          latest_health_band: "red",
          attention_band: "alert",
          trend_direction: "no_data",
          priority_score: 3200,
          contract_ready: true,
          risk_context: {
            family_key: "wallet_link",
            microflow_key: "wallet",
            flow_key: "wallet_link:wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
            risk_health_band_key: "red",
            risk_attention_band_key: "alert",
            risk_trend_direction_key: "no_data",
            contract_ready: true
          },
          action_context: {
            family_key: "wallet_link",
            microflow_key: "wallet",
            flow_key: "wallet_link:wallet",
            focus_key: "exchange_district:wallet_link:wallet"
          }
        }
      ]
    },
    localManifest: createLocalManifest()
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].scope_kind, "family");
  assert.equal(rows[0].scope_key, "wallet_link");
  assert.equal(rows[0].microflow_key, "wallet");
  assert.equal(rows[0].flow_key, "wallet_link:wallet");
  assert.equal(rows[0].risk_key, "red:alert:no_data");
  assert.equal(rows[0].asset_risk_contract_signature.includes("family:wallet_link"), false);
});

test("buildAssetRiskFocusRows prefers exact microflow matches over broader family matches", () => {
  const rows = buildAssetRiskFocusRows({
    metrics: {
      scene_loop_district_microflow_risk_priority_7d: [
        {
          district_key: "exchange_district",
          loop_family_key: "wallet_link",
          loop_microflow_key: "premium",
          flow_key: "wallet_link:premium",
          focus_key: "exchange_district:wallet_link:premium",
          risk_key: "red:alert:no_data",
          priority_score: 9999,
          contract_ready: true,
          risk_context: {
            family_key: "wallet_link",
            microflow_key: "premium",
            flow_key: "wallet_link:premium",
            focus_key: "exchange_district:wallet_link:premium",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:premium|red:alert:no_data",
            risk_health_band_key: "red",
            risk_attention_band_key: "alert",
            risk_trend_direction_key: "no_data",
            contract_ready: true
          }
        },
        {
          district_key: "exchange_district",
          loop_family_key: "wallet_link",
          loop_microflow_key: "wallet",
          flow_key: "wallet_link:wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "yellow:watch:improving",
          priority_score: 100,
          contract_ready: true,
          risk_context: {
            family_key: "wallet_link",
            microflow_key: "wallet",
            flow_key: "wallet_link:wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            risk_key: "yellow:watch:improving",
            risk_focus_key: "exchange_district:wallet_link:wallet|yellow:watch:improving",
            risk_health_band_key: "yellow",
            risk_attention_band_key: "watch",
            risk_trend_direction_key: "improving",
            contract_ready: true
          }
        }
      ]
    },
    localManifest: createLocalManifest(),
    scope: "microflow"
  });

  assert.equal(rows.length, 2);
  const walletRow = rows.find((row) => row.asset_key === "exchange_artifact");
  const premiumRow = rows.find((row) => row.asset_key === "exchange_vial");
  assert.ok(walletRow);
  assert.ok(premiumRow);
  assert.equal(walletRow.scope_kind, "microflow");
  assert.equal(walletRow.scope_key, "wallet");
  assert.equal(walletRow.microflow_key, "wallet");
  assert.equal(walletRow.flow_key, "wallet_link:wallet");
  assert.match(walletRow.asset_risk_contract_signature, /microflow:wallet/i);
  assert.equal(premiumRow.scope_key, "premium");
  assert.equal(premiumRow.asset_bundle_kind, "variation");
  assert.equal(premiumRow.asset_variant_key, "exchange_premium_vial");
});

test("buildAssetRiskFocusRows carries daily scope metadata into asset risk rows", () => {
  const rows = buildAssetRiskFocusRows({
    metrics: {
      scene_loop_district_microflow_risk_priority_daily_7d: [
        {
          day: "2026-03-14",
          district_key: "exchange_district",
          loop_family_key: "wallet_link",
          loop_microflow_key: "wallet",
          flow_key: "wallet_link:wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "red:alert:no_data",
          priority_score: 1800,
          contract_ready: true,
          risk_context: {
            family_key: "wallet_link",
            microflow_key: "wallet",
            flow_key: "wallet_link:wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
            risk_health_band_key: "red",
            risk_attention_band_key: "alert",
            risk_trend_direction_key: "no_data",
            contract_ready: true
          }
        }
      ]
    },
    localManifest: createLocalManifest(),
    scope: "microflow",
    daily: true
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].day, "2026-03-14");
  assert.equal(rows[0].scope_kind, "microflow");
  assert.equal(rows[0].scope_key, "wallet");
  assert.match(rows[0].asset_risk_contract_signature, /day:2026-03-14/i);

  const summary = summarizeAssetRiskFocusRows(rows);
  assert.equal(summary.row_count, 1);
  assert.equal(summary.alert_count, 1);
});

test("buildAssetRiskFocusRows includes variation runtime rows when secondary family risk matches", () => {
  const rows = buildAssetRiskFocusRows({
    metrics: {
      scene_loop_district_family_attention_priority_7d: [
        {
          district_key: "exchange_district",
          loop_family_key: "premium",
          flow_key: "premium:wallet",
          focus_key: "exchange_district:premium:wallet",
          risk_key: "yellow:watch:stable",
          latest_health_band: "yellow",
          attention_band: "watch",
          trend_direction: "stable",
          priority_score: 900,
          contract_ready: true,
          risk_context: {
            family_key: "premium",
            microflow_key: "wallet",
            flow_key: "premium:wallet",
            focus_key: "exchange_district:premium:wallet",
            risk_key: "yellow:watch:stable",
            risk_focus_key: "exchange_district:premium:wallet|yellow:watch:stable",
            risk_health_band_key: "yellow",
            risk_attention_band_key: "watch",
            risk_trend_direction_key: "stable",
            contract_ready: true
          }
        }
      ]
    },
    localManifest: createLocalManifest()
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_bundle_kind, "variation");
  assert.equal(rows[0].asset_variant_key, "exchange_premium_vial");
  assert.equal(rows[0].asset_variant_role, "ambient");
  assert.equal(rows[0].focus_key, "exchange_district:premium:exchange_premium_vial");
});

test("decorateRiskRowsWithAssetRuntime overlays family daily rows with asset runtime contract", () => {
  const rows = decorateRiskRowsWithAssetRuntime({
    rows: [
      {
        day: "2026-03-14",
        district_key: "exchange_district",
        loop_family_key: "wallet_link",
        focus_key: "exchange_district:wallet_link:wallet",
        priority_score: 1800,
        risk_key: "red:alert:no_data",
        risk_context: {
          family_key: "wallet_link",
          microflow_key: "wallet",
          flow_key: "wallet_link:wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "red:alert:no_data"
        }
      }
    ],
    localManifest: createLocalManifest(),
    scope: "family"
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_focus_key, "exchange_district:wallet:exchange_artifact");
  assert.equal(rows[0].asset_key, "exchange_artifact");
  assert.equal(rows[0].asset_runtime_state_key, "partial");
  assert.equal(rows[0].asset_runtime_contract_ready, false);
  assert.match(rows[0].asset_runtime_contract_signature, /exchange_district:wallet:exchange_artifact/i);
});

test("decorateRiskRowsWithAssetRuntime overlays microflow daily rows with exact asset family match", () => {
  const rows = decorateRiskRowsWithAssetRuntime({
    rows: [
      {
        day: "2026-03-14",
        district_key: "exchange_district",
        loop_family_key: "wallet_link",
        loop_microflow_key: "wallet",
        focus_key: "exchange_district:wallet_link:wallet",
        priority_score: 1800,
        risk_key: "red:alert:no_data",
        risk_context: {
          family_key: "wallet_link",
          microflow_key: "wallet",
          flow_key: "wallet_link:wallet",
          focus_key: "exchange_district:wallet_link:wallet",
          risk_key: "red:alert:no_data"
        }
      }
    ],
    localManifest: createLocalManifest(),
    scope: "microflow"
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_scope_kind, "microflow");
  assert.equal(rows[0].asset_scope_key, "wallet");
  assert.equal(rows[0].asset_family_key, "wallet");
  assert.equal(rows[0].asset_focus_key, "exchange_district:wallet:exchange_artifact");
});

test("decorateRiskRowsWithAssetRuntime overlays family rows with matching variation runtime contract", () => {
  const rows = decorateRiskRowsWithAssetRuntime({
    rows: [
      {
        district_key: "exchange_district",
        loop_family_key: "premium",
        focus_key: "exchange_district:premium:wallet",
        priority_score: 900,
        risk_key: "yellow:watch:stable",
        risk_context: {
          family_key: "premium",
          microflow_key: "wallet",
          flow_key: "premium:wallet",
          focus_key: "exchange_district:premium:wallet",
          risk_key: "yellow:watch:stable"
        }
      }
    ],
    localManifest: createLocalManifest(),
    scope: "family"
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_bundle_kind, "variation");
  assert.equal(rows[0].asset_variant_key, "exchange_premium_vial");
  assert.equal(rows[0].asset_variant_role, "ambient");
  assert.equal(rows[0].asset_focus_key, "exchange_district:premium:exchange_premium_vial");
});
