const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  summarizeAssetSourceCatalog,
  summarizeSelectedDistrictBundles,
  summarizeVariationDistrictBundles,
  buildDistrictAssetBundleCatalog,
  buildDistrictFamilyAssetCatalog,
  buildDistrictFamilyAssetVariationCatalog,
  buildDistrictFamilyAssetFocusCatalog,
  buildDistrictFamilyAssetRuntimeCatalog
} = require("../src/services/webapp/assetManifestIntakeService");

test("summarizeAssetSourceCatalog reads curated district intake catalog", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-asset-intake-"));
  const manifestPath = path.join(tempRoot, "manifest.json");
  const intakePath = path.join(tempRoot, "district-intake.json");

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 2,
        source_catalog_path: "/webapp/assets/district-intake.json"
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    intakePath,
    JSON.stringify(
      {
        verified_at: "2026-03-14",
        candidates: [
          {
            candidate_key: "arena_quaternius_scifi_essentials",
            district_key: "arena_prime",
            family_key: "duel",
            role: "combat silhouettes",
            provider_key: "quaternius_scifi_essentials",
            provider_label: "Quaternius Sci-Fi Essentials",
            license: "CC0",
            ingest_mode: "direct_gltf",
            fit_band: "high",
            source_url: "https://quaternius.com/packs/scifiessentialskit.html"
          },
          {
            candidate_key: "hub_kenney_city_kit",
            district_key: "central_hub",
            family_key: "travel",
            role: "hub backdrop",
            provider_key: "kenney_city_kit_industrial",
            provider_label: "Kenney City Kit",
            license: "CC0",
            ingest_mode: "convert_to_glb",
            fit_band: "high",
            source_url: "https://kenney.nl/assets/city-kit-industrial"
          }
        ]
      },
      null,
      2
    )
  );

  const result = summarizeAssetSourceCatalog({
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  });

  assert.equal(result.summary.candidate_count, 2);
  assert.equal(result.summary.district_count, 2);
  assert.equal(result.summary.provider_count, 2);
  assert.equal(result.summary.verified_at, "2026-03-14");
  assert.deepEqual(result.summary.ingest_modes.sort(), ["convert_to_glb", "direct_gltf"]);
  assert.deepEqual(result.summary.licenses, ["CC0"]);
  assert.equal(result.candidates[0].district_key, "arena_prime");
  assert.equal(result.candidates[1].provider_key, "kenney_city_kit_industrial");
});

test("buildDistrictAssetBundleCatalog summarizes district bundle readiness and intake candidates", () => {
  const result = buildDistrictAssetBundleCatalog({
    manifest: {
      district_bundles: {
        arena_prime: ["arena_core", "enemy_rig"],
        mission_quarter: ["reward_crate"]
      }
    },
    assetRows: [
      { asset_key: "arena_core", exists: true },
      { asset_key: "enemy_rig", exists: false },
      { asset_key: "reward_crate", exists: false }
    ],
    candidates: [
      {
        candidate_key: "arena_quaternius_scifi_essentials",
        district_key: "arena_prime",
        provider_key: "quaternius_scifi_essentials",
        provider_label: "Quaternius Sci-Fi Essentials",
        ingest_mode: "direct_gltf",
        fit_band: "high",
        family_key: "duel",
        role: "combat silhouettes",
        source_url: "https://quaternius.com/packs/scifiessentialskit.html"
      },
      {
        candidate_key: "mission_kenney_space_station",
        district_key: "mission_quarter",
        provider_key: "kenney_space_station",
        provider_label: "Kenney Space Station Kit",
        ingest_mode: "convert_to_glb",
        fit_band: "high",
        family_key: "loot",
        role: "claim terminals",
        source_url: "https://kenney.nl/assets/space-station-kit"
      }
    ]
  });

  assert.equal(result.summary.district_count, 2);
  assert.equal(result.summary.ready_count, 0);
  assert.equal(result.summary.partial_count, 1);
  assert.equal(result.summary.intake_ready_count, 1);
  assert.equal(result.summary.bundle_asset_count, 3);
  assert.equal(result.summary.bundle_ready_count, 1);
  assert.equal(result.rows[0].district_key, "arena_prime");
  assert.equal(result.rows[0].state_key, "partial");
  assert.deepEqual(result.rows[0].missing_asset_keys, ["enemy_rig"]);
  assert.equal(result.rows[0].recommended_candidates[0].candidate_key, "arena_quaternius_scifi_essentials");
  assert.equal(result.rows[1].district_key, "mission_quarter");
  assert.equal(result.rows[1].state_key, "intake_ready");
});

