import {
  createApi,
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError
} from "@reduxjs/toolkit/query/react";
import { normalizeLang, type Lang } from "../../i18n";
import type {
  AdminApiResponse,
  AdminQueueActionRequest,
  BootstrapV2Payload,
  DynamicAutoPolicy,
  HomeFeed,
  LeagueOverview,
  MonetizationOverview,
  MonetizationPurchasePayload,
  PayoutStatusV2Payload,
  PlayerActionResponse,
  PvpMutationResponse,
  PvpSessionStateResponse,
  TokenActionResponse,
  TokenQueryResponse,
  UiEventBatchRequest,
  UiEventBatchResponse,
  UiPreferencesPatch,
  UiPreferencesResponse,
  VaultOverview,
  WalletSessionV2Payload,
  WebAppApiResponse,
  WebAppAuth
} from "../../types";
import {
  parseAdminDynamicAutoPolicyResponse,
  parseHomeFeedResponse,
  parseLeagueOverviewResponse,
  parseMonetizationOverviewResponse,
  parseMonetizationPurchaseResponse,
  parsePayoutStatusResponse,
  parsePlayerActionResponse,
  parsePvpLiveResponse,
  parsePvpMutationResponse,
  parsePvpSessionStateResponse,
  parseTokenActionResponse,
  parseTokenQueryResponse,
  parseUiPreferencesResponse,
  parseWalletSessionResponse,
  parseVaultOverviewResponse
} from "../../../core/contracts/v2Validators.js";
import { resolveActionRequestId } from "../../../core/shared/actionRequestId.js";
import { sessionActions } from "../slices/shellSlices";

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    search.set(key, String(value));
  });
  return search.toString();
}

function withAuthQuery(auth: WebAppAuth, extra: Record<string, unknown> = {}): string {
  return buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...extra
  });
}

function withAuthBody(auth: WebAppAuth, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...extra
  };
}

function resolveMutationActionRequestId(rawValue: unknown, prefix: string): string {
  return resolveActionRequestId(rawValue, "", prefix);
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "",
  credentials: "same-origin"
});

const baseQueryWithSession: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api: BaseQueryApi,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  const payload = (result as { data?: WebAppApiResponse | undefined })?.data;
  const session = payload?.session;
  if (session?.uid && session?.ts && session?.sig) {
    api.dispatch(
      sessionActions.mergeAuth({
        uid: String(session.uid),
        ts: String(session.ts),
        sig: String(session.sig)
      })
    );
  }
  return result;
};

