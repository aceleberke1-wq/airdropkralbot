import test from "node:test";
import assert from "node:assert/strict";

import { deriveBootstrapUiState } from "../src/react/redux/slices/bootstrapUi.js";

test("deriveUiFromBootstrap keeps player launch from reviving persisted admin workspace", () => {
  const result = deriveBootstrapUiState(
    {
      ui_shell: {
        default_tab: "home",
        tabs: ["home", "pvp", "tasks", "vault"]
      },
      ui_prefs: {
        prefs_json: {
          workspace: "admin",
          advanced_view: true,
          last_tab: "vault"
        }
      },
      launch_context: {
        workspace: "player",
        tab: "vault"
      },
      ux: {
        language: "tr",
        advanced_enabled: true
      }
    },
    {
      tab: "home",
      workspace: "player",
      lang: "tr",
      advanced: false,
      onboardingVisible: true
    }
  );

  assert.equal(result.workspace, "player");
  assert.equal(result.advanced, false);
  assert.equal(result.tab, "vault");
});

test("deriveUiFromBootstrap honors explicit admin launch workspace", () => {
  const result = deriveBootstrapUiState(
    {
      ui_shell: {
        default_tab: "home",
        tabs: ["home", "pvp", "tasks", "vault"]
      },
      ui_prefs: {
        prefs_json: {
          workspace: "player",
          advanced_view: true
        }
      },
      launch_context: {
        workspace: "admin",
        tab: "home"
      },
      ux: {
        language: "tr",
        advanced_enabled: true
      }
    },
    {
      tab: "home",
      workspace: "player",
      lang: "tr",
      advanced: false,
      onboardingVisible: true
    }
  );

  assert.equal(result.workspace, "admin");
  assert.equal(result.advanced, true);
});

test("deriveUiFromBootstrap falls back to player when launch is not explicitly admin", () => {
  const result = deriveBootstrapUiState(
    {
      ui_shell: {
        default_tab: "home",
        tabs: ["home", "pvp", "tasks", "vault"]
      },
      ui_prefs: {
        prefs_json: {
          workspace: "admin",
          advanced_view: true,
          last_tab: "pvp"
        }
      },
      ux: {
        language: "tr",
        advanced_enabled: true
      }
    },
    {
      tab: "home",
      workspace: "admin",
      lang: "tr",
      advanced: true,
      onboardingVisible: true
    }
  );

  assert.equal(result.workspace, "player");
  assert.equal(result.tab, "pvp");
});
