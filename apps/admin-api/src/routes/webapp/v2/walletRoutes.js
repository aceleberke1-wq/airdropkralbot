"use strict";

function requireDependency(deps, key, type) {
  const value = deps[key];
  if (type === "function" && typeof value !== "function") {
    throw new Error(`registerWebappV2WalletRoutes requires ${key}`);
  }
  if (type === "object" && (!value || typeof value !== "object")) {
    throw new Error(`registerWebappV2WalletRoutes requires ${key}`);
  }
  return value;
}

function registerWebappV2WalletRoutes(fastify, deps = {}) {
  const pool = requireDependency(deps, "pool", "object");
  const verifyWebAppAuth = requireDependency(deps, "verifyWebAppAuth", "function");
  const issueWebAppSession = requireDependency(deps, "issueWebAppSession", "function");
  const normalizeWalletChainInput = requireDependency(deps, "normalizeWalletChainInput", "function");
  const normalizeWalletAddressInput = requireDependency(deps, "normalizeWalletAddressInput", "function");
  const walletAuthEngine = requireDependency(deps, "walletAuthEngine", "object");
  const loadFeatureFlags = requireDependency(deps, "loadFeatureFlags", "function");
  const isFeatureEnabled = requireDependency(deps, "isFeatureEnabled", "function");
  const hasWalletAuthTables = requireDependency(deps, "hasWalletAuthTables", "function");
  const getProfileByTelegram = requireDependency(deps, "getProfileByTelegram", "function");
  const newUuid = requireDependency(deps, "newUuid", "function");
  const insertWalletChallenge = requireDependency(deps, "insertWalletChallenge", "function");
  const riskStore = requireDependency(deps, "riskStore", "object");
  const maskWalletLinkAddress = requireDependency(deps, "maskWalletLinkAddress", "function");
  const readWalletChallengeForUpdate = requireDependency(deps, "readWalletChallengeForUpdate", "function");
  const markWalletChallengeStatus = requireDependency(deps, "markWalletChallengeStatus", "function");
  const isSanctionedWalletAddress = requireDependency(deps, "isSanctionedWalletAddress", "function");
  const hasKycTables = requireDependency(deps, "hasKycTables", "function");
  const insertKycScreeningEvent = requireDependency(deps, "insertKycScreeningEvent", "function");
  const upsertKycProfile = requireDependency(deps, "upsertKycProfile", "function");
  const readKycProfile = requireDependency(deps, "readKycProfile", "function");
  const normalizeKycState = requireDependency(deps, "normalizeKycState", "function");
  const upsertWalletLink = requireDependency(deps, "upsertWalletLink", "function");
  const insertWalletSession = requireDependency(deps, "insertWalletSession", "function");
  const readWalletSessionState = requireDependency(deps, "readWalletSessionState", "function");
  const listWalletLinks = requireDependency(deps, "listWalletLinks", "function");
  const getWalletCapabilities = requireDependency(deps, "getWalletCapabilities", "function");
  const unlinkWalletLinks = requireDependency(deps, "unlinkWalletLinks", "function");
  const revokeWalletSessions = requireDependency(deps, "revokeWalletSessions", "function");

  const walletChallengeTtlSec = Math.max(60, Math.min(900, Number(deps.walletChallengeTtlSec || 300)));
  const walletSessionTtlSec = Math.max(900, Math.min(2592000, Number(deps.walletSessionTtlSec || 86400)));
  const walletVerifyMode = String(deps.walletVerifyMode || "format_only").trim().toLowerCase();
  const webappPublicUrl = String(deps.webappPublicUrl || "").trim();
  const kycRiskThreshold = Math.max(0, Math.min(1, Number(deps.kycRiskThreshold || 0.75)));

  fastify.post(
    "/webapp/api/v2/wallet/challenge",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "chain", "address"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            chain: { type: "string", minLength: 2, maxLength: 16 },
            address: { type: "string", minLength: 8, maxLength: 180 },
            statement: { type: "string", minLength: 6, maxLength: 220 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const chain = normalizeWalletChainInput(request.body.chain);
      const address = normalizeWalletAddressInput(chain, request.body.address);
      const validation = walletAuthEngine.validateWalletAddress(chain, address);
      if (!validation.ok) {
        reply.code(400).send({ success: false, error: validation.error });
        return;
      }

      const client = await pool.connect();
      try {
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "WALLET_AUTH_V1_ENABLED")) {
          reply.code(409).send({ success: false, error: "wallet_feature_disabled" });
          return;
        }
        const tablesReady = await hasWalletAuthTables(client);
        if (!tablesReady) {
          reply.code(503).send({ success: false, error: "wallet_tables_missing" });
          return;
        }
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const challengeRef = newUuid();
        const domain =
          String(process.env.SIWE_DOMAIN || "").trim() ||
          String(request.headers.host || "").trim() ||
          String(webappPublicUrl || "").trim();
        const challenge = walletAuthEngine.buildWalletChallenge({
          challenge_ref: challengeRef,
          user_id: profile.user_id,
          chain,
          address,
          ttl_sec: walletChallengeTtlSec,
          domain,
          statement: String(request.body.statement || "AirdropKralBot wallet link challenge")
        });
        if (!challenge.ok) {
          reply.code(400).send({ success: false, error: challenge.error || "wallet_challenge_build_failed" });
          return;
        }
        const inserted = await insertWalletChallenge(client, {
          challenge_ref: challenge.challenge_ref,
          user_id: profile.user_id,
          chain: challenge.chain,
          address_norm: challenge.address,
          nonce: challenge.nonce,
          challenge_text: challenge.challenge_text,
          issued_at: challenge.issued_at,
          expires_at: challenge.expires_at,
          payload_json: {
            statement: challenge.statement,
            domain: challenge.domain,
            verify_mode: walletVerifyMode
          }
        });
        await riskStore
          .insertBehaviorEvent(client, profile.user_id, "webapp_wallet_challenge", {
            chain: challenge.chain,
            address_masked: maskWalletLinkAddress(challenge.address),
            challenge_ref: challenge.challenge_ref
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            challenge: {
              challenge_ref: inserted.challenge_ref,
              chain: inserted.chain,
              address: address,
              address_masked: maskWalletLinkAddress(address),
              nonce: inserted.nonce,
              challenge_text: inserted.challenge_text,
              issued_at: inserted.issued_at,
              expires_at: inserted.expires_at,
              ttl_sec: walletChallengeTtlSec,
              verify_mode: walletVerifyMode
            }
          }
        });
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/wallet/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "challenge_ref", "chain", "address", "signature"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            challenge_ref: { type: "string", minLength: 24, maxLength: 80 },
            chain: { type: "string", minLength: 2, maxLength: 16 },
            address: { type: "string", minLength: 8, maxLength: 180 },
            signature: { type: "string", minLength: 16, maxLength: 1024 },
            message: { type: "string", minLength: 8, maxLength: 6000 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const chain = normalizeWalletChainInput(request.body.chain);
      const address = normalizeWalletAddressInput(chain, request.body.address);
      const challengeRef = String(request.body.challenge_ref || "").trim();
      const signature = String(request.body.signature || "").trim();
      const message = String(request.body.message || "").trim();

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "WALLET_AUTH_V1_ENABLED")) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "wallet_feature_disabled" });
          return;
        }
        const tablesReady = await hasWalletAuthTables(client);
        if (!tablesReady) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "wallet_tables_missing" });
          return;
        }
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const challenge = await readWalletChallengeForUpdate(client, challengeRef, profile.user_id);
        if (!challenge) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "wallet_challenge_not_found" });
          return;
        }
        if (String(challenge.status || "") !== "pending") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "wallet_challenge_not_pending" });
          return;
        }
        if (new Date(challenge.expires_at).getTime() <= Date.now()) {
          await markWalletChallengeStatus(client, challengeRef, profile.user_id, "expired", { reason: "challenge_expired" });
          await client.query("COMMIT");
          reply.code(409).send({ success: false, error: "wallet_challenge_expired" });
          return;
        }
        if (String(challenge.chain || "") !== chain || String(challenge.address_norm || "") !== address) {
          await markWalletChallengeStatus(client, challengeRef, profile.user_id, "rejected", { reason: "challenge_chain_or_address_mismatch" });
          await client.query("COMMIT");
          reply.code(409).send({ success: false, error: "wallet_challenge_mismatch" });
          return;
        }

        const proof = walletAuthEngine.verifyWalletProof({
          chain,
          address,
          signature,
          message,
          challenge_text: String(challenge.challenge_text || ""),
          verify_mode: walletVerifyMode
        });
        if (!proof.ok) {
          await markWalletChallengeStatus(client, challengeRef, profile.user_id, "rejected", {
            reason: proof.error || "wallet_signature_invalid"
          });
          await client.query("COMMIT");
          reply.code(409).send({ success: false, error: proof.error || "wallet_signature_invalid" });
          return;
        }

        const riskState = await riskStore.getRiskState(client, profile.user_id).catch((err) => {
          if (err.code === "42P01") return { riskScore: 0 };
          throw err;
        });
        const riskScore = Number(riskState?.riskScore || 0);
        const sanctioned = isSanctionedWalletAddress(address);
        const kycTablesReady = await hasKycTables(client);
        if (kycTablesReady) {
          const screeningPayload = {
            user_id: profile.user_id,
            chain,
            address_norm: address,
            screening_result: sanctioned ? "blocked" : riskScore >= kycRiskThreshold ? "manual_review" : "pass",
            risk_score: riskScore,
            reason_code: sanctioned ? "sanctioned_wallet" : riskScore >= kycRiskThreshold ? "risk_threshold" : "ok",
            payload_json: {
              challenge_ref: challengeRef,
              verification_level: proof.verification_level,
              verification_method: proof.verification_method
            }
          };
          await insertKycScreeningEvent(client, screeningPayload);
          if (sanctioned) {
            await upsertKycProfile(client, {
              user_id: profile.user_id,
              status: "sanctioned",
              tier: "blocked",
              provider_ref: "internal_sanctions",
              payload_json: {
                reason_code: "sanctioned_wallet",
                chain,
                address_norm: address
              }
            });
          } else if (riskScore >= kycRiskThreshold) {
            await upsertKycProfile(client, {
              user_id: profile.user_id,
              status: "pending",
              tier: "threshold_review",
              provider_ref: "internal_threshold",
              payload_json: {
                reason_code: "risk_threshold",
                risk_score: riskScore
              }
            });
          }
        }
        if (sanctioned) {
          await markWalletChallengeStatus(client, challengeRef, profile.user_id, "rejected", { reason: "sanctioned_wallet" });
          await client.query("COMMIT");
          reply.code(403).send({ success: false, error: "wallet_sanction_blocked" });
          return;
        }

        const kycProfile = kycTablesReady ? await readKycProfile(client, profile.user_id) : null;
        const kycState = normalizeKycState(kycProfile);
        const linked = await upsertWalletLink(client, {
          user_id: profile.user_id,
          chain,
          address_norm: address,
          address_display: address,
          is_primary: true,
          verification_state: String(proof.verification_level || "format_only"),
          verification_method: String(proof.verification_method || "format_only"),
          kyc_status: kycState.status === "unknown" ? (riskScore >= kycRiskThreshold ? "pending" : "not_required") : kycState.status,
          risk_score: riskScore,
          metadata_json: {
            challenge_ref: challengeRef,
            verify_mode: walletVerifyMode
          }
        });
        const walletSession = await insertWalletSession(client, {
          session_ref: newUuid(),
          user_id: profile.user_id,
          chain,
          address_norm: address,
          proof_hash: String(proof.proof_hash || ""),
          source_challenge_ref: challengeRef,
          ttl_sec: walletSessionTtlSec,
          meta_json: {
            verification_level: proof.verification_level,
            verification_method: proof.verification_method,
            risk_score: riskScore
          }
        });
        await markWalletChallengeStatus(client, challengeRef, profile.user_id, "verified", {
          verification_level: proof.verification_level,
          verification_method: proof.verification_method
        });
        await riskStore
          .insertBehaviorEvent(client, profile.user_id, "webapp_wallet_verified", {
            chain,
            address_masked: maskWalletLinkAddress(address),
            verification_level: proof.verification_level
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            wallet_session: {
              enabled: true,
              verify_mode: walletVerifyMode,
              active: true,
              chain: String(walletSession.chain || chain),
              address: String(linked.address_display || address),
              address_masked: maskWalletLinkAddress(linked.address_display || address),
              linked_at: linked.linked_at,
              expires_at: walletSession.expires_at,
              session_ref: String(walletSession.session_ref || ""),
              kyc_status: String(linked.kyc_status || "unknown")
            },
            kyc_status: {
              status: String(kycProfile?.status || (riskScore >= kycRiskThreshold ? "pending" : "not_required")),
              tier: String(kycProfile?.tier || (riskScore >= kycRiskThreshold ? "threshold_review" : "none")),
              blocked: false,
              approved: Boolean(kycProfile?.status === "verified" || kycProfile?.status === "approved")
            }
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "wallet_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.get("/webapp/api/v2/wallet/session", async (request, reply) => {
    const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      const featureFlags = await loadFeatureFlags(client);
      const capabilities = getWalletCapabilities(featureFlags);
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      if (!capabilities.enabled) {
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            wallet_capabilities: capabilities,
            wallet_session: {
              enabled: false,
              active: false,
              chain: "",
              address: "",
              address_masked: "",
              linked_at: null,
              expires_at: null,
              session_ref: "",
              kyc_status: "unknown"
            },
            links: [],
            kyc_status: {
              status: "unknown",
              tier: "none",
              blocked: false,
              approved: false
            }
          }
        });
        return;
      }
      const tablesReady = await hasWalletAuthTables(client);
      if (!tablesReady) {
        reply.code(503).send({ success: false, error: "wallet_tables_missing" });
        return;
      }
      const kycTablesReady = await hasKycTables(client);
      const walletSession = await readWalletSessionState(client, profile.user_id);
      const walletLinks = await listWalletLinks(client, profile.user_id);
      const kycProfile = kycTablesReady ? await readKycProfile(client, profile.user_id) : null;
      const kycState = normalizeKycState(kycProfile);
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          wallet_capabilities: {
            ...capabilities,
            tables_available: tablesReady,
            kyc_tables_available: kycTablesReady
          },
          wallet_session: {
            enabled: true,
            verify_mode: walletVerifyMode,
            ...walletSession,
            address_masked: walletSession.active ? maskWalletLinkAddress(walletSession.address) : ""
          },
          links: walletLinks.map((row) => ({
            chain: String(row.chain || ""),
            address: String(row.address_display || row.address_norm || ""),
            address_masked: maskWalletLinkAddress(String(row.address_display || row.address_norm || "")),
            is_primary: Boolean(row.is_primary),
            verification_state: String(row.verification_state || ""),
            verification_method: String(row.verification_method || ""),
            kyc_status: String(row.kyc_status || "unknown"),
            risk_score: Number(row.risk_score || 0),
            linked_at: row.linked_at || null
          })),
          kyc_status: {
            status: kycState.status,
            tier: kycState.tier,
            blocked: kycState.blocked,
            approved: kycState.approved
          }
        }
      });
    } finally {
      client.release();
    }
  });

  fastify.post(
    "/webapp/api/v2/wallet/unlink",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            chain: { type: "string", minLength: 2, maxLength: 16 },
            address: { type: "string", minLength: 8, maxLength: 180 },
            reason: { type: "string", minLength: 2, maxLength: 240 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const chain = normalizeWalletChainInput(request.body.chain);
      const address = normalizeWalletAddressInput(chain, request.body.address);
      const reason = String(request.body.reason || "user_requested_unlink");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "WALLET_AUTH_V1_ENABLED")) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "wallet_feature_disabled" });
          return;
        }
        const tablesReady = await hasWalletAuthTables(client);
        if (!tablesReady) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "wallet_tables_missing" });
          return;
        }
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const validation = chain || address ? walletAuthEngine.validateWalletAddress(chain, address) : { ok: true };
        if (!validation.ok) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: validation.error });
          return;
        }
        const unlinkedCount = await unlinkWalletLinks(client, profile.user_id, { chain, address, reason });
        const revokedCount = await revokeWalletSessions(client, profile.user_id, { chain, address, reason });
        await riskStore
          .insertBehaviorEvent(client, profile.user_id, "webapp_wallet_unlink", {
            chain: chain || "",
            address_masked: address ? maskWalletLinkAddress(address) : "",
            unlinked_count: unlinkedCount,
            revoked_count: revokedCount
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });
        const sessionState = await readWalletSessionState(client, profile.user_id);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            unlinked_count: unlinkedCount,
            revoked_count: revokedCount,
            wallet_session: {
              enabled: true,
              verify_mode: walletVerifyMode,
              ...sessionState,
              address_masked: sessionState.active ? maskWalletLinkAddress(sessionState.address) : ""
            }
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "wallet_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerWebappV2WalletRoutes
};
