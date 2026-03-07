"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const contracts = require("../../../packages/shared/src/contracts");
const { registerWebappV2AdminLiveOpsRoutes } = require("../src/routes/webapp/v2/adminLiveOpsRoutes");

test("v2 admin live ops campaign routes read, save and dispatch canonical payloads", async () => {
  const app = Fastify();
  const serviceCalls = [];
  registerWebappV2AdminLiveOpsRoutes(app, {
    pool: {
      async connect() {
        return {
          release() {}
        };
      }
    },
    verifyWebAppAuth(uid) {
      return { ok: true, uid: String(uid || "7001") };
    },
    requireWebAppAdmin: async () => ({ user_id: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "2", sig: "next" }),
    contracts,
    service: {
      async getCampaignSnapshot() {
        serviceCalls.push("get");
        return {
          api_version: "v2",
          config_key: "live_ops_chat_campaign_v1",
          version: 3,
          updated_at: "2026-03-08T10:00:00.000Z",
          updated_by: 7001,
          campaign: {
            api_version: "v2",
            campaign_key: "wallet_reconnect",
            enabled: false,
            status: "draft",
            targeting: {
              segment_key: "wallet_unlinked",
              inactive_hours: 72,
              max_age_days: 30,
              active_within_days: 14,
              locale_filter: "",
              max_recipients: 40,
              dedupe_hours: 72
            },
            copy: {
              title: { tr: "Wallet hazir", en: "Wallet ready" },
              body: { tr: "Wallet bagla.", en: "Link wallet." },
              note: { tr: "Simdi ac.", en: "Open now." }
            },
            surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
          },
          latest_dispatch: {
            event_type: "live_ops_campaign_sent",
            sent_total: 0,
            sent_72h: 0,
            last_sent_at: null,
            last_segment_key: "",
            last_dispatch_ref: ""
          }
        };
      },
      async saveCampaignConfig(input) {
        serviceCalls.push({ save: input });
        return {
          api_version: "v2",
          config_key: "live_ops_chat_campaign_v1",
          version: 4,
          updated_at: "2026-03-08T10:10:00.000Z",
          updated_by: 7001,
          campaign: input.campaign,
          latest_dispatch: {
            event_type: "live_ops_campaign_sent",
            sent_total: 0,
            sent_72h: 0,
            last_sent_at: null,
            last_segment_key: "",
            last_dispatch_ref: ""
          }
        };
      },
      async dispatchCampaign(input) {
        serviceCalls.push({ dispatch: input });
        return {
          ok: true,
          data: {
            api_version: "v2",
            campaign_key: "wallet_reconnect",
            version: 4,
            dry_run: true,
            segment_key: "wallet_unlinked",
            attempted: 2,
            sent: 2,
            recorded: 0,
            skipped_disabled: 0,
            dispatch_ref: "wallet_reconnect_ref",
            sample_users: [{ user_id: 41, locale: "en" }],
            generated_at: "2026-03-08T10:15:00.000Z"
          }
        };
      }
    }
  });

  const getRes = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/live-ops/campaign?uid=7001&ts=1&sig=sig"
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.campaign.campaign_key, "wallet_reconnect");

  const saveRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      reason: "test_save",
      campaign: {
        api_version: "v2",
        campaign_key: "wallet_reconnect",
        enabled: true,
        status: "ready",
        targeting: {
          segment_key: "wallet_unlinked",
          inactive_hours: 72,
          max_age_days: 30,
          active_within_days: 14,
          locale_filter: "",
          max_recipients: 40,
          dedupe_hours: 72
        },
        copy: {
          title: { tr: "Wallet hazir", en: "Wallet ready" },
          body: { tr: "Wallet bagla.", en: "Link wallet." },
          note: { tr: "Simdi ac.", en: "Open now." }
        },
        surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
      }
    }
  });
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.json().data.version, 4);

  const dispatchRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/dispatch",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      dry_run: true,
      campaign: {
        api_version: "v2",
        campaign_key: "wallet_reconnect",
        enabled: true,
        status: "ready",
        targeting: {
          segment_key: "wallet_unlinked",
          inactive_hours: 72,
          max_age_days: 30,
          active_within_days: 14,
          locale_filter: "",
          max_recipients: 40,
          dedupe_hours: 72
        },
        copy: {
          title: { tr: "Wallet hazir", en: "Wallet ready" },
          body: { tr: "Wallet bagla.", en: "Link wallet." },
          note: { tr: "Simdi ac.", en: "Open now." }
        },
        surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
      }
    }
  });
  assert.equal(dispatchRes.statusCode, 200);
  assert.equal(dispatchRes.json().data.sent, 2);
  assert.equal(serviceCalls.length, 3);
  await app.close();
});

test("v2 admin live ops campaign dispatch returns conflict when service marks campaign not ready", async () => {
  const app = Fastify();
  registerWebappV2AdminLiveOpsRoutes(app, {
    pool: {
      async connect() {
        return {
          release() {}
        };
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: "7001" }),
    requireWebAppAdmin: async () => ({ user_id: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "2", sig: "next" }),
    contracts,
    service: {
      async dispatchCampaign() {
        return { ok: false, reason: "campaign_not_ready", campaign: { campaign_key: "wallet_reconnect" } };
      },
      async getCampaignSnapshot() {
        throw new Error("not_used");
      },
      async saveCampaignConfig() {
        throw new Error("not_used");
      }
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/dispatch",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      dry_run: false
    }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "campaign_not_ready");
  await app.close();
});
