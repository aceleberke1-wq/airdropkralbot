"use strict";

const DEFAULT_LANGUAGE = "tr";
const SUPPORTED_LANGUAGES = Object.freeze(["tr", "en"]);

function normalizeLanguage(rawValue, fallback = DEFAULT_LANGUAGE) {
  const raw = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (!raw) {
    const fallbackRaw = String(fallback || "")
      .trim()
      .toLowerCase();
    if (!fallbackRaw) {
      return "";
    }
    return fallbackRaw.startsWith("en") ? "en" : DEFAULT_LANGUAGE;
  }
  if (raw.startsWith("tr")) {
    return "tr";
  }
  if (raw.startsWith("en")) {
    return "en";
  }
  return String(fallback || DEFAULT_LANGUAGE).toLowerCase().startsWith("en") ? "en" : DEFAULT_LANGUAGE;
}

function resolveLocalePreference(input = {}) {
  const override = normalizeLanguage(input.override, "");
  if (override) {
    return { language: override, source: "stored_user_override" };
  }

  const telegram = normalizeLanguage(input.telegramLanguageCode, "");
  if (telegram) {
    return { language: telegram, source: "telegram_ui_language_code" };
  }

  const profile = normalizeLanguage(input.profileLocale, "");
  if (profile) {
    return { language: profile, source: "verified_profile_locale" };
  }

  const regionDefault = normalizeLanguage(input.regionDefaultLanguage, "");
  if (regionDefault) {
    return { language: regionDefault, source: "region_default_language" };
  }

  return {
    language: normalizeLanguage(input.fallback, DEFAULT_LANGUAGE),
    source: "product_default_tr"
  };
}

function pickLocalizedText(input, lang = DEFAULT_LANGUAGE) {
  if (!input || typeof input !== "object") {
    return "";
  }
  const normalized = normalizeLanguage(lang, DEFAULT_LANGUAGE);
  if (normalized === "en") {
    return String(input.en || input.tr || "");
  }
  return String(input.tr || input.en || "");
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  resolveLocalePreference,
  pickLocalizedText
};
