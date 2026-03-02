const DEFAULT_LANGUAGE = "tr";
const SUPPORTED_LANGUAGES = Object.freeze(["tr", "en"]);

function normalizeLanguage(rawValue, fallback = DEFAULT_LANGUAGE) {
  const raw = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (raw.startsWith("tr")) {
    return "tr";
  }
  if (raw.startsWith("en")) {
    return "en";
  }
  return fallback;
}

function pickLanguageFromCtx(ctx, fallback = DEFAULT_LANGUAGE) {
  const from = String(ctx?.from?.language_code || "").trim();
  return normalizeLanguage(from, fallback);
}

function localizeText(input, lang = DEFAULT_LANGUAGE) {
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
  pickLanguageFromCtx,
  localizeText
};

