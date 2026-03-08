const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  const target = pathToFileURL(path.join(process.cwd(), "scripts", "v5_live_ops_ops_alert.mjs")).href;
  return import(target);
}

test("evaluateOpsAlert notifies on alert state and dedupes repeated fingerprint", async () => {
  const mod = await loadModule();
  const dispatchArtifact = {
    scheduler_skip_summary: {
      alarm_state: "alert",
      alarm_reason: "scene_runtime_alert_blocked_repeated",
      skipped_24h: 2,
      skipped_7d: 4,
      latest_skip_reason: "scene_runtime_alert_blocked",
      latest_skip_at: "2026-03-08T15:00:00.000Z"
    }
  };

  const first = mod.evaluateOpsAlert(dispatchArtifact, null, {
    now: new Date("2026-03-08T15:10:00.000Z"),
    cooldownMinutes: 180
  });
  assert.equal(first.should_notify, true);
  assert.equal(first.notification_reason, "alert_state");

  const second = mod.evaluateOpsAlert(
    dispatchArtifact,
    {
      evaluation: { fingerprint: first.fingerprint },
      telegram: { sent_at: "2026-03-08T15:05:00.000Z" }
    },
    {
      now: new Date("2026-03-08T15:10:00.000Z"),
      cooldownMinutes: 180
    }
  );
  assert.equal(second.should_notify, false);
  assert.equal(second.notification_reason, "cooldown_active");
});

test("runLiveOpsOpsAlert writes latest artifact and skips telegram on clear state", async () => {
  const mod = await loadModule();
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-liveops-alert-"));
  const liveopsDir = path.join(repoRoot, ".runtime-artifacts", "liveops");
  fs.mkdirSync(liveopsDir, { recursive: true });
  fs.writeFileSync(
    path.join(liveopsDir, "V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"),
    `${JSON.stringify({
      generated_at: "2026-03-08T15:00:00.000Z",
      ok: true,
      skipped: true,
      reason: "campaign_approval_required",
      campaign_key: "comeback_pulse",
      scheduler_skip_summary: {
        alarm_state: "clear",
        alarm_reason: "",
        skipped_24h: 0,
        skipped_7d: 0,
        latest_skip_reason: "",
        latest_skip_at: null
      },
      scheduler_summary: {
        scene_gate_state: "no_data",
        scene_gate_effect: "open",
        scene_gate_reason: "scene_runtime_no_data"
      }
    }, null, 2)}\n`,
    "utf8"
  );

  let fetchCalled = false;
  const result = await mod.runLiveOpsOpsAlert(
    { notify_telegram: "true", apply_exit_code: "false" },
    {
      repoRoot,
      nowFactory: () => new Date("2026-03-08T15:15:00.000Z"),
      fetchImpl: async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      },
      botToken: "bot_token",
      adminTelegramId: "42"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.evaluation.should_notify, false);
  assert.equal(fetchCalled, false);
  const alertArtifact = JSON.parse(
    fs.readFileSync(path.join(liveopsDir, "V5_LIVE_OPS_OPS_ALERT_latest.json"), "utf8")
  );
  assert.equal(alertArtifact.evaluation.alarm_state, "clear");
  assert.equal(alertArtifact.telegram.sent, false);
});

test("runLiveOpsOpsAlert records audit when alert fingerprint changes", async () => {
  const mod = await loadModule();
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-liveops-alert-audit-"));
  const liveopsDir = path.join(repoRoot, ".runtime-artifacts", "liveops");
  fs.mkdirSync(liveopsDir, { recursive: true });
  fs.writeFileSync(
    path.join(liveopsDir, "V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"),
    `${JSON.stringify({
      generated_at: "2026-03-08T15:00:00.000Z",
      ok: false,
      skipped: true,
      reason: "scene_runtime_alert_blocked",
      campaign_key: "wallet_reconnect",
      version: 9,
      dispatch_ref: "",
      campaign_context: {
        experiment_key: "webapp_react_v1",
        segment_key: "wallet_unlinked",
        locale_bucket: "tr",
        surface_bucket: "wallet_panel",
        variant_bucket: "treatment",
        cohort_bucket: "17"
      },
      scheduler_skip_summary: {
        alarm_state: "alert",
        alarm_reason: "scene_runtime_alert_blocked_repeated",
        skipped_24h: 2,
        skipped_7d: 4,
        latest_skip_reason: "scene_runtime_alert_blocked",
        latest_skip_at: "2026-03-08T15:00:00.000Z"
      },
      scheduler_summary: {
        scene_gate_state: "alert",
        scene_gate_effect: "blocked",
        scene_gate_reason: "scene_runtime_alert_blocked"
      }
    }, null, 2)}\n`,
    "utf8"
  );

  const auditPayloads = [];
  const result = await mod.runLiveOpsOpsAlert(
    { notify_telegram: "false", admin_id: "7009", apply_exit_code: "false" },
    {
      repoRoot,
      nowFactory: () => new Date("2026-03-08T15:15:00.000Z"),
      recordOpsAlertAudit: async (payload) => {
        auditPayloads.push(payload);
        return {
          attempted: true,
          recorded: true,
          reason: "",
          created_at: "2026-03-08T15:15:00.000Z"
        };
      }
    }
  );

  assert.equal(result.audit.recorded, true);
  assert.equal(auditPayloads.length, 1);
  assert.equal(auditPayloads[0].campaign_key, "wallet_reconnect");
  assert.equal(auditPayloads[0].alarm_state, "alert");
  assert.equal(auditPayloads[0].admin_id, 7009);
  assert.equal(auditPayloads[0].experiment_key, "webapp_react_v1");
  assert.equal(auditPayloads[0].locale_bucket, "tr");
  assert.equal(auditPayloads[0].segment_key, "wallet_unlinked");
  assert.equal(auditPayloads[0].surface_bucket, "wallet_panel");
  assert.equal(auditPayloads[0].variant_bucket, "treatment");
  assert.equal(auditPayloads[0].cohort_bucket, "17");
});