export const webappApi = createApi({
  reducerPath: "webappApi",
  baseQuery: baseQueryWithSession,
  tagTypes: ["Bootstrap", "HomeFeed", "League", "Vault", "Monetization", "Prefs", "Telemetry", "Admin"],
  endpoints: (builder) => ({
    bootstrapV2: builder.query<BootstrapV2Payload, { auth: WebAppAuth; language?: Lang }>({
      query: ({ auth, language = "tr" }) => ({
        url: `/webapp/api/v2/bootstrap?${withAuthQuery(auth, {
          lang: normalizeLang(language),
          scope: "player",
          include_admin: "1"
        })}`
      }),
      providesTags: ["Bootstrap"]
    }),
    homeFeedV2: builder.query<WebAppApiResponse<HomeFeed>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/home/feed?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) => parseHomeFeedResponse(response) as WebAppApiResponse<HomeFeed>,
      providesTags: ["HomeFeed"]
    }),
    leagueOverviewV2: builder.query<WebAppApiResponse<LeagueOverview>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/pvp/league/overview?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) => parseLeagueOverviewResponse(response) as WebAppApiResponse<LeagueOverview>,
      providesTags: ["League"]
    }),
    pvpLeaderboardLiveV2: builder.query<WebAppApiResponse, { auth: WebAppAuth; limit?: number }>({
      query: ({ auth, limit = 25 }) => ({
        url: `/webapp/api/v2/pvp/leaderboard/live?${withAuthQuery(auth, {
          limit: Math.max(1, Math.min(100, Number(limit || 25)))
        })}`
      }),
      transformResponse: (response: unknown) => parsePvpLiveResponse(response) as WebAppApiResponse,
      providesTags: ["League"]
    }),
    pvpDiagnosticsLiveV2: builder.query<WebAppApiResponse, { auth: WebAppAuth; window?: "5m" | "15m" | "1h" | "24h" }>({
      query: ({ auth, window = "1h" }) => ({
        url: `/webapp/api/v2/pvp/diagnostics/live?${withAuthQuery(auth, {
          window
        })}`
      }),
      transformResponse: (response: unknown) => parsePvpLiveResponse(response) as WebAppApiResponse,
      providesTags: ["League"]
    }),
    pvpMatchTickV2: builder.query<WebAppApiResponse, { auth: WebAppAuth; session_ref?: string }>({
      query: ({ auth, session_ref }) => ({
        url: `/webapp/api/v2/pvp/match/tick?${withAuthQuery(auth, {
          session_ref: session_ref ? String(session_ref).trim() : undefined
        })}`
      }),
      transformResponse: (response: unknown) => parsePvpLiveResponse(response) as WebAppApiResponse,
      providesTags: ["League"]
    }),
    vaultOverviewV2: builder.query<WebAppApiResponse<VaultOverview>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/vault/overview?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) => parseVaultOverviewResponse(response) as WebAppApiResponse<VaultOverview>,
      providesTags: ["Vault"]
    }),
    monetizationOverviewV2: builder.query<WebAppApiResponse<MonetizationOverview>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/monetization/overview?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) =>
        parseMonetizationOverviewResponse(response) as WebAppApiResponse<MonetizationOverview>,
      providesTags: ["Monetization"]
    }),
    monetizationCatalogV2: builder.query<WebAppApiResponse, { auth: WebAppAuth; language?: Lang }>({
      query: ({ auth, language = "tr" }) => ({
        url: `/webapp/api/v2/monetization/catalog?${withAuthQuery(auth, {
          lang: normalizeLang(language)
        })}`
      }),
      providesTags: ["Monetization"]
    }),
    monetizationStatusV2: builder.query<WebAppApiResponse, { auth: WebAppAuth; language?: Lang }>({
      query: ({ auth, language = "tr" }) => ({
        url: `/webapp/api/v2/monetization/status?${withAuthQuery(auth, {
          lang: normalizeLang(language)
        })}`
      }),
      providesTags: ["Monetization"]
    }),
    monetizationPassPurchaseV2: builder.mutation<
      WebAppApiResponse<MonetizationPurchasePayload>,
      { auth: WebAppAuth; pass_key: string; payment_currency?: string; purchase_ref?: string }
    >({
      query: ({ auth, pass_key, payment_currency, purchase_ref }) => ({
        url: "/webapp/api/v2/monetization/pass/purchase",
        method: "POST",
        body: withAuthBody(auth, {
          pass_key: String(pass_key || "").trim(),
          payment_currency: payment_currency ? String(payment_currency).trim().toUpperCase() : undefined,
          purchase_ref: purchase_ref ? String(purchase_ref).trim() : undefined
        })
      }),
      transformResponse: (response: unknown) =>
        parseMonetizationPurchaseResponse(response) as WebAppApiResponse<MonetizationPurchasePayload>,
      invalidatesTags: ["Monetization", "Vault", "Bootstrap", "HomeFeed"]
    }),
    monetizationCosmeticPurchaseV2: builder.mutation<
      WebAppApiResponse<MonetizationPurchasePayload>,
      { auth: WebAppAuth; item_key: string; payment_currency?: string; purchase_ref?: string }
    >({
      query: ({ auth, item_key, payment_currency, purchase_ref }) => ({
        url: "/webapp/api/v2/monetization/cosmetic/purchase",
        method: "POST",
        body: withAuthBody(auth, {
          item_key: String(item_key || "").trim(),
          payment_currency: payment_currency ? String(payment_currency).trim().toUpperCase() : undefined,
          purchase_ref: purchase_ref ? String(purchase_ref).trim() : undefined
        })
      }),
      transformResponse: (response: unknown) =>
        parseMonetizationPurchaseResponse(response) as WebAppApiResponse<MonetizationPurchasePayload>,
      invalidatesTags: ["Monetization", "Vault", "Bootstrap", "HomeFeed"]
    }),
    adminBootstrapV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/bootstrap?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminUnifiedQueueV2: builder.query<AdminApiResponse, { auth: WebAppAuth; limit?: number }>({
      query: ({ auth, limit = 60 }) => ({
        url: `/webapp/api/v2/admin/queue/unified?${withAuthQuery(auth, {
          limit: Math.max(1, Math.min(200, Number(limit || 60)))
        })}`
      }),
      providesTags: ["Admin"]
    }),
    adminMetricsV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/metrics?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminLiveOpsCampaignV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/live-ops/campaign?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminLiveOpsCampaignUpsertV2: builder.mutation<
      AdminApiResponse,
      { auth: WebAppAuth; reason?: string; campaign: Record<string, unknown> }
    >({
      query: ({ auth, reason, campaign }) => ({
        url: "/webapp/api/v2/admin/live-ops/campaign",
        method: "POST",
        body: withAuthBody(auth, {
          reason: reason ? String(reason) : undefined,
          campaign: campaign && typeof campaign === "object" ? campaign : {}
        })
      }),
      invalidatesTags: ["Admin"]
    }),
    adminLiveOpsCampaignDispatchV2: builder.mutation<
      AdminApiResponse,
      { auth: WebAppAuth; dry_run?: boolean; max_recipients?: number; reason?: string; campaign?: Record<string, unknown> }
    >({
      query: ({ auth, dry_run, max_recipients, reason, campaign }) => ({
        url: "/webapp/api/v2/admin/live-ops/campaign/dispatch",
        method: "POST",
        body: withAuthBody(auth, {
          dry_run: dry_run !== false,
          max_recipients: Number.isFinite(Number(max_recipients)) ? Number(max_recipients) : undefined,
          reason: reason ? String(reason) : undefined,
          campaign: campaign && typeof campaign === "object" ? campaign : undefined
        })
      }),
      invalidatesTags: ["Admin"]
    }),
    adminOpsKpiLatestV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/ops/kpi/latest?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminOpsKpiRunV2: builder.mutation<
      AdminApiResponse,
      {
        auth: WebAppAuth;
        hours_short?: number;
        hours_long?: number;
        trend_days?: number;
        emit_slo?: boolean;
      }
    >({
      query: ({ auth, hours_short, hours_long, trend_days, emit_slo }) => ({
        url: "/webapp/api/v2/admin/ops/kpi/run",
        method: "POST",
        body: withAuthBody(auth, {
          hours_short: Number.isFinite(Number(hours_short)) ? Number(hours_short) : undefined,
          hours_long: Number.isFinite(Number(hours_long)) ? Number(hours_long) : undefined,
          trend_days: Number.isFinite(Number(trend_days)) ? Number(trend_days) : undefined,
          emit_slo: typeof emit_slo === "boolean" ? emit_slo : undefined
        })
      }),
      invalidatesTags: ["Admin"]
    }),
    adminAssetsStatusV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/assets/status?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminRuntimeFlagsV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/runtime/flags?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminRuntimeFlagsUpdateV2: builder.mutation<
      AdminApiResponse,
      {
        auth: WebAppAuth;
        source_mode?: "env_locked" | "db_override";
        source_json?: Record<string, unknown>;
        flags: Record<string, boolean>;
      }
    >({
      query: ({ auth, source_mode, source_json, flags }) => ({
        url: "/webapp/api/v2/admin/runtime/flags",
        method: "POST",
        body: withAuthBody(auth, {
          source_mode: source_mode || undefined,
          source_json: source_json && typeof source_json === "object" ? source_json : undefined,
          flags: flags && typeof flags === "object" ? flags : {}
        })
      }),
      invalidatesTags: ["Admin"]
    }),
    adminRuntimeBotV2: builder.query<AdminApiResponse, { auth: WebAppAuth; state_key?: string; limit?: number }>({
      query: ({ auth, state_key, limit }) => ({
        url: `/webapp/api/v2/admin/runtime/bot?${withAuthQuery(auth, {
          state_key: state_key ? String(state_key).trim() : undefined,
          limit: Number(limit || 0) > 0 ? Math.max(1, Math.min(100, Number(limit))) : undefined
        })}`
      }),
      providesTags: ["Admin"]
    }),
    adminRuntimeBotReconcileV2: builder.mutation<
      AdminApiResponse,
      { auth: WebAppAuth; state_key: string; reason?: string; force_stop?: boolean }
    >({
      query: ({ auth, state_key, reason, force_stop }) => ({
        url: "/webapp/api/v2/admin/runtime/bot/reconcile",
        method: "POST",
        body: withAuthBody(auth, {
          state_key: String(state_key || "").trim(),
          reason: reason ? String(reason) : undefined,
          force_stop: typeof force_stop === "boolean" ? force_stop : undefined
        })
      }),
      invalidatesTags: ["Admin"]
    }),
    adminDeployStatusV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/runtime/deploy/status?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminAssetsReloadV2: builder.mutation<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: "/webapp/api/v2/admin/assets/reload",
        method: "POST",
        body: withAuthBody(auth)
      }),
      invalidatesTags: ["Admin"]
    }),
    adminAuditPhaseStatusV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/runtime/audit/phase-status?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminAuditDataIntegrityV2: builder.query<AdminApiResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/admin/runtime/audit/data-integrity?${withAuthQuery(auth)}`
      }),
      providesTags: ["Admin"]
    }),
    adminQueueActionV2: builder.mutation<AdminApiResponse, { auth: WebAppAuth; payload: AdminQueueActionRequest }>({
      query: ({ auth, payload }) => {
        const actionRequestId = resolveMutationActionRequestId(payload?.action_request_id, "admin_queue");
        return {
          url: "/webapp/api/v2/admin/queue/action",
          method: "POST",
          body: withAuthBody(auth, {
            ...(payload as Record<string, unknown>),
            action_request_id: actionRequestId
          })
        };
      },
      invalidatesTags: ["Admin"]
    }),
    adminDynamicAutoPolicyV2: builder.query<
      WebAppApiResponse<DynamicAutoPolicy>,
      {
        auth: WebAppAuth;
        token_symbol?: string;
        risk_score?: number;
        velocity_per_hour?: number;
        usd_amount?: number;
        kyc_status?: string;
        gate_open?: boolean;
      }
    >({
      query: ({ auth, token_symbol, risk_score, velocity_per_hour, usd_amount, kyc_status, gate_open }) => ({
        url: `/webapp/api/v2/admin/token/auto-policy/dynamic?${withAuthQuery(auth, {
          token_symbol: token_symbol ? String(token_symbol).toUpperCase() : undefined,
          risk_score: Number.isFinite(Number(risk_score)) ? Number(risk_score) : undefined,
          velocity_per_hour: Number.isFinite(Number(velocity_per_hour)) ? Number(velocity_per_hour) : undefined,
          usd_amount: Number.isFinite(Number(usd_amount)) ? Number(usd_amount) : undefined,
          kyc_status: kyc_status ? String(kyc_status).toLowerCase() : undefined,
          gate_open: typeof gate_open === "boolean" ? (gate_open ? "1" : "0") : undefined
        })}`
      }),
      transformResponse: (response: unknown) =>
        parseAdminDynamicAutoPolicyResponse(response) as WebAppApiResponse<DynamicAutoPolicy>,
      providesTags: ["Admin"]
    }),
    adminDynamicAutoPolicyUpsertV2: builder.mutation<
      WebAppApiResponse<DynamicAutoPolicy>,
      {
        auth: WebAppAuth;
        token_symbol?: string;
        replace_missing?: boolean;
        reason?: string;
        note?: string;
        segments: Array<Record<string, unknown>>;
      }
    >({
      query: ({ auth, token_symbol, replace_missing, reason, note, segments }) => ({
        url: "/webapp/api/v2/admin/token/auto-policy/dynamic",
        method: "POST",
        body: withAuthBody(auth, {
          token_symbol: token_symbol ? String(token_symbol).toUpperCase() : undefined,
          replace_missing: replace_missing !== false,
          reason: reason ? String(reason) : undefined,
          note: note ? String(note) : undefined,
          segments: Array.isArray(segments) ? segments : []
        })
      }),
      transformResponse: (response: unknown) =>
        parseAdminDynamicAutoPolicyResponse(response) as WebAppApiResponse<DynamicAutoPolicy>,
      invalidatesTags: ["Admin"]
    }),
    actionAcceptV2: builder.mutation<
      PlayerActionResponse,
      { auth: WebAppAuth; offer_id: number; action_request_id?: string }
    >({
      query: ({ auth, offer_id, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "accept");
        return {
          url: "/webapp/api/v2/actions/accept",
          method: "POST",
          body: withAuthBody(auth, {
            offer_id: Math.max(1, Number(offer_id || 0)),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePlayerActionResponse(response) as PlayerActionResponse,
      invalidatesTags: ["Bootstrap", "HomeFeed"]
    }),
    actionCompleteV2: builder.mutation<
      PlayerActionResponse,
      { auth: WebAppAuth; attempt_id?: number; mode?: string; action_request_id?: string }
    >({
      query: ({ auth, attempt_id, mode, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "complete");
        return {
          url: "/webapp/api/v2/actions/complete",
          method: "POST",
          body: withAuthBody(auth, {
            attempt_id: Number(attempt_id || 0) > 0 ? Number(attempt_id) : undefined,
            mode: mode ? String(mode) : undefined,
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePlayerActionResponse(response) as PlayerActionResponse,
      invalidatesTags: ["Bootstrap", "HomeFeed"]
    }),
    actionRevealV2: builder.mutation<PlayerActionResponse, { auth: WebAppAuth; attempt_id?: number; action_request_id?: string }>({
      query: ({ auth, attempt_id, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "reveal");
        return {
          url: "/webapp/api/v2/actions/reveal",
          method: "POST",
          body: withAuthBody(auth, {
            attempt_id: Number(attempt_id || 0) > 0 ? Number(attempt_id) : undefined,
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePlayerActionResponse(response) as PlayerActionResponse,
      invalidatesTags: ["Bootstrap", "HomeFeed"]
    }),
    actionClaimMissionV2: builder.mutation<
      PlayerActionResponse,
      { auth: WebAppAuth; mission_key: string; action_request_id?: string }
    >({
      query: ({ auth, mission_key, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "mission");
        return {
          url: "/webapp/api/v2/actions/claim-mission",
          method: "POST",
          body: withAuthBody(auth, {
            mission_key: String(mission_key || "").trim(),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePlayerActionResponse(response) as PlayerActionResponse,
      invalidatesTags: ["Bootstrap", "HomeFeed"]
    }),
    tasksRerollV2: builder.mutation<PlayerActionResponse, { auth: WebAppAuth; action_request_id?: string }>({
      query: ({ auth, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "reroll");
        return {
          url: "/webapp/api/v2/tasks/reroll",
          method: "POST",
          body: withAuthBody(auth, {
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePlayerActionResponse(response) as PlayerActionResponse,
      invalidatesTags: ["Bootstrap", "HomeFeed"]
    }),
    pvpSessionStartV2: builder.mutation<
      PvpMutationResponse,
      { auth: WebAppAuth; action_request_id?: string; mode_suggested?: "safe" | "balanced" | "aggressive"; transport?: "poll" | "ws" }
    >({
      query: ({ auth, action_request_id, mode_suggested, transport }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "pvp_start");
        return {
          url: "/webapp/api/v2/pvp/session/start",
          method: "POST",
          body: withAuthBody(auth, {
            action_request_id: actionRequestId,
            mode_suggested: mode_suggested || "balanced",
            transport: transport || "poll"
          })
        };
      },
      transformResponse: (response: unknown) => parsePvpMutationResponse(response) as PvpMutationResponse,
      invalidatesTags: ["League"]
    }),
    pvpSessionActionV2: builder.mutation<
      PvpMutationResponse,
      {
        auth: WebAppAuth;
        session_ref: string;
        action_seq: number;
        input_action: string;
        latency_ms?: number;
        client_ts?: number;
        action_request_id?: string;
      }
    >({
      query: ({ auth, session_ref, action_seq, input_action, latency_ms, client_ts, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "pvp_action");
        return {
          url: "/webapp/api/v2/pvp/session/action",
          method: "POST",
          body: withAuthBody(auth, {
            session_ref: String(session_ref || "").trim(),
            action_seq: Math.max(1, Number(action_seq || 1)),
            input_action: String(input_action || "").trim(),
            latency_ms: Number(latency_ms || 0),
            client_ts: Number(client_ts || Date.now()),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePvpMutationResponse(response) as PvpMutationResponse,
      invalidatesTags: ["League"]
    }),
    pvpSessionResolveV2: builder.mutation<PvpMutationResponse, { auth: WebAppAuth; session_ref: string; action_request_id?: string }>({
      query: ({ auth, session_ref, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "pvp_resolve");
        return {
          url: "/webapp/api/v2/pvp/session/resolve",
          method: "POST",
          body: withAuthBody(auth, {
            session_ref: String(session_ref || "").trim(),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parsePvpMutationResponse(response) as PvpMutationResponse,
      invalidatesTags: ["League"]
    }),
    pvpSessionStateV2: builder.query<PvpSessionStateResponse, { auth: WebAppAuth; session_ref?: string }>({
      query: ({ auth, session_ref }) => ({
        url: `/webapp/api/v2/pvp/session/state?${withAuthQuery(auth, {
          session_ref: session_ref ? String(session_ref).trim() : undefined
        })}`
      }),
      transformResponse: (response: unknown) => parsePvpSessionStateResponse(response) as PvpSessionStateResponse,
      providesTags: ["League"]
    }),
    tokenQuoteV2: builder.query<
      TokenQueryResponse,
      { auth: WebAppAuth; usd: number; chain: string; request_ref?: string; request_id?: number }
    >({
      query: ({ auth, usd, chain, request_ref, request_id }) => ({
        url: `/webapp/api/v2/token/quote?${withAuthQuery(auth, {
          usd: Number(usd || 0),
          chain: String(chain || "").trim().toUpperCase(),
          request_ref: request_ref ? String(request_ref) : undefined,
          request_id: Number(request_id || 0) > 0 ? Number(request_id) : undefined
        })}`
      }),
      transformResponse: (response: unknown) => parseTokenQueryResponse(response) as TokenQueryResponse,
      providesTags: ["Vault"]
    }),
    tokenBuyIntentV2: builder.mutation<
      TokenActionResponse,
      { auth: WebAppAuth; usd_amount: number; chain: string; action_request_id?: string }
    >({
      query: ({ auth, usd_amount, chain, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "token_buy");
        return {
          url: "/webapp/api/v2/token/buy-intent",
          method: "POST",
          body: withAuthBody(auth, {
            usd_amount: Number(usd_amount || 0),
            chain: String(chain || "").trim().toUpperCase(),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parseTokenActionResponse(response) as TokenActionResponse,
      invalidatesTags: ["Vault", "Monetization"]
    }),
    tokenSubmitTxV2: builder.mutation<
      TokenActionResponse,
      { auth: WebAppAuth; request_id: number; tx_hash: string; action_request_id?: string }
    >({
      query: ({ auth, request_id, tx_hash, action_request_id }) => {
        const actionRequestId = resolveMutationActionRequestId(action_request_id, "token_submit");
        return {
          url: "/webapp/api/v2/token/submit-tx",
          method: "POST",
          body: withAuthBody(auth, {
            request_id: Math.max(1, Number(request_id || 0)),
            tx_hash: String(tx_hash || "").trim(),
            action_request_id: actionRequestId
          })
        };
      },
      transformResponse: (response: unknown) => parseTokenActionResponse(response) as TokenActionResponse,
      invalidatesTags: ["Vault", "Monetization"]
    }),
    walletSessionV2: builder.query<WebAppApiResponse<WalletSessionV2Payload>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/wallet/session?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) =>
        parseWalletSessionResponse(response) as WebAppApiResponse<WalletSessionV2Payload>,
      providesTags: ["Vault"]
    }),
    walletChallengeV2: builder.mutation<
      WebAppApiResponse,
      { auth: WebAppAuth; chain: string; address: string; statement?: string }
    >({
      query: ({ auth, chain, address, statement }) => ({
        url: "/webapp/api/v2/wallet/challenge",
        method: "POST",
        body: withAuthBody(auth, {
          chain: String(chain || "").trim().toUpperCase(),
          address: String(address || "").trim(),
          statement: statement ? String(statement) : undefined
        })
      }),
      invalidatesTags: ["Vault"]
    }),
    walletVerifyV2: builder.mutation<
      WebAppApiResponse,
      { auth: WebAppAuth; challenge_ref: string; chain: string; address: string; signature: string; message?: string }
    >({
      query: ({ auth, challenge_ref, chain, address, signature, message }) => ({
        url: "/webapp/api/v2/wallet/verify",
        method: "POST",
        body: withAuthBody(auth, {
          challenge_ref: String(challenge_ref || "").trim(),
          chain: String(chain || "").trim().toUpperCase(),
          address: String(address || "").trim(),
          signature: String(signature || "").trim(),
          message: message ? String(message) : undefined
        })
      }),
      invalidatesTags: ["Vault", "Bootstrap", "HomeFeed"]
    }),
    walletUnlinkV2: builder.mutation<
      WebAppApiResponse,
      { auth: WebAppAuth; chain?: string; address?: string; reason?: string }
    >({
      query: ({ auth, chain, address, reason }) => ({
        url: "/webapp/api/v2/wallet/unlink",
        method: "POST",
        body: withAuthBody(auth, {
          chain: chain ? String(chain).trim().toUpperCase() : undefined,
          address: address ? String(address).trim() : undefined,
          reason: reason ? String(reason) : undefined
        })
      }),
      invalidatesTags: ["Vault", "Bootstrap", "HomeFeed"]
    }),
    payoutStatusV2: builder.query<WebAppApiResponse<PayoutStatusV2Payload>, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/payout/status?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) =>
        parsePayoutStatusResponse(response) as WebAppApiResponse<PayoutStatusV2Payload>,
      providesTags: ["Vault"]
    }),
    payoutRequestV2: builder.mutation<WebAppApiResponse, { auth: WebAppAuth; currency?: string }>({
      query: ({ auth, currency }) => ({
        url: "/webapp/api/v2/payout/request",
        method: "POST",
        body: withAuthBody(auth, {
          currency: String(currency || "BTC").trim().toUpperCase()
        })
      }),
      invalidatesTags: ["Vault", "Bootstrap", "HomeFeed"]
    }),
    uiPreferencesV2: builder.query<UiPreferencesResponse, { auth: WebAppAuth }>({
      query: ({ auth }) => ({
        url: `/webapp/api/v2/ui/preferences?${withAuthQuery(auth)}`
      }),
      transformResponse: (response: unknown) => parseUiPreferencesResponse(response) as UiPreferencesResponse,
      providesTags: ["Prefs"]
    }),
    patchUiPreferencesV2: builder.mutation<UiPreferencesResponse, { auth: WebAppAuth; patch: UiPreferencesPatch }>({
      query: ({ auth, patch }) => ({
        url: "/webapp/api/v2/ui/preferences",
        method: "POST",
        body: withAuthBody(auth, patch as Record<string, unknown>)
      }),
      transformResponse: (response: unknown) => parseUiPreferencesResponse(response) as UiPreferencesResponse,
      invalidatesTags: ["Prefs", "Bootstrap"]
    }),
    uiEventsBatchV2: builder.mutation<UiEventBatchResponse, UiEventBatchRequest>({
      query: (payload) => ({
        url: "/webapp/api/v2/telemetry/ui-events/batch",
        method: "POST",
        body: payload
      }),
      invalidatesTags: ["Telemetry"]
    })
  })
});

export const {
  useBootstrapV2Query,
  useHomeFeedV2Query,
  useLeagueOverviewV2Query,
  useLazyPvpLeaderboardLiveV2Query,
  useLazyPvpDiagnosticsLiveV2Query,
  useLazyPvpMatchTickV2Query,
  useVaultOverviewV2Query,
  useMonetizationCatalogV2Query,
  useMonetizationOverviewV2Query,
  useMonetizationStatusV2Query,
  useMonetizationPassPurchaseV2Mutation,
  useMonetizationCosmeticPurchaseV2Mutation,
  useActionAcceptV2Mutation,
  useActionClaimMissionV2Mutation,
  useActionCompleteV2Mutation,
  useActionRevealV2Mutation,
  useAdminAssetsReloadV2Mutation,
  useAdminAssetsStatusV2Query,
  useAdminAuditDataIntegrityV2Query,
  useAdminAuditPhaseStatusV2Query,
  useAdminBootstrapV2Query,
  useAdminDeployStatusV2Query,
  useAdminLiveOpsCampaignV2Query,
  useAdminLiveOpsCampaignUpsertV2Mutation,
  useAdminLiveOpsCampaignDispatchV2Mutation,
  useAdminMetricsV2Query,
  useAdminOpsKpiLatestV2Query,
  useAdminOpsKpiRunV2Mutation,
  useAdminRuntimeBotReconcileV2Mutation,
  useAdminRuntimeBotV2Query,
  useAdminRuntimeFlagsUpdateV2Mutation,
  useAdminRuntimeFlagsV2Query,
  useAdminQueueActionV2Mutation,
  useAdminDynamicAutoPolicyV2Query,
  useAdminDynamicAutoPolicyUpsertV2Mutation,
  useAdminUnifiedQueueV2Query,
  useTasksRerollV2Mutation,
  usePvpSessionStartV2Mutation,
  usePvpSessionActionV2Mutation,
  usePvpSessionResolveV2Mutation,
  useLazyPvpSessionStateV2Query,
  useLazyTokenQuoteV2Query,
  useTokenBuyIntentV2Mutation,
  useTokenSubmitTxV2Mutation,
  useWalletSessionV2Query,
  useWalletChallengeV2Mutation,
  useWalletVerifyV2Mutation,
  useWalletUnlinkV2Mutation,
  usePayoutStatusV2Query,
  usePayoutRequestV2Mutation,
  useUiPreferencesV2Query,
  usePatchUiPreferencesV2Mutation,
  useUiEventsBatchV2Mutation
} = webappApi;
