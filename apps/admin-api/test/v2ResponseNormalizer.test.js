"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeV2Payload, normalizeV2ErrorCode } = require("../src/routes/webapp/v2/shared/v2ResponseNormalizer");

test("normalizeV2ErrorCode maps known error keys and keeps unknown keys", () => {
  const map = { duplicate_or_locked_request: "idempotency_conflict" };
  assert.equal(normalizeV2ErrorCode("duplicate_or_locked_request", map), "idempotency_conflict");
  assert.equal(normalizeV2ErrorCode("user_not_started", map), "user_not_started");
});

test("normalizeV2Payload appends api version and action request id", () => {
  const payload = { success: true, data: { value: 1 } };
  const out = normalizeV2Payload(payload, { actionRequestId: "req_123456" });
  assert.equal(out.data.api_version, "v2");
  assert.equal(out.data.action_request_id, "req_123456");
  assert.equal(out.data.value, 1);
});

test("normalizeV2Payload normalizes error code for failed payload", () => {
  const payload = {
    success: false,
    error: "duplicate_or_locked_request",
    data: {}
  };
  const out = normalizeV2Payload(payload, {
    errorMap: { duplicate_or_locked_request: "idempotency_conflict" }
  });
  assert.equal(out.error, "idempotency_conflict");
  assert.equal(out.data.api_version, "v2");
});

test("normalizeV2Payload returns v2 envelope for non-object payload input", () => {
  const out = normalizeV2Payload(null, {});
  assert.equal(typeof out, "object");
  assert.equal(out.data.api_version, "v2");
});
