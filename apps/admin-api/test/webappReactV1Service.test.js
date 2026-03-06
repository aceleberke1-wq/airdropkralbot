const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const service = require(path.join(process.cwd(), "apps", "admin-api", "src", "services", "webapp", "reactV1Service.js"));

test("computeCohortBucket is deterministic for uid+key", () => {
  const a = service.computeCohortBucket(42, "webapp_react_v1");
  const b = service.computeCohortBucket(42, "webapp_react_v1");
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 99);
});

test("buildExperimentAssignment respects enable and treatment percent", () => {
  const control = service.buildExperimentAssignment({
    uid: 77,
    experimentKey: "webapp_react_v1",
    enabled: false,
    treatmentPercent: 100
  });
  assert.equal(control.variant, "control");

  const maybeTreatment = service.buildExperimentAssignment({
    uid: 77,
    experimentKey: "webapp_react_v1",
    enabled: true,
    treatmentPercent: 100
  });
  assert.equal(maybeTreatment.variant, "treatment");
});

test("normalizeUiEvent rejects invalid event key and accepts bounded payload", () => {
  const invalid = service.normalizeUiEvent({
    event_key: "bad key with space"
  });
  assert.equal(invalid, null);

  const valid = service.normalizeUiEvent({
    event_key: "tab_open",
    tab_key: "home",
    panel_key: "hero",
    event_value: 1,
    funnel_key: "vault_intent",
    surface_key: "vault_panel",
    economy_event_key: "token_intent",
    value_usd: 11.25,
    tx_state: "intent",
    payload_json: { foo: "bar" }
  });
  assert.ok(valid);
  assert.equal(valid.event_key, "tab_open");
  assert.equal(valid.tab_key, "home");
  assert.equal(valid.funnel_key, "vault_intent");
  assert.equal(valid.surface_key, "vault_panel");
  assert.equal(valid.economy_event_key, "token_intent");
  assert.equal(valid.value_usd, 11.25);
  assert.equal(valid.tx_state, "intent");
});

test("normalizeUiEventBatch returns accepted and rejected counts", () => {
  const batch = service.normalizeUiEventBatch(
    [
      { event_key: "tab_open", tab_key: "home" },
      { event_key: "bad key" },
      { event_key: "action_click", tab_key: "pvp" }
    ],
    { panel_key: "default" }
  );
  assert.equal(batch.accepted.length, 2);
  assert.equal(batch.rejected, 1);
});

test("buildUiEventIdempotencyKey stays stable for same payload", () => {
  const events = [
    { event_key: "tab_open", client_ts: "2026-03-04T00:00:00.000Z" },
    { event_key: "action_click", client_ts: "2026-03-04T00:00:01.000Z" }
  ];
  const k1 = service.buildUiEventIdempotencyKey(1, "sess_1", events);
  const k2 = service.buildUiEventIdempotencyKey(1, "sess_1", events);
  assert.equal(k1, k2);
  assert.match(k1, /^[a-f0-9]{40}$/);
});

test("resolveExperimentAssignment forceTreatment upgrades existing control row", async () => {
  const state = {
    uid: 88,
    experiment_key: "webapp_react_v1",
    variant_key: "control",
    cohort_bucket: 17,
    assigned_at: "2026-03-04T00:00:00.000Z"
  };
  const db = {
    async query(sql) {
      const text = String(sql || "");
      if (text.includes("SELECT uid, experiment_key, variant_key, cohort_bucket, assigned_at")) {
        return { rows: [state] };
      }
      if (text.includes("UPDATE v5_webapp_experiment_assignments")) {
        state.variant_key = "treatment";
        return { rows: [state] };
      }
      return { rows: [] };
    }
  };

  const result = await service.resolveExperimentAssignment(db, {
    uid: 88,
    experimentKey: "webapp_react_v1",
    enabled: true,
    treatmentPercent: 100,
    forceTreatment: true
  });

  assert.equal(result.variant, "treatment");
  assert.equal(result.source, "db_forced_treatment");
  assert.equal(result.cohort_bucket, 17);
});
