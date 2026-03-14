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

function readNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DISTRICT_ASSET_FAMILY_OFFSETS = {
  travel: [-1.28, -0.24, -0.92],
  duel: [1.52, -0.28, 1.18],
  claim: [-1.46, -0.2, 1.12],
  wallet: [1.48, -0.2, -1.16],
  runtime: [0.92, -0.18, -1.64],
  default: [1.12, -0.18, 0.94]
};

function readFamilyOffset(familyKey) {
  const normalized = readText(familyKey).toLowerCase();
  return readVec3(DISTRICT_ASSET_FAMILY_OFFSETS[normalized], DISTRICT_ASSET_FAMILY_OFFSETS.default);
}

function resolveAssetAnchorCluster(worldState, familyKey) {
  const clusters = asRows(worldState?.interaction_clusters).map((row) => asRecord(row));
  const activeClusterKey = readText(worldState?.active_cluster_key);
  const activeCluster = clusters.find((row) => readText(row.cluster_key) === activeClusterKey) || null;
  const activeFamilyKey = readText(
    worldState?.active_cluster_primary_family_key,
    worldState?.active_cluster_family_key,
    activeCluster?.primary_family_key,
    activeCluster?.family_key
  );
  if (activeCluster && familyKey && activeFamilyKey === familyKey) {
    return activeCluster;
  }
  return (
    clusters.find((row) => readText(row.primary_family_key, row.family_key) === familyKey) ||
    activeCluster ||
    null
  );
}

function resolveAssetAnchorHotspot(worldState, clusterKey) {
  const hotspots = asRows(worldState?.hotspots).map((row) => asRecord(row));
  if (!clusterKey) {
    return hotspots.find((row) => !row.is_secondary) || null;
  }
  return (
    hotspots.find((row) => readText(row.cluster_key) === clusterKey && !row.is_secondary) ||
    hotspots.find((row) => readText(row.cluster_key) === clusterKey) ||
    null
  );
}

export function resolveDistrictSceneAssetRuntimeRows(input = {}) {
  const worldState = asRecord(input.worldState);
  const activeFamilyKey = readText(worldState.active_cluster_primary_family_key, worldState.active_cluster_family_key);
  return resolveDistrictSceneAssetRows(input).map((row) => {
    const assetRow = asRecord(row);
    const familyKey = readText(assetRow.family_key);
    const cluster = resolveAssetAnchorCluster(worldState, familyKey);
    const hotspot = resolveAssetAnchorHotspot(worldState, readText(cluster?.cluster_key));
    const anchorKind = cluster ? "cluster" : hotspot ? "hotspot" : "manifest";
    const originPosition = cluster
      ? [readNum(cluster.x), readNum(cluster.y), readNum(cluster.z)]
      : hotspot
        ? [readNum(hotspot.x), readNum(hotspot.y), readNum(hotspot.z)]
        : readVec3(assetRow.position, [0, 0, 0]);
    const offset = readFamilyOffset(familyKey);
    return {
      ...assetRow,
      anchor_kind: anchorKind,
      anchor_key: readText(cluster?.cluster_key, hotspot?.key, assetRow.district_key),
      anchor_family_key: readText(cluster?.primary_family_key, cluster?.family_key, familyKey),
      anchor_flow_key: readText(cluster?.primary_flow_key, cluster?.flow_key),
      anchor_focus_key: readText(cluster?.primary_focus_key, cluster?.focus_key),
      is_active_family: Boolean(familyKey && activeFamilyKey && familyKey === activeFamilyKey),
      position:
        anchorKind === "manifest"
          ? readVec3(assetRow.position, [0, 0, 0])
          : [
              originPosition[0] + offset[0],
              originPosition[1] + offset[1],
              originPosition[2] + offset[2]
            ]
    };
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
