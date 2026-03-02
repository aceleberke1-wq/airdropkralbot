"use strict";

const CRITICAL_ACTIONS = new Set([
  "freeze_on",
  "freeze_off",
  "payout_pay",
  "payout_reject",
  "gate_update",
  "payout_release_update"
]);

function normalizeActionKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildAdminActionSignature(actionKey, payload) {
  const action = normalizeActionKey(actionKey);
  const normalizedPayload = payload && typeof payload === "object" ? payload : {};
  const body = JSON.stringify(normalizedPayload);
  const crypto = require("crypto");
  return crypto.createHash("sha1").update(`${action}:${body}`).digest("hex");
}

function evaluateAdminPolicy(options) {
  const source = options && typeof options === "object" ? options : {};
  const actionKey = normalizeActionKey(source.action_key || source.actionKey);
  const isCritical = CRITICAL_ACTIONS.has(actionKey) || Boolean(source.critical);
  const confirmationRequired = isCritical;
  const cooldownMs = isCritical ? Math.max(1000, Number(source.cooldown_ms || source.cooldownMs || 8000)) : 0;
  return {
    action_key: actionKey,
    critical: isCritical,
    confirmation_required: confirmationRequired,
    cooldown_ms: cooldownMs
  };
}

module.exports = {
  CRITICAL_ACTIONS,
  normalizeActionKey,
  buildAdminActionSignature,
  evaluateAdminPolicy
};
