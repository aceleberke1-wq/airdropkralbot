"use strict";

function buildNavigationFromCommand(commandKey, resolveNavigation, overrides = {}) {
  if (typeof resolveNavigation !== "function") {
    return null;
  }
  const navigation = resolveNavigation(commandKey);
  if (!navigation) {
    return null;
  }
  return {
    routeKey: overrides.routeKey || navigation.route_key,
    panelKey: overrides.panelKey || navigation.panel_key || "",
    focusKey: overrides.focusKey || navigation.focus_key || ""
  };
}

async function resolveLaunchUrlBundle({
  entries = [],
  resolveNavigation,
  resolveBaseUrl,
  buildSignedUrl
} = {}) {
  const safeEntries = Array.isArray(entries)
    ? entries.filter((entry) => entry && String(entry.key || entry.commandKey || "").trim())
    : [];
  if (!safeEntries.length) {
    return {};
  }
  if (typeof resolveNavigation !== "function" || typeof resolveBaseUrl !== "function" || typeof buildSignedUrl !== "function") {
    throw new Error("resolveLaunchUrlBundle requires resolveNavigation, resolveBaseUrl and buildSignedUrl");
  }

  const baseUrl = await resolveBaseUrl();
  return Object.fromEntries(
    safeEntries.map((entry) => {
      const bundleKey = String(entry.key || entry.commandKey || "").trim();
      const navigation = buildNavigationFromCommand(entry.commandKey, resolveNavigation, entry.overrides);
      if (!bundleKey) {
        return [];
      }
      if (!navigation) {
        return [bundleKey, ""];
      }
      return [bundleKey, buildSignedUrl(baseUrl, navigation) || ""];
    })
  );
}

module.exports = {
  buildNavigationFromCommand,
  resolveLaunchUrlBundle
};
