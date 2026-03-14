import test from "node:test";
import assert from "node:assert/strict";

import {
  loadDistrictSceneAssetCatalog,
  resetDistrictSceneAssetCatalogCache,
  resolveDistrictSceneAssetRows
} from "../src/core/runtime/districtSceneAssets.js";

test("resolveDistrictSceneAssetRows maps selected district bundle entries into manifest transforms", () => {
  const rows = resolveDistrictSceneAssetRows({
    districtKey: "exchange_district",
    manifest: {
      models: {
        exchange_artifact: {
          path: "/webapp/assets/exchange-artifact.glb",
          position: [7.1, -1.55, -2.1],
          rotation: [0, -0.92, 0],
          scale: [1.15, 1.15, 1.15]
        }
      }
    },
    selectedBundles: {
      rows: [
        {
          district_key: "exchange_district",
          asset_key: "exchange_artifact",
          candidate_key: "exchange_khronos_damaged_helmet",
          provider_key: "khronos_gltf_sample_models",
          file_name: "exchange-artifact.glb",
          downloaded_at: "2026-03-14"
        }
      ]
    }
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_key, "exchange_artifact");
  assert.equal(rows[0].candidate_key, "exchange_khronos_damaged_helmet");
  assert.equal(rows[0].path, "/webapp/assets/exchange-artifact.glb");
  assert.deepEqual(rows[0].position, [7.1, -1.55, -2.1]);
});

test("loadDistrictSceneAssetCatalog fetches manifest and selected bundle catalog", async () => {
  resetDistrictSceneAssetCatalogCache();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === "/webapp/assets/manifest.json") {
      return {
        ok: true,
        async json() {
          return {
            selected_bundle_catalog_path: "/webapp/assets/district-selected-bundles.json",
            models: {
              hub_beacon: { path: "/webapp/assets/hub-beacon.glb" }
            }
          };
        }
      };
    }
    if (url === "/webapp/assets/district-selected-bundles.json") {
      return {
        ok: true,
        async json() {
          return {
            rows: [{ district_key: "central_hub", asset_key: "hub_beacon", file_name: "hub-beacon.glb" }]
          };
        }
      };
    }
    return { ok: false, async json() { return {}; } };
  };

  const catalog = await loadDistrictSceneAssetCatalog(fetchImpl);
  assert.deepEqual(calls, ["/webapp/assets/manifest.json", "/webapp/assets/district-selected-bundles.json"]);
  assert.equal(catalog.manifest.selected_bundle_catalog_path, "/webapp/assets/district-selected-bundles.json");
  assert.equal(catalog.selectedBundles.rows[0].asset_key, "hub_beacon");
});
