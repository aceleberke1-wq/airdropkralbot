import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPolicyModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "mutationPolicy.js")
  ).href;
  return import(target);
}

test("normalizePlayerMutationFailure extracts code from RTK-style reject payload", async () => {
  const policy = await loadPolicyModule();
  const normalized = policy.normalizePlayerMutationFailure({
    status: 409,
    data: {
      success: false,
      error: "idempotency_conflict"
    }
  });
  assert.equal(normalized.code, "idempotency_conflict");
  assert.equal(normalized.status, 409);
  assert.equal(normalized.payload.success, false);
});

test("shouldRetryPlayerMutationFailure retries network and 5xx but blocks auth/idempotency", async () => {
  const policy = await loadPolicyModule();
  assert.equal(
    policy.shouldRetryPlayerMutationFailure({ name: "AbortError", message: "timeout" }, 1, 3),
    true
  );
  assert.equal(
    policy.shouldRetryPlayerMutationFailure({ status: 503, data: { success: false, error: "request_failed" } }, 1, 3),
    true
  );
  assert.equal(
    policy.shouldRetryPlayerMutationFailure({ status: 401, data: { success: false, error: "bad_sig" } }, 1, 3),
    false
  );
  assert.equal(
    policy.shouldRetryPlayerMutationFailure(
      { status: 409, data: { success: false, error: "idempotency_conflict" } },
      1,
      3
    ),
    false
  );
});

test("resolveRetryBackoffMs is bounded and monotonic with attempts", async () => {
  const policy = await loadPolicyModule();
  const first = policy.resolveRetryBackoffMs(1, { baseDelayMs: 120, jitterMs: 0, maxDelayMs: 1000 });
  const second = policy.resolveRetryBackoffMs(2, { baseDelayMs: 120, jitterMs: 0, maxDelayMs: 1000 });
  const third = policy.resolveRetryBackoffMs(3, { baseDelayMs: 120, jitterMs: 0, maxDelayMs: 1000 });
  assert.equal(first, 120);
  assert.equal(second, 240);
  assert.equal(third, 480);
});

test("runMutationWithBackoff retries retriable failure and succeeds", async () => {
  const policy = await loadPolicyModule();
  let callCount = 0;
  const retried = [];
  const result = await policy.runMutationWithBackoff(
    async () => {
      callCount += 1;
      if (callCount < 3) {
        throw { status: 503, data: { success: false, error: "temporary_unavailable" } };
      }
      return { success: true, data: { ok: true } };
    },
    {
      maxAttempts: 3,
      baseDelayMs: 10,
      jitterMs: 0,
      maxDelayMs: 20,
      sleepFn: async () => {},
      onRetry: (row) => retried.push(row.attempt)
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(callCount, 3);
  assert.deepEqual(retried, [1, 2]);
});

test("runMutationWithBackoff stops on non-retriable code", async () => {
  const policy = await loadPolicyModule();
  let callCount = 0;
  const result = await policy.runMutationWithBackoff(
    async () => {
      callCount += 1;
      return { success: false, error: "invalid_action_request_id" };
    },
    {
      maxAttempts: 4,
      sleepFn: async () => {}
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.equal(callCount, 1);
  assert.equal(result.error.code, "invalid_action_request_id");
});

test("non-retriable policy covers wallet payout and monetization business errors", async () => {
  const policy = await loadPolicyModule();

  assert.equal(policy.isNonRetriablePlayerErrorCode("wallet_challenge_expired"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("wallet_sanction_blocked"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("market_cap_gate_closed"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("tier_locked"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("pass_currency_mismatch"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("insufficient_balance"), true);
  assert.equal(policy.isNonRetriablePlayerErrorCode("temporary_unavailable"), false);
});

test("shouldRetryPlayerMutationFailure blocks non-retriable 5xx business errors", async () => {
  const policy = await loadPolicyModule();
  assert.equal(
    policy.shouldRetryPlayerMutationFailure(
      { status: 503, data: { success: false, error: "wallet_tables_missing" } },
      1,
      3
    ),
    false
  );
  assert.equal(
    policy.shouldRetryPlayerMutationFailure(
      { status: 503, data: { success: false, error: "monetization_tables_missing" } },
      1,
      3
    ),
    false
  );
});
