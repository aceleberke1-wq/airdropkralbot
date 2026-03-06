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
  "dynamicAutoPolicyService.js"
));

test("listDynamicAutoPolicies falls back to default segments when table is missing", async () => {
  const db = {
    async query() {
      const err = new Error("table missing");
      err.code = "42P01";
      throw err;
    }
  };
  const rows = await service.listDynamicAutoPolicies(db, "NXT");
  assert.ok(Array.isArray(rows));
  assert.ok(rows.length >= 5);
  assert.equal(rows[0].token_symbol, "NXT");
});

test("resolveDynamicAutoPolicyDecision applies segment and anomaly degrade factors", async () => {
  const db = {
    async query(sql) {
      const text = String(sql || "");
      if (text.includes("FROM v5_token_auto_policy_dynamic") && text.includes("ORDER BY priority")) {
        return {
          rows: [
            {
              token_symbol: "NXT",
              segment_key: "s2_watch",
              priority: 30,
              max_auto_usd: 8,
              risk_threshold: 0.2,
              velocity_per_hour: 4,
              require_onchain_verified: true,
              require_kyc_status: "",
              enabled: true,
              degrade_factor: 0.9,
              meta_json: {},
              updated_by: 1,
              updated_at: new Date().toISOString()
            }
          ]
        };
      }
      if (text.includes("FROM token_auto_decisions")) {
        return {
          rows: [{ total_24h: 100, non_auto_24h: 40, manual_review_24h: 10 }]
        };
      }
      if (text.includes("FROM v5_payout_dispute_events")) {
        return {
          rows: [{ disputes_24h: 5 }]
        };
      }
      return { rows: [] };
    }
  };

  const result = await service.resolveDynamicAutoPolicyDecision(db, {
    token_symbol: "NXT",
    base_policy: {
      enabled: true,
      autoUsdLimit: 20,
      riskThreshold: 0.4,
      velocityPerHour: 10,
      requireOnchainVerified: true
    },
    input: {
      risk_score: 0.65,
      velocity_per_hour: 14,
      usd_amount: 120,
      kyc_status: "verified",
      gate_open: true
    }
  });

  assert.equal(result.selected_segment_key, "s2_watch");
  assert.equal(result.anomaly_state.degrade_active, true);
  assert.equal(result.policy.enabled, true);
  assert.ok(Math.abs(Number(result.policy.autoUsdLimit || 0) - 4.68) < 1e-9);
  assert.ok(Math.abs(Number(result.policy.riskThreshold || 0) - 0.117) < 1e-9);
  assert.equal(result.policy.velocityPerHour, 2);
});

test("resolveDynamicAutoPolicyDecision disables auto policy on kyc requirement mismatch", async () => {
  const db = {
    async query(sql) {
      const text = String(sql || "");
      if (text.includes("FROM v5_token_auto_policy_dynamic") && text.includes("ORDER BY priority")) {
        return {
          rows: [
            {
              token_symbol: "NXT",
              segment_key: "s1_normal",
              priority: 20,
              max_auto_usd: 20,
              risk_threshold: 0.35,
              velocity_per_hour: 8,
              require_onchain_verified: true,
              require_kyc_status: "verified",
              enabled: true,
              degrade_factor: 1,
              meta_json: {},
              updated_by: 1,
              updated_at: new Date().toISOString()
            }
          ]
        };
      }
      if (text.includes("FROM token_auto_decisions")) {
        return {
          rows: [{ total_24h: 0, non_auto_24h: 0, manual_review_24h: 0 }]
        };
      }
      if (text.includes("FROM v5_payout_dispute_events")) {
        return {
          rows: [{ disputes_24h: 0 }]
        };
      }
      return { rows: [] };
    }
  };

  const result = await service.resolveDynamicAutoPolicyDecision(db, {
    token_symbol: "NXT",
    base_policy: {
      enabled: true,
      autoUsdLimit: 20,
      riskThreshold: 0.4,
      velocityPerHour: 10,
      requireOnchainVerified: true
    },
    input: {
      risk_score: 0.2,
      velocity_per_hour: 3,
      usd_amount: 10,
      kyc_status: "pending",
      gate_open: true
    }
  });

  assert.equal(result.selected_segment_key, "s1_normal");
  assert.equal(result.required_kyc_mismatch, true);
  assert.equal(result.policy.enabled, false);
});

