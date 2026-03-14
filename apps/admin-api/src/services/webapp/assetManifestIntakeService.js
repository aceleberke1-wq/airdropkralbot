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

function resolveCatalogPath(manifestPath, rawPath, fallbackPath) {
  const manifestDir = path.dirname(String(manifestPath || ""));
  const resolvedRawPath = readText(rawPath, fallbackPath);
  if (!resolvedRawPath) {
    return "";
  }
  const trimmed = resolvedRawPath.replace(/^\/+/, "");
  if (trimmed.startsWith("webapp/assets/")) {
    return path.join(manifestDir, trimmed.slice("webapp/assets/".length));
  }
  return path.isAbsolute(resolvedRawPath) ? resolvedRawPath : path.join(manifestDir, resolvedRawPath);
}

function resolveSourceCatalogPath(manifestPath, manifest) {
  return resolveCatalogPath(manifestPath, manifest?.source_catalog_path, "district-intake.json");
}

function resolveSelectedBundleCatalogPath(manifestPath, manifest) {
  return resolveCatalogPath(manifestPath, manifest?.selected_bundle_catalog_path, "district-selected-bundles.json");
}

function summarizeCatalogRows(catalogPath, mapper) {
  if (!catalogPath || !fs.existsSync(catalogPath)) {
    return { catalog_path: catalogPath, parsed: {}, rows: [] };
  }
  let parsed = {};
  try {
    parsed = asRecord(JSON.parse(fs.readFileSync(catalogPath, "utf8")));
  } catch {
    parsed = {};
  }
  return {
    catalog_path: catalogPath,
    parsed,
    rows: asList(parsed.rows || parsed.candidates).map((item) => mapper(asRecord(item)))
  };
}

function summarizeAssetSourceCatalog({ manifestPath, manifest }) {
  const catalogPath = resolveSourceCatalogPath(manifestPath, manifest);
  const result = summarizeCatalogRows(catalogPath, (row) => ({
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
    notes: readText(row.notes),
    selection_state: readText(row.selection_state),
    local_asset_key: readText(row.local_asset_key)
  }));

  const candidates = result.rows;
  const parsed = result.parsed;

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

function summarizeSelectedDistrictBundles({ manifestPath, manifest }) {
  const catalogPath = resolveSelectedBundleCatalogPath(manifestPath, manifest);
  const result = summarizeCatalogRows(catalogPath, (row) => ({
    district_key: readText(row.district_key),
    family_key: readText(row.family_key),
    candidate_key: readText(row.candidate_key),
    asset_key: readText(row.asset_key),
    file_name: readText(row.file_name),
    provider_key: readText(row.provider_key),
    provider_label: readText(row.provider_label),
    license: readText(row.license),
    source_url: readText(row.source_url),
    download_url: readText(row.download_url),
    sha256: readText(row.sha256),
    downloaded_at: readText(row.downloaded_at)
  }));
  const rows = result.rows;
  const parsed = result.parsed;
  const providers = [...new Set(rows.map((row) => row.provider_key || row.provider_label).filter(Boolean))];
  const districts = [...new Set(rows.map((row) => row.district_key).filter(Boolean))];
  const downloadedCount = rows.filter((row) => row.downloaded_at && row.file_name).length;

  return {
    catalog_path: catalogPath,
    rows,
    summary: {
      selected_count: rows.length,
      downloaded_count: downloadedCount,
      district_count: districts.length,
      provider_count: providers.length,
      verified_at: readText(parsed.verified_at),
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

function buildDistrictFamilyAssetCatalog({ selectedRows, districtRows, assetRows }) {
  const selected = asList(selectedRows).map((row) => asRecord(row));
  const districts = asList(districtRows).map((row) => asRecord(row));
  const assets = asList(assetRows).map((row) => asRecord(row));
  const districtByKey = new Map(districts.map((row) => [readText(row.district_key), row]));
  const assetByKey = new Map(assets.map((row) => [readText(row.asset_key), row]));

  const rows = selected
    .map((row) => {
      const districtKey = readText(row.district_key);
      const familyKey = readText(row.family_key);
      const assetKey = readText(row.asset_key);
      if (!districtKey || !familyKey || !assetKey) {
        return null;
      }
      const district = asRecord(districtByKey.get(districtKey));
      const asset = asRecord(assetByKey.get(assetKey));
      const existsLocal = asset.exists !== false && Boolean(readText(asset.asset_key));
      const districtState = readText(district.state_key, existsLocal ? "ready" : "missing").toLowerCase();
      let stateKey = "missing";
      if (existsLocal && districtState === "ready") {
        stateKey = "ready";
      } else if (existsLocal) {
        stateKey = "partial";
      } else if (districtState === "intake_ready") {
        stateKey = "intake_ready";
      } else if (districtState === "partial") {
        stateKey = "partial";
      }
      return {
        district_key: districtKey,
        family_key: familyKey,
        asset_key: assetKey,
        focus_key: `${districtKey}:${familyKey}:${assetKey}`,
        state_key: stateKey,
        exists_local: existsLocal,
        file_name: readText(row.file_name, path.basename(readText(asset.web_path, asset.file_path, assetKey))),
        file_path: readText(asset.file_path),
        web_path: readText(asset.web_path),
        candidate_key: readText(row.candidate_key),
        provider_key: readText(row.provider_key),
        provider_label: readText(row.provider_label),
        license: readText(row.license),
        download_url: readText(row.download_url),
        downloaded_at: readText(row.downloaded_at),
        district_state_key: districtState,
        bundle_ready_count: Number(district.bundle_ready_count || 0),
        bundle_asset_count: Number(district.bundle_asset_count || 0),
        candidate_count: Number(district.candidate_count || 0)
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      `${readText(left.district_key)}:${readText(left.family_key)}:${readText(left.asset_key)}`.localeCompare(
        `${readText(right.district_key)}:${readText(right.family_key)}:${readText(right.asset_key)}`
      )
    );

  return {
    rows,
    summary: {
      row_count: rows.length,
      district_count: new Set(rows.map((row) => readText(row.district_key)).filter(Boolean)).size,
      family_count: new Set(rows.map((row) => readText(row.family_key)).filter(Boolean)).size,
      ready_count: rows.filter((row) => readText(row.state_key) === "ready").length,
      partial_count: rows.filter((row) => readText(row.state_key) === "partial").length,
      intake_ready_count: rows.filter((row) => readText(row.state_key) === "intake_ready").length,
      missing_count: rows.filter((row) => readText(row.state_key) === "missing").length
    }
  };
}

module.exports = {
  summarizeAssetSourceCatalog,
  summarizeSelectedDistrictBundles,
  buildDistrictAssetBundleCatalog,
  buildDistrictFamilyAssetCatalog
};
