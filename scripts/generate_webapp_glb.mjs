import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "apps", "webapp", "assets");

const ASSET_SOURCE = [
  {
    fileName: "arena-core.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxTextured/glTF-Binary/BoxTextured.glb"
  },
  {
    fileName: "enemy-rig.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/CesiumMan/glTF-Binary/CesiumMan.glb"
  },
  {
    fileName: "reward-crate.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb"
  },
  {
    fileName: "ambient-fx.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb"
  }
];

async function downloadFile(entry) {
  const res = await fetch(entry.url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`download_failed:${entry.fileName}:${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const targetPath = path.join(outputDir, entry.fileName);
  await writeFile(targetPath, Buffer.from(arrayBuffer));
  console.log(`[ok] ${entry.fileName} (${Math.round(arrayBuffer.byteLength / 1024)} KB)`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  for (const entry of ASSET_SOURCE) {
    await downloadFile(entry);
  }
  console.log("[done] GLB assets ready under apps/webapp/assets");
}

main().catch((error) => {
  console.error("[err] generate_webapp_glb failed:", error?.message || error);
  process.exitCode = 1;
});
