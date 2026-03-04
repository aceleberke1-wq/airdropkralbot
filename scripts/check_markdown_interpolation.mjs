import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const TARGET_FILES = [path.join(repoRoot, "apps", "bot", "src", "index.js")];
const RISKY_TEMPLATE_EXPR = /\$\{\s*(?:payload\.(?:error|reason|message)|result\.reason|action|profile\.public_name)/i;

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const findings = [];
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = String(lines[idx] || "");
    if (!line.includes("replyWithMarkdown")) {
      continue;
    }
    if (!line.includes("${")) {
      continue;
    }
    if (!RISKY_TEMPLATE_EXPR.test(line)) {
      continue;
    }
    if (line.includes("escapeMarkdownText(")) {
      continue;
    }
    findings.push({
      file: filePath,
      line: idx + 1,
      snippet: line.trim()
    });
  }
  return findings;
}

function main() {
  const allFindings = TARGET_FILES.flatMap((filePath) => scanFile(filePath));
  if (allFindings.length === 0) {
    console.log("[ok] markdown interpolation check passed");
    return;
  }
  console.error(`[err] markdown interpolation risk count=${allFindings.length}`);
  for (const finding of allFindings) {
    console.error(`[risk] ${finding.file}:${finding.line} :: ${finding.snippet}`);
  }
  process.exitCode = 1;
}

main();
