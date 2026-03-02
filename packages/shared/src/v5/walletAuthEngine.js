"use strict";

const crypto = require("crypto");

const SUPPORTED_WALLET_CHAINS = Object.freeze(["eth", "sol", "ton"]);

function normalizeWalletChain(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "ethereum" || raw === "evm" || raw === "eth") return "eth";
  if (raw === "solana" || raw === "sol") return "sol";
  if (raw === "ton" || raw === "theopennetwork") return "ton";
  return raw;
}

function isSupportedWalletChain(value) {
  return SUPPORTED_WALLET_CHAINS.includes(normalizeWalletChain(value));
}

function normalizeWalletAddress(chainInput, addressInput) {
  const chain = normalizeWalletChain(chainInput);
  const address = String(addressInput || "").trim();
  if (chain === "eth") {
    return address.toLowerCase();
  }
  return address;
}

function validateWalletAddress(chainInput, addressInput) {
  const chain = normalizeWalletChain(chainInput);
  const address = normalizeWalletAddress(chain, addressInput);
  if (!isSupportedWalletChain(chain)) {
    return { ok: false, error: "wallet_chain_unsupported", chain, address };
  }
  if (!address) {
    return { ok: false, error: "wallet_address_missing", chain, address };
  }
  if (chain === "eth" && !/^0x[a-f0-9]{40}$/i.test(address)) {
    return { ok: false, error: "wallet_address_invalid", chain, address };
  }
  if (chain === "sol" && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { ok: false, error: "wallet_address_invalid", chain, address };
  }
  if (chain === "ton" && !/^([EQkU][A-Za-z0-9_-]{47}|0:[0-9a-fA-F]{64})$/.test(address)) {
    return { ok: false, error: "wallet_address_invalid", chain, address };
  }
  return { ok: true, error: "", chain, address };
}

function generateChallengeNonce(size = 12) {
  return crypto.randomBytes(Math.max(8, size)).toString("hex");
}

function normalizeDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "airdropkralbot.app";
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function buildWalletChallenge(input = {}) {
  const validation = validateWalletAddress(input.chain, input.address);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      chain: validation.chain,
      address: validation.address
    };
  }
  const chain = validation.chain;
  const address = validation.address;
  const challengeRef = String(input.challenge_ref || input.challengeRef || "").trim();
  const userId = Number(input.user_id || input.userId || 0);
  const nonce = String(input.nonce || generateChallengeNonce()).trim();
  const ttlSec = Math.max(60, Math.min(900, Number(input.ttl_sec || input.ttlSec || 300)));
  const issuedAt = String(input.issued_at || input.issuedAt || new Date().toISOString());
  const expiresAt = String(input.expires_at || input.expiresAt || new Date(Date.now() + ttlSec * 1000).toISOString());
  const domain = normalizeDomain(input.domain);
  const statement = String(input.statement || "AirdropKralBot wallet link challenge").trim();

  let challengeText = "";
  if (chain === "eth") {
    challengeText =
      `${domain} wants you to sign in with your Ethereum account:\n` +
      `${address}\n\n` +
      `${statement}\n\n` +
      `URI: https://${domain}\n` +
      `Version: 1\n` +
      `Chain ID: 1\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: ${issuedAt}\n` +
      `Expiration Time: ${expiresAt}` +
      (challengeRef ? `\nRequest ID: ${challengeRef}` : "");
  } else {
    challengeText =
      `AirdropKralBot Wallet Link\n` +
      `Chain: ${chain.toUpperCase()}\n` +
      `Address: ${address}\n` +
      `Statement: ${statement}\n` +
      `Nonce: ${nonce}\n` +
      `Issued At: ${issuedAt}\n` +
      `Expiration Time: ${expiresAt}` +
      (challengeRef ? `\nChallenge Ref: ${challengeRef}` : "");
  }

  return {
    ok: true,
    chain,
    address,
    user_id: userId,
    challenge_ref: challengeRef,
    nonce,
    issued_at: issuedAt,
    expires_at: expiresAt,
    ttl_sec: ttlSec,
    domain,
    statement,
    challenge_text: challengeText
  };
}

function verifyWalletProof(input = {}) {
  const validation = validateWalletAddress(input.chain, input.address);
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.error,
      chain: validation.chain,
      address: validation.address,
      verification_level: "none"
    };
  }
  const chain = validation.chain;
  const address = validation.address;
  const signature = String(input.signature || "").trim();
  const challengeText = String(input.challenge_text || input.challengeText || "").trim();
  const message = String(input.message || challengeText).trim();
  if (!signature) {
    return { ok: false, error: "wallet_signature_missing", chain, address, verification_level: "none" };
  }
  if (!challengeText || !message || message !== challengeText) {
    return { ok: false, error: "wallet_challenge_mismatch", chain, address, verification_level: "none" };
  }

  let signatureOk = false;
  if (chain === "eth") {
    signatureOk = /^0x[a-fA-F0-9]{130}$/.test(signature);
  } else if (chain === "sol") {
    signatureOk = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(signature);
  } else if (chain === "ton") {
    signatureOk = /^[A-Za-z0-9+/_=-]{64,200}$/.test(signature);
  }
  if (!signatureOk) {
    return { ok: false, error: "wallet_signature_invalid_format", chain, address, verification_level: "none" };
  }

  const strictMode = String(input.verify_mode || "format_only")
    .trim()
    .toLowerCase() === "strict_crypto";
  if (strictMode) {
    return {
      ok: false,
      error: "wallet_signature_crypto_verifier_unavailable",
      chain,
      address,
      verification_level: "none"
    };
  }

  return {
    ok: true,
    error: "",
    chain,
    address,
    verification_level: "format_only",
    verification_method: `${chain}_format_only`,
    proof_hash: crypto.createHash("sha256").update(`${chain}:${address}:${signature}`).digest("hex")
  };
}

module.exports = {
  SUPPORTED_WALLET_CHAINS,
  normalizeWalletChain,
  isSupportedWalletChain,
  normalizeWalletAddress,
  validateWalletAddress,
  generateChallengeNonce,
  buildWalletChallenge,
  verifyWalletProof
};
