function normalizeChain(chainRaw) {
  return String(chainRaw || "").trim().toUpperCase();
}

function normalizeHash(chain, txHashRaw) {
  const raw = String(txHashRaw || "").trim();
  if (!raw) {
    return "";
  }
  const upperChain = normalizeChain(chain);
  if (upperChain === "ETH") {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  if (upperChain === "BTC") {
    return raw.startsWith("0x") ? raw.slice(2).toLowerCase() : raw.toLowerCase();
  }
  if (upperChain === "TRX") {
    return raw.startsWith("0x") ? raw.slice(2) : raw;
  }
  return raw;
}

function validateTxHash(chain, txHashRaw) {
  const safeChain = normalizeChain(chain);
  const txHash = normalizeHash(safeChain, txHashRaw);
  if (!txHash) {
    return { ok: false, reason: "tx_hash_missing", chain: safeChain, normalizedHash: "" };
  }

  if (safeChain === "BTC") {
    const ok = /^[a-f0-9]{64}$/i.test(txHash);
    return { ok, reason: ok ? "ok" : "invalid_tx_hash_format", chain: safeChain, normalizedHash: txHash };
  }
  if (safeChain === "ETH") {
    const ok = /^0x[a-f0-9]{64}$/i.test(txHash);
    return { ok, reason: ok ? "ok" : "invalid_tx_hash_format", chain: safeChain, normalizedHash: txHash };
  }
  if (safeChain === "TRX") {
    const ok = /^[a-f0-9]{64}$/i.test(txHash);
    return { ok, reason: ok ? "ok" : "invalid_tx_hash_format", chain: safeChain, normalizedHash: txHash };
  }
  if (safeChain === "SOL") {
    const ok = /^[1-9A-HJ-NP-Za-km-z]{64,96}$/.test(txHash);
    return { ok, reason: ok ? "ok" : "invalid_tx_hash_format", chain: safeChain, normalizedHash: txHash };
  }
  if (safeChain === "TON") {
    const ok = /^[A-Za-z0-9_\-]{40,140}$/.test(txHash);
    return { ok, reason: ok ? "ok" : "invalid_tx_hash_format", chain: safeChain, normalizedHash: txHash };
  }

  const genericOk = txHash.length >= 24 && txHash.length <= 256;
  return {
    ok: genericOk,
    reason: genericOk ? "ok" : "invalid_tx_hash_format",
    chain: safeChain || "UNKNOWN",
    normalizedHash: txHash
  };
}

async function fetchJson(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      payload
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyOnchain(chain, txHash, options = {}) {
  const enabled = options.enabled === true;
  const timeoutMs = Math.max(2000, Number(options.timeoutMs || 7000));
  if (!enabled) {
    return { status: "skipped", reason: "disabled" };
  }

  const safeChain = normalizeChain(chain);
  const normalized = normalizeHash(safeChain, txHash);

  try {
    if (safeChain === "BTC") {
      const out = await fetchJson(`https://blockstream.info/api/tx/${normalized}`, {}, timeoutMs);
      if (!out.ok) {
        return { status: "not_found", provider: "blockstream", httpStatus: out.status };
      }
      const confirmed = Boolean(out.payload?.status?.confirmed);
      return { status: confirmed ? "confirmed" : "found_unconfirmed", provider: "blockstream" };
    }

    if (safeChain === "ETH") {
      const out = await fetchJson(
        `https://api.blockchair.com/ethereum/dashboards/transaction/${normalized}`,
        {},
        timeoutMs
      );
      if (!out.ok) {
        return { status: "not_found", provider: "blockchair", httpStatus: out.status };
      }
      const row = out.payload?.data?.[normalized.toLowerCase()] || out.payload?.data?.[normalized];
      if (!row) {
        return { status: "not_found", provider: "blockchair", httpStatus: out.status };
      }
      const tx = row.transaction || {};
      const blockId = Number(tx.block_id || 0);
      return { status: blockId > 0 ? "confirmed" : "found_unconfirmed", provider: "blockchair" };
    }

    if (safeChain === "TRX") {
      const out = await fetchJson(`https://api.trongrid.io/v1/transactions/${normalized}`, {}, timeoutMs);
      if (!out.ok) {
        return { status: "not_found", provider: "trongrid", httpStatus: out.status };
      }
      const rows = Array.isArray(out.payload?.data) ? out.payload.data : [];
      if (rows.length === 0) {
        return { status: "not_found", provider: "trongrid", httpStatus: out.status };
      }
      const confirmed = rows[0]?.ret?.[0]?.contractRet === "SUCCESS";
      return { status: confirmed ? "confirmed" : "found_unconfirmed", provider: "trongrid" };
    }

    if (safeChain === "SOL") {
      const out = await fetchJson(
        "https://api.mainnet-beta.solana.com",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getTransaction",
            params: [normalized, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }]
          })
        },
        timeoutMs
      );
      if (!out.ok) {
        return { status: "not_found", provider: "solana-rpc", httpStatus: out.status };
      }
      if (out.payload?.result) {
        return { status: "confirmed", provider: "solana-rpc" };
      }
      return { status: "not_found", provider: "solana-rpc", httpStatus: out.status };
    }

    return { status: "unsupported", provider: "none" };
  } catch (err) {
    return {
      status: "error",
      provider: "network",
      message: String(err?.message || err || "verify_failed")
    };
  }
}

module.exports = {
  normalizeChain,
  normalizeHash,
  validateTxHash,
  verifyOnchain
};

