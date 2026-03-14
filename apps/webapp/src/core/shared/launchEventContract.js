import { normalizeAnalyticsKey } from "./telemetryContract.js";

export const LAUNCH_EVENT_SCOPE = Object.freeze({
  COMMAND: "command",
  SURFACE: "surface",
  ALERT: "alert",
  CALLBACK: "callback",
  WEBAPP_ACTION: "webapp_action",
  INTERNAL: "internal"
});

function normalizeLaunchEventSegment(value, fallback = "", maxLen = 48) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/[:.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(1, Number(maxLen) || 48));
  if (!normalized) {
    return String(fallback || "");
  }
  return normalized;
}

export function normalizeLaunchEventKey(value, fallback = "") {
  return normalizeAnalyticsKey(value, fallback, 120);
}

export function buildLaunchEventKey(scope, key, verb = "open") {
  const normalizedScope = normalizeLaunchEventSegment(scope, LAUNCH_EVENT_SCOPE.SURFACE, 24);
  const normalizedKey = normalizeLaunchEventSegment(key, "default", 64);
  const normalizedVerb = normalizeLaunchEventSegment(verb, "open", 24);
  return normalizeLaunchEventKey(`launch.${normalizedScope}.${normalizedKey}.${normalizedVerb}`, "");
}

export function resolveLaunchEventKey(input = {}) {
  if (typeof input === "string") {
    return buildLaunchEventKey(LAUNCH_EVENT_SCOPE.INTERNAL, input, "open");
  }
  const explicit = normalizeLaunchEventKey(input.launchEventKey || input.launch_event_key || "", "");
  if (explicit) {
    return explicit;
  }

  const scope = normalizeLaunchEventSegment(
    input.scope || input.source || input.source_type || LAUNCH_EVENT_SCOPE.INTERNAL,
    LAUNCH_EVENT_SCOPE.INTERNAL,
    24
  );
  const key = normalizeLaunchEventSegment(
    input.key || input.commandKey || input.command_key || input.surfaceKey || input.surface_key || input.actionKey || input.action_key || "",
    "",
    64
  );
  if (!key) {
    return "";
  }
  return buildLaunchEventKey(scope, key, input.verb || "open");
}

export function resolveCommandLaunchEventKey(commandKey, verb = "open") {
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.COMMAND,
    commandKey,
    verb
  });
}

export function resolveSurfaceLaunchEventKey(surfaceKey, verb = "open") {
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.SURFACE,
    surfaceKey,
    verb
  });
}

export function resolveAlertLaunchEventKey(alertKey, slotKey = "", verb = "open") {
  const compositeKey = slotKey ? `${alertKey}_${slotKey}` : alertKey;
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.ALERT,
    key: compositeKey,
    verb
  });
}

export function resolveCallbackLaunchEventKey(actionKey, verb = "open") {
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.CALLBACK,
    actionKey,
    verb
  });
}

export function resolveWebAppActionLaunchEventKey(actionKey, verb = "open") {
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.WEBAPP_ACTION,
    actionKey,
    verb
  });
}

export function resolveInternalLaunchEventKey(key, verb = "open") {
  return resolveLaunchEventKey({
    scope: LAUNCH_EVENT_SCOPE.INTERNAL,
    key,
    verb
  });
}
