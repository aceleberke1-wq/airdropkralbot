function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asRows(value) {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row)) : [];
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

function readVec3(value, fallback) {
  if (!Array.isArray(value) || value.length !== 3) {
    return [...fallback];
  }
  return value.map((entry, index) => {
    const parsed = Number(entry);
    return Number.isFinite(parsed) ? parsed : fallback[index];
  });
}

let districtSceneAssetCatalogPromise = null;

export function resetDistrictSceneAssetCatalogCache() {
  districtSceneAssetCatalogPromise = null;
}

export async function loadDistrictSceneAssetCatalog(fetchImpl = globalThis.fetch) {
  if (districtSceneAssetCatalogPromise) {
    return districtSceneAssetCatalogPromise;
  }
  if (typeof fetchImpl !== "function") {
    return null;
  }
  districtSceneAssetCatalogPromise = (async () => {
    const manifestRes = await fetchImpl("/webapp/assets/manifest.json", { cache: "no-store" });
    if (!manifestRes?.ok) {
      return null;
    }
    const manifest = asRecord(await manifestRes.json());
    const selectedBundlePath = readText(manifest.selected_bundle_catalog_path);
    let selectedBundles = { rows: [] };
    if (selectedBundlePath) {
      try {
        const selectedRes = await fetchImpl(selectedBundlePath, { cache: "no-store" });
        if (selectedRes?.ok) {
          selectedBundles = asRecord(await selectedRes.json());
        }
      } catch {
        selectedBundles = { rows: [] };
      }
    }
    return {
      manifest,
      selectedBundles
    };
  })();
  return districtSceneAssetCatalogPromise;
}

export function resolveDistrictSceneAssetRows(input = {}) {
  const manifest = asRecord(input.manifest);
  const selectedBundles = asRecord(input.selectedBundles);
  const districtKey = readText(input.districtKey);
  if (!districtKey) {
    return [];
  }
  const models = asRecord(manifest.models);
  return asRows(selectedBundles.rows)
    .map((row) => asRecord(row))
    .filter((row) => readText(row.district_key) === districtKey)
    .map((row) => {
      const assetKey = readText(row.asset_key);
      const model = asRecord(models[assetKey]);
      const path = readText(model.path);
      if (!assetKey || !path) {
        return null;
      }
      return {
        district_key: districtKey,
        asset_key: assetKey,
        candidate_key: readText(row.candidate_key),
        family_key: readText(row.family_key),
        file_name: readText(row.file_name),
        provider_key: readText(row.provider_key),
        provider_label: readText(row.provider_label),
        path,
        position: readVec3(model.position, [0, 0, 0]),
        rotation: readVec3(model.rotation, [0, 0, 0]),
        scale: readVec3(model.scale, [1, 1, 1]),
        downloaded_at: readText(row.downloaded_at),
        sha256: readText(row.sha256)
      };
    })
    .filter(Boolean);
}
