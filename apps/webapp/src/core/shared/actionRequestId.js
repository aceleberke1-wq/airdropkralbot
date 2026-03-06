const ACTION_REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{6,120}$/;

function normalizePrefix(prefix, fallback = "webapp") {
  const clean = String(prefix || fallback)
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return clean || fallback;
}

export function normalizeActionRequestId(value) {
  const clean = String(value || "")
    .trim()
    .slice(0, 120);
  if (!ACTION_REQUEST_ID_PATTERN.test(clean)) {
    return "";
  }
  return clean;
}

export function createActionRequestId(prefix = "webapp") {
  const safePrefix = normalizePrefix(prefix, "webapp");
  const seed = `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return seed.slice(0, 120);
}

export function resolveActionRequestId(explicitActionRequestId, pendingActionRequestId = "", prefix = "webapp") {
  const explicit = normalizeActionRequestId(explicitActionRequestId);
  if (explicit) {
    return explicit;
  }
  const pending = normalizeActionRequestId(pendingActionRequestId);
  if (pending) {
    return pending;
  }
  return createActionRequestId(prefix);
}
