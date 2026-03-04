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
    payload_json: { foo: "bar" }
  });
  assert.ok(valid);
  assert.equal(valid.event_key, "tab_open");
  assert.equal(valid.tab_key, "home");
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
