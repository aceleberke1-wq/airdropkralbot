const fs = require("node:fs");
const path = require("node:path");

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function readText(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function resolveCatalogPath(manifestPath, manifest) {
  const manifestDir = path.dirname(String(manifestPath || ""));
  const rawPath = readText(manifest?.source_catalog_path, "district-intake.json");
  if (!rawPath) {
    return "";
  }
  const trimmed = rawPath.replace(/^\/+/, "");
  if (trimmed.startsWith("webapp/assets/")) {
    return path.join(manifestDir, trimmed.slice("webapp/assets/".length));
  }
  return path.isAbsolute(rawPath) ? rawPath : path.join(manifestDir, rawPath);
}

function summarizeAssetSourceCatalog({ manifestPath, manifest }) {
  const catalogPath = resolveCatalogPath(manifestPath, manifest);
  if (!catalogPath || !fs.existsSync(catalogPath)) {
    return {
      catalog_path: catalogPath,
      candidates: [],
      summary: {
        candidate_count: 0,
        district_count: 0,
        provider_count: 0,
        verified_at: "",
        ingest_modes: [],
        licenses: [],
        districts: [],
        providers: []
      }
    };
  }

  let parsed = {};
  try {
    parsed = asRecord(JSON.parse(fs.readFileSync(catalogPath, "utf8")));
  } catch {
    parsed = {};
  }

  const candidates = asList(parsed.candidates).map((candidate) => {
    const row = asRecord(candidate);
    return {
      candidate_key: readText(row.candidate_key),
      district_key: readText(row.district_key),
      family_key: readText(row.family_key),
      role: readText(row.role),
      provider_key: readText(row.provider_key),
      provider_label: readText(row.provider_label),
      license: readText(row.license),
      ingest_mode: readText(row.ingest_mode),
      fit_band: readText(row.fit_band),
      source_url: readText(row.source_url),
      notes: readText(row.notes)
    };
  });

  const providers = [...new Set(candidates.map((row) => row.provider_key || row.provider_label).filter(Boolean))];
  const districts = [...new Set(candidates.map((row) => row.district_key).filter(Boolean))];
  const ingestModes = [...new Set(candidates.map((row) => row.ingest_mode).filter(Boolean))];
  const licenses = [...new Set(candidates.map((row) => row.license).filter(Boolean))];

  return {
    catalog_path: catalogPath,
    candidates,
    summary: {
      candidate_count: candidates.length,
      district_count: districts.length,
      provider_count: providers.length,
      verified_at: readText(parsed.verified_at),
      ingest_modes: ingestModes,
      licenses,
      districts,
      providers
    }
  };
}

module.exports = {
  summarizeAssetSourceCatalog
};
