"use strict";

function normalizeV2ErrorCode(rawError, map = {}) {
  const key = String(rawError || "").trim();
  if (!key) {
    return key;
  }
  return map[key] || key;
}

function normalizeV2Payload(payload, options = {}) {
  const out = payload && typeof payload === "object" ? payload : {};
  const actionRequestId = String(options.actionRequestId || "").trim();
  const errorMap = options.errorMap && typeof options.errorMap === "object" ? options.errorMap : {};
  if (!out.data || typeof out.data !== "object") {
    out.data = {};
  }
  out.data.api_version = "v2";
  if (actionRequestId) {
    out.data.action_request_id = actionRequestId;
  }
  if (out.success === false && out.error) {
    out.error = normalizeV2ErrorCode(out.error, errorMap);
  }
  return out;
}

module.exports = {
  normalizeV2ErrorCode,
  normalizeV2Payload
};

