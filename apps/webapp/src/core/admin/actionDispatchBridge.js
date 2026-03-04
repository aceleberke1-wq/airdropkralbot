export function normalizeActionRequestId(value) {
  const clean = String(value || "")
    .trim()
    .slice(0, 120);
  if (!/^[a-zA-Z0-9:_-]{6,120}$/.test(clean)) {
    return "";
  }
  return clean;
}

export function createActionRequestId(prefix = "webapp_admin") {
  const cleanPrefix = String(prefix || "webapp_admin")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const seed = `${cleanPrefix || "webapp_admin"}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return seed.slice(0, 120);
}

export function resolveActionRequestId(explicitActionRequestId, pendingActionRequestId, prefix = "webapp_admin") {
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

export function isRetriableAdminFetchError(err) {
  const name = String(err?.name || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  if (name === "aborterror") {
    return true;
  }
  return message.includes("networkerror") || message.includes("failed to fetch") || message.includes("timed out");
}

export function installAdminActionDispatchBridge(target = window) {
  if (!target || typeof target !== "object") {
    return;
  }
  target.__AKR_ADMIN_ACTION__ = {
    normalizeActionRequestId,
    createActionRequestId,
    resolveActionRequestId,
    isRetriableAdminFetchError
  };
}
