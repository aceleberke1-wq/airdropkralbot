function toCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toMessage(value, fallback = "request_failed") {
  const text = String(value || "").trim();
  return text || fallback;
}

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function readResponsePayload(source) {
  const row = asRecord(source);
  if (typeof row.success === "boolean") {
    return row;
  }
  const nested = asRecord(row.data);
  if (typeof nested.success === "boolean") {
    return nested;
  }
  return null;
}

const NON_RETRIABLE_PLAYER_CODES = new Set([
  "idempotency_conflict",
  "invalid_action_request_id",
  "tx_hash_required",
  "request_id_required",
  "offer_id_required",
  "mission_key_required",
  "session_ref_required",
  "action_seq_required",
  "input_action_required",
  "user_not_started",
  "admin_required",
  "validation_error",
  "invalid_request",
  "invalid_request_id",
  "invalid_session_ref",
  "invalid_tx_hash",
  "wallet_feature_disabled",
  "wallet_tables_missing",
  "wallet_challenge_not_found",
  "wallet_challenge_not_pending",
  "wallet_challenge_expired",
  "wallet_challenge_mismatch",
  "wallet_signature_invalid",
  "wallet_sanction_blocked",
  "wallet_input_missing",
  "wallet_verify_input_missing",
  "market_cap_gate_closed",
  "tier_locked",
  "payout_not_eligible",
  "kyc_required",
  "kyc_blocked",
  "kyc_unavailable",
  "freeze_mode",
  "pass_key_invalid",
  "item_key_invalid",
  "pass_product_not_found",
  "cosmetic_item_not_found",
  "pass_currency_mismatch",
  "cosmetic_currency_mismatch",
  "insufficient_balance",
  "monetization_feature_disabled",
  "monetization_tables_missing"
]);

export function classifyPlayerAuthErrorCode(codeRaw) {
  const code = toCode(codeRaw);
  if (!code) return "";
  if (
    [
      "expired",
      "bad_sig",
      "skew",
      "missing",
      "missing_fields",
      "invalid_signature",
      "webapp_secret_missing"
    ].includes(code)
  ) {
    return code;
  }
  return "";
}

export function isNonRetriablePlayerErrorCode(codeRaw) {
  const code = toCode(codeRaw);
  if (!code) return false;
  if (classifyPlayerAuthErrorCode(code)) {
    return true;
  }
  return NON_RETRIABLE_PLAYER_CODES.has(code);
}

export function isRetriableTransportError(err) {
  const row = asRecord(err);
  const name = toCode(row.name);
  const message = toCode(row.message);
  if (name === "aborterror") {
    return true;
  }
  return message.includes("networkerror") || message.includes("failed to fetch") || message.includes("timed out");
}

export function normalizePlayerMutationFailure(input, fallbackCode = "request_failed") {
  const row = asRecord(input);
  const payload = readResponsePayload(input);
  const status = Number(row.status || row.statusCode || row.code || 0) || 0;
  const code =
    toCode(payload?.error) ||
    toCode(payload?.message) ||
    toCode(row.error) ||
    toCode(row.code) ||
    toCode(row.message) ||
    toCode(fallbackCode);
  const message =
    toMessage(payload?.message, "") ||
    toMessage(payload?.error, "") ||
    toMessage(row.message, "") ||
    toMessage(row.error, "") ||
    toMessage(code, fallbackCode);

  return {
    code,
    status,
    message,
    payload: payload || null,
    transport: isRetriableTransportError(input),
    raw: input
  };
}

export function shouldRetryPlayerMutationFailure(errorLike, attempt = 1, maxAttempts = 3) {
  const tryNo = Math.max(1, Number(attempt || 1));
  const total = Math.max(1, Number(maxAttempts || 3));
  if (tryNo >= total) {
    return false;
  }
  const normalized = normalizePlayerMutationFailure(errorLike);
  if (isNonRetriablePlayerErrorCode(normalized.code)) {
    return false;
  }
  if (normalized.status === 401 || normalized.status === 403 || normalized.status === 404 || normalized.status === 409) {
    return false;
  }
  if (normalized.status === 429 || normalized.status >= 500) {
    return true;
  }
  return Boolean(normalized.transport);
}

export function resolveRetryBackoffMs(attempt = 1, options = {}) {
  const baseDelayMs = Math.max(40, Number(options.baseDelayMs == null ? 220 : options.baseDelayMs));
  const jitterMs = Math.max(0, Number(options.jitterMs == null ? 120 : options.jitterMs));
  const maxDelayMs = Math.max(baseDelayMs, Number(options.maxDelayMs == null ? 1600 : options.maxDelayMs));
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
  const exp = Math.max(0, Number(attempt || 1) - 1);
  const base = Math.min(maxDelayMs, Math.round(baseDelayMs * Math.pow(2, exp)));
  const jitter = Math.round(Math.min(jitterMs, maxDelayMs - base) * Number(randomFn()));
  return Math.min(maxDelayMs, base + Math.max(0, jitter));
}

async function waitMs(delayMs, sleepFn) {
  const runner =
    typeof sleepFn === "function"
      ? sleepFn
      : (ms) =>
          new Promise((resolve) => {
            setTimeout(resolve, ms);
          });
  await runner(Math.max(0, Number(delayMs || 0)));
}

export async function runMutationWithBackoff(runner, options = {}) {
  const execute = typeof runner === "function" ? runner : null;
  if (!execute) {
    return {
      ok: false,
      attempts: 0,
      payload: null,
      error: normalizePlayerMutationFailure({ message: "runner_required" }, "runner_required")
    };
  }

  const maxAttempts = Math.max(1, Number(options.maxAttempts || 3));
  const sleepFn = typeof options.sleepFn === "function" ? options.sleepFn : undefined;
  const onRetry = typeof options.onRetry === "function" ? options.onRetry : undefined;
  let lastPayload = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const payload = await execute(attempt);
      lastPayload = payload || null;
      if (payload && typeof payload.success === "boolean" && !payload.success) {
        const normalized = normalizePlayerMutationFailure(payload);
        lastError = normalized;
        if (!shouldRetryPlayerMutationFailure(normalized, attempt, maxAttempts)) {
          return {
            ok: false,
            attempts: attempt,
            payload: payload || null,
            error: normalized
          };
        }
        const delayMs = resolveRetryBackoffMs(attempt, options);
        onRetry?.({ attempt, delayMs, error: normalized });
        await waitMs(delayMs, sleepFn);
        continue;
      }
      return {
        ok: true,
        attempts: attempt,
        payload: payload || null,
        error: null
      };
    } catch (err) {
      const normalized = normalizePlayerMutationFailure(err);
      lastError = normalized;
      lastPayload = normalized.payload || null;
      if (!shouldRetryPlayerMutationFailure(normalized, attempt, maxAttempts)) {
        return {
          ok: false,
          attempts: attempt,
          payload: normalized.payload || null,
          error: normalized
        };
      }
      const delayMs = resolveRetryBackoffMs(attempt, options);
      onRetry?.({ attempt, delayMs, error: normalized });
      await waitMs(delayMs, sleepFn);
    }
  }

  return {
    ok: false,
    attempts: maxAttempts,
    payload: lastPayload,
    error: lastError || normalizePlayerMutationFailure({ message: "mutation_failed" })
  };
}
