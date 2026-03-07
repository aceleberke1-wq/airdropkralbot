const localeContract = require("../../../packages/shared/src/localeContract");

const { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage, pickLocalizedText } = localeContract;

function pickLanguageFromCtx(ctx, fallback = DEFAULT_LANGUAGE) {
  const from = String(ctx?.from?.language_code || "").trim();
  return normalizeLanguage(from, fallback);
}

function localizeText(input, lang = DEFAULT_LANGUAGE) {
  return pickLocalizedText(input, lang);
}

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  pickLanguageFromCtx,
  localizeText
};
