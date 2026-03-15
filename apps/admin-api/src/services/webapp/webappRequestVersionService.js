"use strict";

function sanitizeWebappVersion(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
}

function buildCanonicalVersionedWebappPath(rawUrl = "", version = "") {
  const safeVersion = sanitizeWebappVersion(version);
  if (!safeVersion) {
    return String(rawUrl || "").trim() || "/webapp";
  }

  const fallbackPath = String(rawUrl || "").trim() || "/webapp";
  const url = new URL(fallbackPath, "https://webapp.local");
  url.searchParams.set("v", safeVersion);
  return `${url.pathname}${url.search}`;
}

module.exports = {
  buildCanonicalVersionedWebappPath
};
