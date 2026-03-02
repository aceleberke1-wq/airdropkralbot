const test = require("node:test");
const assert = require("node:assert/strict");

const walletAuthEngine = require("../../../packages/shared/src/v5/walletAuthEngine");
const { V5TypeNames, TypeShapes } = require("../../../packages/shared/src/v5/types");

test("wallet challenge builder returns SIWE style payload for ETH", () => {
  const challenge = walletAuthEngine.buildWalletChallenge({
    challenge_ref: "d6d417ec-89a7-4e98-b8d2-5301b575f5f0",
    user_id: 101,
    chain: "eth",
    address: "0xA38a2B91f3A6F2b568C8A7F9ca3c1976cDDFB44E",
    nonce: "abc123",
    ttl_sec: 300,
    domain: "example.com"
  });
  assert.equal(challenge.ok, true);
  assert.equal(challenge.chain, "eth");
  assert.equal(challenge.address, "0xa38a2b91f3a6f2b568c8a7f9ca3c1976cddfb44e");
  assert.match(challenge.challenge_text, /Nonce: abc123/);
  assert.match(challenge.challenge_text, /example\.com wants you to sign in/);
});

test("wallet engine validates address formats for supported chains", () => {
  assert.equal(walletAuthEngine.validateWalletAddress("eth", "0x123").ok, false);
  assert.equal(walletAuthEngine.validateWalletAddress("sol", "invalid").ok, false);
  assert.equal(walletAuthEngine.validateWalletAddress("ton", "invalid").ok, false);
  assert.equal(
    walletAuthEngine.validateWalletAddress("sol", "7YfM5vX8hK2xv2ZKMSE8J1mTdS1DzfQHnA3Yz91S6wyK").ok,
    true
  );
});

test("wallet proof verification supports format-only mode and blocks strict mode", () => {
  const challenge = walletAuthEngine.buildWalletChallenge({
    challenge_ref: "da85a0e4-f170-4e43-aa56-5de2fd79d5f9",
    user_id: 9,
    chain: "eth",
    address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    nonce: "proofnonce",
    domain: "example.com"
  });
  const signature = `0x${"a".repeat(130)}`;
  const formatOnly = walletAuthEngine.verifyWalletProof({
    chain: "eth",
    address: challenge.address,
    signature,
    message: challenge.challenge_text,
    challenge_text: challenge.challenge_text,
    verify_mode: "format_only"
  });
  assert.equal(formatOnly.ok, true);
  assert.equal(formatOnly.verification_level, "format_only");

  const strict = walletAuthEngine.verifyWalletProof({
    chain: "eth",
    address: challenge.address,
    signature,
    message: challenge.challenge_text,
    challenge_text: challenge.challenge_text,
    verify_mode: "strict_crypto"
  });
  assert.equal(strict.ok, false);
  assert.equal(strict.error, "wallet_signature_crypto_verifier_unavailable");
});

test("v5 type registry includes wallet and kyc shapes", () => {
  assert.ok(V5TypeNames.includes("WalletChallenge"));
  assert.ok(V5TypeNames.includes("WalletSessionState"));
  assert.ok(V5TypeNames.includes("KycStatus"));
  assert.equal(typeof TypeShapes.WalletChallenge.challenge_ref, "string");
  assert.equal(TypeShapes.WalletSessionState.active, false);
  assert.equal(TypeShapes.KycStatus.status, "unknown");
});
