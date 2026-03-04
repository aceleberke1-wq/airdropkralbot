function normalizeSslMode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "require" || value === "prefer" || value === "verify-ca") {
    return "verify-full";
  }
  return value;
}

function normalizeDatabaseUrl(databaseUrl, options = {}) {
  const input = String(databaseUrl || "").trim();
  if (!input) {
    return "";
  }

  const sslEnabled = options.sslEnabled === true;
  const sslModeDefault = String(options.sslModeDefault || "verify-full").trim().toLowerCase() || "verify-full";

  let parsedUrl;
  try {
    parsedUrl = new URL(input);
  } catch {
    return input;
  }

  const currentSslModeRaw = parsedUrl.searchParams.get("sslmode");
  const currentSslMode = normalizeSslMode(currentSslModeRaw);
  if (currentSslMode && currentSslMode !== currentSslModeRaw) {
    parsedUrl.searchParams.set("sslmode", currentSslMode);
  }

  if (sslEnabled && !currentSslMode) {
    parsedUrl.searchParams.set("sslmode", sslModeDefault);
  }

  return parsedUrl.toString();
}

function buildPgPoolConfig(options = {}) {
  const connectionString = normalizeDatabaseUrl(options.databaseUrl, {
    sslEnabled: options.sslEnabled === true,
    sslModeDefault: options.sslModeDefault || "verify-full"
  });
  return {
    connectionString,
    ssl: options.sslEnabled ? { rejectUnauthorized: options.rejectUnauthorized === true } : undefined
  };
}

module.exports = {
  normalizeSslMode,
  normalizeDatabaseUrl,
  buildPgPoolConfig
};

