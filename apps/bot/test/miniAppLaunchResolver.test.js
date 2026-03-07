const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNavigationFromCommand, resolveLaunchUrlBundle } = require("../src/utils/miniAppLaunchResolver");

test("buildNavigationFromCommand applies overrides on top of resolved command navigation", () => {
  const navigation = buildNavigationFromCommand(
    "wallet",
    (commandKey) =>
      commandKey === "wallet"
        ? {
            route_key: "exchange",
            panel_key: "wallet",
            focus_key: "connect"
          }
        : null,
    { focusKey: "submit_tx" }
  );

  assert.deepEqual(navigation, {
    routeKey: "exchange",
    panelKey: "wallet",
    focusKey: "submit_tx"
  });
});

test("resolveLaunchUrlBundle resolves keyed launch urls with one base url lookup", async () => {
  let baseResolveCount = 0;
  const bundle = await resolveLaunchUrlBundle({
    entries: [
      { key: "profileUrl", commandKey: "profile" },
      { key: "walletUrl", commandKey: "wallet", overrides: { focusKey: "submit_tx" } },
      { key: "unknownUrl", commandKey: "unknown" }
    ],
    resolveNavigation: (commandKey) => {
      if (commandKey === "profile") {
        return { route_key: "hub", panel_key: "profile", focus_key: "identity" };
      }
      if (commandKey === "wallet") {
        return { route_key: "exchange", panel_key: "wallet", focus_key: "connect" };
      }
      return null;
    },
    resolveBaseUrl: async () => {
      baseResolveCount += 1;
      return "https://example.com/app";
    },
    buildSignedUrl: (baseUrl, navigation) =>
      `${baseUrl}?route_key=${navigation.routeKey}&panel_key=${navigation.panelKey}&focus_key=${navigation.focusKey}`
  });

  assert.equal(baseResolveCount, 1);
  assert.deepEqual(bundle, {
    profileUrl: "https://example.com/app?route_key=hub&panel_key=profile&focus_key=identity",
    walletUrl: "https://example.com/app?route_key=exchange&panel_key=wallet&focus_key=submit_tx",
    unknownUrl: ""
  });
});

test("resolveLaunchUrlBundle skips base url lookup when bundle is empty", async () => {
  let baseResolveCount = 0;
  const bundle = await resolveLaunchUrlBundle({
    entries: [],
    resolveNavigation: () => null,
    resolveBaseUrl: async () => {
      baseResolveCount += 1;
      return "https://example.com/app";
    },
    buildSignedUrl: () => ""
  });

  assert.equal(baseResolveCount, 0);
  assert.deepEqual(bundle, {});
});
