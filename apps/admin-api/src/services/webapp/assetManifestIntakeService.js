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

function toFitBandScore(value) {
  const key = readText(value).toLowerCase();
  if (key === "high") return 3;
  if (key === "medium") return 2;
  if (key === "low") return 1;
  return 0;
}

function toIngestModeScore(value) {
  const key = readText(value).toLowerCase();
  if (key === "direct_gltf") return 3;
  if (key === "catalog_export") return 2;
  if (key === "convert_to_glb") return 1;
  return 0;
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

function buildDistrictAssetBundleCatalog({ manifest, assetRows, candidates }) {
  const bundles = asRecord(manifest?.district_bundles);
  const rows = asList(assetRows).map((row) => asRecord(row));
  const candidateRows = asList(candidates).map((row) => asRecord(row));
  const assetRowByKey = new Map(rows.map((row) => [readText(row.asset_key), row]));
  const districtKeys = [...new Set([...Object.keys(bundles), ...candidateRows.map((row) => readText(row.district_key)).filter(Boolean)])];

  const districtRows = districtKeys
    .map((districtKey) => {
      const assetKeys = asList(bundles[districtKey]).map((value) => readText(value)).filter(Boolean);
      const bundleRows = assetKeys.map((assetKey) => asRecord(assetRowByKey.get(assetKey))).filter(Boolean);
      const readyCount = bundleRows.filter((row) => row.exists !== false).length;
      const candidateSet = candidateRows.filter((row) => readText(row.district_key) === districtKey);
      const providerKeys = [...new Set(candidateSet.map((row) => readText(row.provider_key, row.provider_label)).filter(Boolean))];
      const ingestModes = [...new Set(candidateSet.map((row) => readText(row.ingest_mode)).filter(Boolean))];
      const highFitCount = candidateSet.filter((row) => readText(row.fit_band).toLowerCase() === "high").length;
      const missingAssetKeys = bundleRows
        .filter((row) => readText(row.asset_key) && row.exists === false)
        .map((row) => readText(row.asset_key))
        .filter(Boolean);
      const recommendedCandidates = [...candidateSet]
        .sort((left, right) => {
          const fitDelta = toFitBandScore(right.fit_band) - toFitBandScore(left.fit_band);
          if (fitDelta) return fitDelta;
          const ingestDelta = toIngestModeScore(right.ingest_mode) - toIngestModeScore(left.ingest_mode);
          if (ingestDelta) return ingestDelta;
          return readText(left.candidate_key).localeCompare(readText(right.candidate_key));
        })
        .slice(0, 2)
        .map((row) => ({
          candidate_key: readText(row.candidate_key),
          provider_key: readText(row.provider_key),
          provider_label: readText(row.provider_label),
          ingest_mode: readText(row.ingest_mode),
          fit_band: readText(row.fit_band),
          family_key: readText(row.family_key),
          role: readText(row.role),
          source_url: readText(row.source_url)
        }));

      let stateKey = "missing";
      if (assetKeys.length > 0 && readyCount === assetKeys.length) {
        stateKey = "ready";
      } else if (readyCount > 0) {
        stateKey = "partial";
      } else if (candidateSet.length > 0) {
        stateKey = "intake_ready";
      }

      return {
        district_key: districtKey,
        state_key: stateKey,
        bundle_asset_keys: assetKeys,
        bundle_asset_count: assetKeys.length,
        bundle_ready_count: readyCount,
        bundle_missing_count: Math.max(0, assetKeys.length - readyCount),
        candidate_count: candidateSet.length,
        provider_count: providerKeys.length,
        high_fit_count: highFitCount,
        ingest_modes: ingestModes,
        missing_asset_keys: missingAssetKeys,
        recommended_candidates: recommendedCandidates
      };
    })
    .sort((left, right) => readText(left.district_key).localeCompare(readText(right.district_key)));

  const summary = {
    district_count: districtRows.length,
    ready_count: districtRows.filter((row) => row.state_key === "ready").length,
    partial_count: districtRows.filter((row) => row.state_key === "partial").length,
    intake_ready_count: districtRows.filter((row) => row.state_key === "intake_ready").length,
    missing_count: districtRows.filter((row) => row.state_key === "missing").length,
    bundle_asset_count: districtRows.reduce((sum, row) => sum + Number(row.bundle_asset_count || 0), 0),
    bundle_ready_count: districtRows.reduce((sum, row) => sum + Number(row.bundle_ready_count || 0), 0)
  };

  return {
    rows: districtRows,
    summary
  };
}

module.exports = {
  summarizeAssetSourceCatalog,
  buildDistrictAssetBundleCatalog
};
