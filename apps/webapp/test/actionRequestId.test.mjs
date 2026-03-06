import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = pathToFileURL(
  path.join(process.cwd(), "apps", "webapp", "src", "core", "shared", "actionRequestId.js")
).href;

test("normalizeActionRequestId accepts valid ids and rejects invalid ones", async () => {
  const helper = await import(target);
  assert.equal(helper.normalizeActionRequestId(" req_ok_12345 "), "req_ok_12345");
  assert.equal(helper.normalizeActionRequestId("bad id"), "");
  assert.equal(helper.normalizeActionRequestId("x"), "");
});

test("createActionRequestId keeps safe prefix and valid format", async () => {
  const helper = await import(target);
  const generated = helper.createActionRequestId("pvp start");
  assert.match(generated, /^[a-zA-Z0-9:_-]{6,120}$/);
  assert.equal(generated.startsWith("pvp_start_"), true);
});

test("resolveActionRequestId prefers explicit then pending then generated", async () => {
  const helper = await import(target);
  assert.equal(helper.resolveActionRequestId("explicit_12345", "pending_54321", "x"), "explicit_12345");
  assert.equal(helper.resolveActionRequestId("bad id", "pending_54321", "x"), "pending_54321");
  const generated = helper.resolveActionRequestId("", "", "league");
  assert.match(generated, /^[a-zA-Z0-9:_-]{6,120}$/);
  assert.equal(generated.startsWith("league_"), true);
});
