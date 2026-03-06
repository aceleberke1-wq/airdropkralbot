import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadParserModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "admin", "adminDraftParsers.js")
  ).href;
  return import(target);
}

test("parseDynamicPolicySegmentsDraft accepts valid segment array", async () => {
  const parser = await loadParserModule();
  const result = parser.parseDynamicPolicySegmentsDraft('[{"segment_key":"s1_normal","enabled":true}]');
  assert.equal(result.ok, true);
  assert.equal(result.error, "");
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].segment_key, "s1_normal");
});

test("parseDynamicPolicySegmentsDraft rejects invalid payloads", async () => {
  const parser = await loadParserModule();
  assert.equal(parser.parseDynamicPolicySegmentsDraft("{").error, "dynamic_policy_invalid_json");
  assert.equal(parser.parseDynamicPolicySegmentsDraft("{}").error, "segments_required");
  assert.equal(parser.parseDynamicPolicySegmentsDraft("[]").error, "segments_required");
  assert.equal(parser.parseDynamicPolicySegmentsDraft('[{"segment_key":""}]').error, "segment_key_required");
});

test("parseRuntimeFlagsDraft accepts plain and wrapped boolean maps", async () => {
  const parser = await loadParserModule();
  const plain = parser.parseRuntimeFlagsDraft('{"FLAG_A":true,"FLAG_B":false}');
  assert.equal(plain.ok, true);
  assert.deepEqual(plain.flags, { FLAG_A: true, FLAG_B: false });

  const wrapped = parser.parseRuntimeFlagsDraft(
    '{"source_mode":"db_override","source_json":{"release":"v1"},"flags":{"FLAG_C":true}}'
  );
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.source_mode, "db_override");
  assert.deepEqual(wrapped.source_json, { release: "v1" });
  assert.deepEqual(wrapped.flags, { FLAG_C: true });
});

test("parseRuntimeFlagsDraft rejects invalid maps", async () => {
  const parser = await loadParserModule();
  assert.equal(parser.parseRuntimeFlagsDraft("{").error, "runtime_flags_invalid_json");
  assert.equal(parser.parseRuntimeFlagsDraft('{"source_mode":"bad_mode","FLAG_A":true}').error, "runtime_flags_source_mode_invalid");
  assert.equal(parser.parseRuntimeFlagsDraft('{"FLAG_A":"yes"}').error, "runtime_flags_boolean_required");
});

test("parseBotReconcileDraft validates required state key", async () => {
  const parser = await loadParserModule();
  const ok = parser.parseBotReconcileDraft('{"state_key":"runtime_bot","reason":"manual","force_stop":true}');
  assert.equal(ok.ok, true);
  assert.equal(ok.state_key, "runtime_bot");
  assert.equal(ok.reason, "manual");
  assert.equal(ok.force_stop, true);

  assert.equal(parser.parseBotReconcileDraft("{").error, "runtime_bot_invalid_json");
  assert.equal(parser.parseBotReconcileDraft("{}").error, "state_key_required");
});
