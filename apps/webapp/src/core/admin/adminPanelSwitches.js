const PANEL_FLAG_KEYS = {
  queue: "WEBAPP_ADMIN_PANEL_QUEUE_ENABLED",
  dynamicPolicy: "WEBAPP_ADMIN_PANEL_DYNAMIC_POLICY_ENABLED",
  runtimeFlags: "WEBAPP_ADMIN_PANEL_RUNTIME_FLAGS_ENABLED",
  runtimeBot: "WEBAPP_ADMIN_PANEL_RUNTIME_BOT_ENABLED",
  runtimeMeta: "WEBAPP_ADMIN_PANEL_RUNTIME_META_ENABLED"
};

function toRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

export function extractBooleanFlags(value) {
  const root = toRecord(value);
  const nestedFlags = toRecord(root.flags);
  const candidate = Object.keys(nestedFlags).length > 0 ? nestedFlags : root;
  return Object.fromEntries(
    Object.entries(candidate).filter((entry) => typeof entry[1] === "boolean")
  );
}

function readFlag(flags, key, fallback = true) {
  if (!flags || typeof flags !== "object") {
    return fallback;
  }
  const raw = flags[key];
  return typeof raw === "boolean" ? raw : fallback;
}

export function resolveAdminPanelVisibility(options = {}) {
  const runtimeFlags = extractBooleanFlags(options.runtimeFlags);
  const fallbackFlags = extractBooleanFlags(options.fallbackFlags);
  const merged = {
    ...fallbackFlags,
    ...runtimeFlags
  };

  return {
    queue: readFlag(merged, PANEL_FLAG_KEYS.queue, true),
    dynamicPolicy: readFlag(merged, PANEL_FLAG_KEYS.dynamicPolicy, true),
    runtimeFlags: readFlag(merged, PANEL_FLAG_KEYS.runtimeFlags, true),
    runtimeBot: readFlag(merged, PANEL_FLAG_KEYS.runtimeBot, true),
    runtimeMeta: readFlag(merged, PANEL_FLAG_KEYS.runtimeMeta, true)
  };
}

export { PANEL_FLAG_KEYS };
