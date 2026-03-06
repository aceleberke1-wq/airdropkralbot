import type { LeagueOverview, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, withAuthQuery } from "./common";
import { parseLeagueOverviewResponse, parsePvpLiveResponse } from "../../core/contracts/v2Validators.js";

export async function fetchPvpLeagueOverviewV2(auth: WebAppAuth): Promise<WebAppApiResponse<LeagueOverview>> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse<LeagueOverview>>(`/webapp/api/v2/pvp/league/overview?${query}`);
  return parseLeagueOverviewResponse(response) as WebAppApiResponse<LeagueOverview>;
}

export async function fetchPvpLeaderboardLiveV2(auth: WebAppAuth, limit = 25): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth, {
    limit: Math.max(5, Math.min(100, Number(limit || 25)))
  });
  const response = await getJson<WebAppApiResponse>(`/webapp/api/v2/pvp/leaderboard/live?${query}`);
  return parsePvpLiveResponse(response) as WebAppApiResponse;
}

export async function fetchPvpDiagnosticsLiveV2(
  auth: WebAppAuth,
  options: { window?: "5m" | "15m" | "1h" | "24h"; session_ref?: string } = {}
): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth, {
    window: options.window || "5m",
    session_ref: String(options.session_ref || "").trim() || undefined
  });
  const response = await getJson<WebAppApiResponse>(`/webapp/api/v2/pvp/diagnostics/live?${query}`);
  return parsePvpLiveResponse(response) as WebAppApiResponse;
}

export async function fetchPvpMatchTickV2(
  auth: WebAppAuth,
  options: { session_ref: string; action_seq?: number; expected_action?: string } | null = null
): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth, {
    session_ref: String(options?.session_ref || "").trim(),
    action_seq: Number(options?.action_seq || 0) > 0 ? Number(options?.action_seq) : undefined,
    expected_action: String(options?.expected_action || "").trim() || undefined
  });
  const response = await getJson<WebAppApiResponse>(`/webapp/api/v2/pvp/match/tick?${query}`);
  return parsePvpLiveResponse(response) as WebAppApiResponse;
}
