"use strict";

function toInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function firstRow(result, fallback = null) {
  if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
    return fallback;
  }
  return result.rows[0];
}

module.exports = {
  firstRow,
  toBoolean,
  toInteger
};