test("summarizeSelectedDistrictBundles reads downloaded bundle selections", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-selected-bundles-"));
  const manifestPath = path.join(tempRoot, "manifest.json");
  const selectionPath = path.join(tempRoot, "district-selected-bundles.json");

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 3,
        selected_bundle_catalog_path: "/webapp/assets/district-selected-bundles.json"
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    selectionPath,
    JSON.stringify(
      {
        verified_at: "2026-03-14",
        rows: [
          {
            district_key: "central_hub",
            family_key: "travel",
            candidate_key: "hub_khronos_lantern_beacon",
            asset_key: "hub_beacon",
            file_name: "hub-beacon.glb",
            provider_key: "khronos_gltf_sample_models",
            provider_label: "Khronos glTF Sample Models",
            source_url: "https://github.com/KhronosGroup/glTF-Sample-Models",
            download_url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Lantern/glTF-Binary/Lantern.glb",
            sha256: "abc",
            downloaded_at: "2026-03-14"
          }
        ]
      },
      null,
      2
    )
  );

  const result = summarizeSelectedDistrictBundles({
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  });

  assert.equal(result.summary.selected_count, 1);
  assert.equal(result.summary.downloaded_count, 1);
  assert.equal(result.summary.district_count, 1);
  assert.equal(result.summary.provider_count, 1);
  assert.equal(result.rows[0].asset_key, "hub_beacon");
  assert.equal(result.rows[0].file_name, "hub-beacon.glb");
});

test("summarizeVariationDistrictBundles reads downloaded variation bundle selections", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-variation-bundles-"));
  const manifestPath = path.join(tempRoot, "manifest.json");
  const variationPath = path.join(tempRoot, "district-variation-bundles.json");

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 3,
        variation_bundle_catalog_path: "/webapp/assets/district-variation-bundles.json"
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    variationPath,
    JSON.stringify(
      {
        verified_at: "2026-03-14",
        rows: [
          {
            district_key: "arena_prime",
            family_key: "ladder",
            asset_key: "arena_scout",
            variant_key: "arena_ladder_scout",
            variant_role: "support",
            variant_tier: "secondary",
            file_name: "arena-scout.glb",
            candidate_key: "arena_khronos_buggy_scout",
            provider_key: "khronos_gltf_sample_models",
            provider_label: "Khronos glTF Sample Models",
            downloaded_at: "2026-03-14"
          }
        ]
      },
      null,
      2
    )
  );

  const result = summarizeVariationDistrictBundles({
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  });

  assert.equal(result.summary.variation_count, 1);
  assert.equal(result.summary.downloaded_count, 1);
  assert.equal(result.summary.family_count, 1);
  assert.equal(result.summary.variant_count, 1);
  assert.equal(result.rows[0].variant_key, "arena_ladder_scout");
  assert.equal(result.rows[0].variant_role, "support");
});

test("buildDistrictFamilyAssetCatalog summarizes selected district family assets", () => {
  const result = buildDistrictFamilyAssetCatalog({
    selectedRows: [
      {
        district_key: "arena_prime",
        family_key: "duel",
        asset_key: "arena_trophy",
        file_name: "arena-trophy.glb",
        candidate_key: "arena_khronos_cesium_man",
        provider_label: "Khronos glTF Sample Models",
        downloaded_at: "2026-03-14"
      },
      {
        district_key: "exchange_district",
        family_key: "wallet",
        asset_key: "exchange_artifact",
        file_name: "exchange-artifact.glb",
        candidate_key: "exchange_khronos_damaged_helmet",
        provider_label: "Khronos glTF Sample Models"
      }
    ],
    districtRows: [
      { district_key: "arena_prime", state_key: "ready", bundle_ready_count: 3, bundle_asset_count: 3, candidate_count: 2 },
      { district_key: "exchange_district", state_key: "partial", bundle_ready_count: 1, bundle_asset_count: 2, candidate_count: 2 }
    ],
    assetRows: [
      { asset_key: "arena_trophy", exists: true, file_path: "C:\\assets\\arena-trophy.glb", web_path: "assets/arena-trophy.glb" },
      { asset_key: "exchange_artifact", exists: false, file_path: "C:\\assets\\exchange-artifact.glb", web_path: "assets/exchange-artifact.glb" }
    ]
  });

  assert.equal(result.summary.row_count, 2);
  assert.equal(result.summary.district_count, 2);
  assert.equal(result.summary.family_count, 2);
  assert.equal(result.summary.ready_count, 1);
  assert.equal(result.summary.partial_count, 1);
  assert.equal(result.rows[0].focus_key, "arena_prime:duel:arena_trophy");
  assert.equal(result.rows[0].state_key, "ready");
  assert.equal(result.rows[0].exists_local, true);
  assert.equal(result.rows[1].focus_key, "exchange_district:wallet:exchange_artifact");
  assert.equal(result.rows[1].state_key, "partial");
  assert.equal(result.rows[1].exists_local, false);
});

