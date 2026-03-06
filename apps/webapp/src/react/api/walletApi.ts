import type { WalletSession, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import { parseWalletSessionResponse } from "../../core/contracts/v2Validators.js";

type WalletChallengePayload = {
  chain: string;
  address: string;
  statement?: string;
};

type WalletVerifyPayload = {
  challenge_ref: string;
  chain: string;
  address: string;
  signature: string;
  message?: string;
};

type WalletUnlinkPayload = {
  chain?: string;
  address?: string;
  reason?: string;
};

export async function postWalletChallengeV2(
  auth: WebAppAuth,
  payload: WalletChallengePayload
): Promise<WebAppApiResponse> {
  return postJson<WebAppApiResponse>("/webapp/api/v2/wallet/challenge", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    chain: String(payload.chain || "").trim(),
    address: String(payload.address || "").trim(),
    statement: payload.statement ? String(payload.statement) : undefined
  });
}

export async function postWalletVerifyV2(auth: WebAppAuth, payload: WalletVerifyPayload): Promise<WebAppApiResponse> {
  return postJson<WebAppApiResponse>("/webapp/api/v2/wallet/verify", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    challenge_ref: String(payload.challenge_ref || "").trim(),
    chain: String(payload.chain || "").trim(),
    address: String(payload.address || "").trim(),
    signature: String(payload.signature || "").trim(),
    message: payload.message ? String(payload.message) : undefined
  });
}

export async function fetchWalletSessionV2(
  auth: WebAppAuth
): Promise<WebAppApiResponse<{ wallet_session?: WalletSession; [key: string]: unknown }>> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse<{ wallet_session?: WalletSession; [key: string]: unknown }>>(
    `/webapp/api/v2/wallet/session?${query}`
  );
  return parseWalletSessionResponse(response) as WebAppApiResponse<{ wallet_session?: WalletSession; [key: string]: unknown }>;
}

export async function postWalletUnlinkV2(auth: WebAppAuth, payload: WalletUnlinkPayload = {}): Promise<WebAppApiResponse> {
  return postJson<WebAppApiResponse>("/webapp/api/v2/wallet/unlink", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    chain: payload.chain ? String(payload.chain).trim() : undefined,
    address: payload.address ? String(payload.address).trim() : undefined,
    reason: payload.reason ? String(payload.reason).trim() : undefined
  });
}
