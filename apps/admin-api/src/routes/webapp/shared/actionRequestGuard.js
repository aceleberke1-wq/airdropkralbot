"use strict";

const crypto = require("node:crypto");

const ACTION_REQUEST_ID_PATTERN = /^[a-zA-Z0-9:_-]{6,120}$/;

function normalizeActionRequestId(value) {
  const normalized = String(value || "")
    .trim()
    .slice(0, 120);
  if (!ACTION_REQUEST_ID_PATTERN.test(normalized)) {
    return "";
  }
  return normalized;
}

function stableStringify(value) {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((row) => stableStringify(row)).join(",")}]`;
  }
  const entries = Object.entries(value)
    .filter(([, row]) => row !== undefined)
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  return `{${entries.map(([key, row]) => `${JSON.stringify(key)}:${stableStringify(row)}`).join(",")}}`;
}

function buildActionPayloadHash(payload = {}) {
  return crypto.createHash("sha256").update(stableStringify(payload && typeof payload === "object" ? payload : {})).digest("hex");
}

function createRequireActionRequestIdPreValidation(options = {}) {
  const field = String(options.field || "action_request_id");
  const fallbackFields = Array.isArray(options.fallbackFields) ? options.fallbackFields.map((entry) => String(entry || "")) : [];
  const statusCode = Math.max(400, Number(options.statusCode || 400));

  return function requireActionRequestIdPreValidation(request, reply, done) {
    const body = request?.body && typeof request.body === "object" ? request.body : {};
    const candidates = [body[field], ...fallbackFields.map((candidate) => body[candidate])];
    let actionRequestId = "";
    for (const candidate of candidates) {
      actionRequestId = normalizeActionRequestId(candidate);
      if (actionRequestId) {
        break;
      }
    }
    if (!actionRequestId) {
      reply.code(statusCode).send({ success: false, error: "invalid_action_request_id" });
      return;
    }
    request.adminActionRequestId = actionRequestId;
    if (body[field] !== actionRequestId) {
      body[field] = actionRequestId;
      request.body = body;
    }
    done();
  };
}

module.exports = {
  ACTION_REQUEST_ID_PATTERN,
  normalizeActionRequestId,
  buildActionPayloadHash,
  createRequireActionRequestIdPreValidation
};