test("buildDistrictFamilyAssetVariationCatalog summarizes secondary district family variations", () => {
  const result = buildDistrictFamilyAssetVariationCatalog({
    variationRows: [
      {
        district_key: "arena_prime",
        family_key: "ladder",
        asset_key: "arena_scout",
        variant_key: "arena_ladder_scout",
        variant_role: "support",
        file_name: "arena-scout.glb",
        candidate_key: "arena_khronos_buggy_scout",
        provider_label: "Khronos glTF Sample Models"
      },
      {
        district_key: "exchange_district",
        family_key: "premium",
        asset_key: "exchange_vial",
        variant_key: "exchange_premium_vial",
        variant_role: "ambient",
        file_name: "exchange-vial.glb",
        candidate_key: "exchange_khronos_waterbottle_vial",
        provider_label: "Khronos glTF Sample Models"
      }
    ],
    assetRows: [
      { asset_key: "arena_scout", exists: true, file_path: "C:\\assets\\arena-scout.glb", web_path: "assets/arena-scout.glb" },
      { asset_key: "exchange_vial", exists: true, file_path: "C:\\assets\\exchange-vial.glb", web_path: "assets/exchange-vial.glb" }
    ]
  });

  assert.equal(result.summary.row_count, 2);
  assert.equal(result.summary.family_count, 2);
  assert.equal(result.summary.variant_count, 2);
  assert.equal(result.summary.ready_count, 2);
  assert.equal(result.rows[0].focus_key, "arena_prime:ladder:arena_ladder_scout");
  assert.equal(result.rows[0].state_key, "ready");
  assert.equal(result.rows[1].variant_role, "ambient");
});

test("buildDistrictFamilyAssetFocusCatalog prioritizes partial asset focus rows", () => {
  const result = buildDistrictFamilyAssetFocusCatalog({
    familyRows: [
      {
        district_key: "arena_prime",
        family_key: "duel",
        asset_key: "arena_trophy",
        focus_key: "arena_prime:duel:arena_trophy",
        state_key: "ready",
        exists_local: true,
        candidate_key: "arena_khronos_cesium_man",
        file_name: "arena-trophy.glb"
      },
      {
        district_key: "exchange_district",
        family_key: "wallet",
        asset_key: "exchange_artifact",
        focus_key: "exchange_district:wallet:exchange_artifact",
        state_key: "partial",
        exists_local: false,
        candidate_key: "exchange_khronos_damaged_helmet",
        file_name: "exchange-artifact.glb"
      }
    ]
  });

  assert.equal(result.summary.row_count, 2);
  assert.equal(result.summary.contract_ready_count, 1);
  assert.equal(result.summary.partial_count, 1);
  assert.equal(result.rows[0].focus_key, "exchange_district:wallet:exchange_artifact");
  assert.equal(result.rows[0].asset_contract_ready, false);
  assert.equal(
    result.rows[0].asset_contract_signature,
    "exchange_district:wallet:exchange_artifact|partial|exchange_khronos_damaged_helmet"
  );
  assert.equal(result.rows[1].focus_key, "arena_prime:duel:arena_trophy");
  assert.equal(result.rows[1].asset_contract_ready, true);
});

test("buildDistrictFamilyAssetRuntimeCatalog combines asset focus with domain runtime", () => {
  const result = buildDistrictFamilyAssetRuntimeCatalog({
    focusRows: [
      {
        district_key: "arena_prime",
        family_key: "duel",
        asset_key: "arena_trophy",
        focus_key: "arena_prime:duel:arena_trophy",
        state_key: "ready",
        asset_contract_ready: true,
        asset_contract_signature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man",
        candidate_key: "arena_khronos_cesium_man",
        file_name: "arena-trophy.glb"
      },
      {
        district_key: "exchange_district",
        family_key: "wallet",
        asset_key: "exchange_artifact",
        focus_key: "exchange_district:wallet:exchange_artifact",
        state_key: "partial",
        asset_contract_ready: false,
        asset_contract_signature: "exchange_district:wallet:exchange_artifact|partial|exchange_khronos_damaged_helmet",
        candidate_key: "exchange_khronos_damaged_helmet",
        file_name: "exchange-artifact.glb"
      }
    ],
    webappDomainSummary: {
      host: "webapp.k99-exchange.xyz",
      state_key: "ready",
      contract_ready: true,
      runtime_guard_matches_host: true,
      health_status_code: 200,
      webapp_status_code: 200
    }
  });

  assert.equal(result.summary.row_count, 2);
  assert.equal(result.summary.contract_ready_count, 1);
  assert.equal(result.summary.domain_ready_count, 2);
  assert.equal(result.summary.partial_count, 1);
  assert.equal(result.rows[0].focus_key, "exchange_district:wallet:exchange_artifact");
  assert.equal(result.rows[0].runtime_state_key, "partial");
  assert.equal(result.rows[0].runtime_contract_ready, false);
  assert.equal(
    result.rows[0].runtime_contract_signature,
    "exchange_district:wallet:exchange_artifact|partial|ready|guard_match|exchange_khronos_damaged_helmet"
  );
  assert.equal(result.rows[1].focus_key, "arena_prime:duel:arena_trophy");
  assert.equal(result.rows[1].runtime_state_key, "ready");
  assert.equal(result.rows[1].runtime_contract_ready, true);
});
