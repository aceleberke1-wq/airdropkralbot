const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  summarizeAssetSourceCatalog
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