test("upsertDynamicAutoPolicies replaces missing segments and writes delete audit", async () => {
  const segmentStore = new Map([
    [
      "s0_trusted",
      {
        token_symbol: "NXT",
        segment_key: "s0_trusted",
        priority: 10,
        max_auto_usd: 40,
        risk_threshold: 0.35,
        velocity_per_hour: 12,
        require_onchain_verified: true,
        require_kyc_status: "",
        enabled: true,
        degrade_factor: 1,
        meta_json: {},
        updated_by: 1,
        updated_at: new Date().toISOString()
      }
    ],
    [
      "s1_normal",
      {
        token_symbol: "NXT",
        segment_key: "s1_normal",
        priority: 20,
        max_auto_usd: 20,
        risk_threshold: 0.28,
        velocity_per_hour: 8,
        require_onchain_verified: true,
        require_kyc_status: "",
        enabled: true,
        degrade_factor: 1,
        meta_json: {},
        updated_by: 1,
        updated_at: new Date().toISOString()
      }
    ]
  ]);
  const auditRows = [];
  let deletedCount = 0;

  const db = {
    async query(sql, params = []) {
      const text = String(sql || "");
      if (text.includes("FROM v5_token_auto_policy_dynamic") && text.includes("ORDER BY priority")) {
        return { rows: Array.from(segmentStore.values()).sort((a, b) => a.priority - b.priority) };
      }
      if (text.includes("FROM v5_token_auto_policy_dynamic") && text.includes("AND segment_key = $2")) {
        return { rows: segmentStore.has(params[1]) ? [segmentStore.get(params[1])] : [] };
      }
      if (text.includes("INSERT INTO v5_token_auto_policy_dynamic_audit")) {
        auditRows.push({
          token_symbol: params[0],
          segment_key: params[1],
          reason: params[4]
        });
        return { rows: [] };
      }
      if (/INSERT INTO v5_token_auto_policy_dynamic\s*\(/.test(text)) {
        const row = {
          token_symbol: String(params[0] || "NXT"),
          segment_key: String(params[1] || ""),
          priority: Number(params[2] || 100),
          max_auto_usd: Number(params[3] || 10),
          risk_threshold: Number(params[4] || 0.35),
          velocity_per_hour: Number(params[5] || 8),
          require_onchain_verified: Boolean(params[6]),
          require_kyc_status: String(params[7] || ""),
          enabled: Boolean(params[8]),
          degrade_factor: Number(params[9] || 1),
          meta_json: params[10] ? JSON.parse(params[10]) : {},
          updated_by: Number(params[11] || 0),
          updated_at: new Date().toISOString()
        };
        segmentStore.set(row.segment_key, row);
        return { rows: [row] };
      }
      if (text.includes("AND NOT (segment_key = ANY($2::text[]))") && text.includes("SELECT")) {
        const keep = Array.isArray(params[1]) ? params[1] : [];
        const rows = Array.from(segmentStore.values()).filter((entry) => !keep.includes(entry.segment_key));
        return { rows };
      }
      if (text.includes("DELETE FROM v5_token_auto_policy_dynamic")) {
        const keep = Array.isArray(params[1]) ? params[1] : [];
        for (const key of Array.from(segmentStore.keys())) {
          if (!keep.includes(key)) {
            segmentStore.delete(key);
            deletedCount += 1;
          }
        }
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  const result = await service.upsertDynamicAutoPolicies(db, {
    token_symbol: "NXT",
    actor_id: 7001,
    reason: "policy_update",
    replace_missing: true,
    segments: [
      {
        segment_key: "s1_normal",
        priority: 20,
        max_auto_usd: 18,
        risk_threshold: 0.26,
        velocity_per_hour: 7,
        enabled: true,
        degrade_factor: 1
      }
    ]
  });

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 1);
  assert.equal(result[0].segment_key, "s1_normal");
  assert.equal(deletedCount, 1);
  assert.ok(auditRows.some((entry) => String(entry.reason || "").includes("delete_missing")));
});
