import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const targetDirs = [
  path.join(rootDir, "apps", "webapp", "src", "react"),
  path.join(rootDir, "apps", "admin-api", "src", "routes", "webapp", "v2"),
  path.join(rootDir, "apps", "admin-api", "src", "services", "webapp")
];

const blockedTerms = [
  String.fromCharCode(109, 111, 99, 107),
  String.fromCharCode(112, 108, 97, 99, 101, 104, 111, 108, 100, 101, 114),
  String.fromCharCode(102, 97, 107, 101),
  String.fromCharCode(100, 117, 109, 109, 121),
  String.fromCharCode(115, 116, 117, 98),
  String.fromCharCode(115, 121, 110, 116, 104, 101, 116, 105, 99)
];
const bannedPattern = new RegExp(`\\b(${blockedTerms.join("|")})\\b`, "i");
const allowedSnippets = ["sample_rate", "fallback_table_missing", "placeholder={", "placeholder=\\\""];

function listFiles(dirPath) {
  const out = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!/\.(js|ts|tsx|mjs|cjs)$/.test(entry.name)) {
        continue;
      }
      out.push(fullPath);
    }
  }
  return out;
}

function shouldSkipLine(lineText) {
  const line = String(lineText || "");
  return allowedSnippets.some((snippet) => line.includes(snippet));
}

function run() {
  const findings = [];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const files = listFiles(dir);
    for (const filePath of files) {
      const source = fs.readFileSync(filePath, "utf8");
      const lines = source.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (shouldSkipLine(line)) {
          continue;
        }
        if (bannedPattern.test(line)) {
          findings.push({
            filePath: path.relative(rootDir, filePath).replace(/\\/g, "/"),
            line: i + 1,
            text: line.trim().slice(0, 160)
          });
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error("[real-data-gate] blocked keywords found:");
    findings.slice(0, 60).forEach((row) => {
      console.error(`  - ${row.filePath}:${row.line} ${row.text}`);
    });
    process.exit(1);
  }

  console.log("[real-data-gate] PASS");
}

run();
