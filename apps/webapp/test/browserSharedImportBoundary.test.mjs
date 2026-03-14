import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const WEBAPP_SRC_ROOT = path.resolve(process.cwd(), "apps/webapp/src");
const FORBIDDEN_IMPORT = /packages\/shared\/src\/.+\.js/;
const ALLOWED_EXTENSIONS = new Set([".js", ".ts", ".tsx"]);

function collectSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return ALLOWED_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

test("webapp browser source does not import shared CommonJS modules directly", () => {
  const sourceFiles = collectSourceFiles(WEBAPP_SRC_ROOT);
  const offenders = sourceFiles.filter((filePath) => {
    const content = fs.readFileSync(filePath, "utf8").replaceAll("\\", "/");
    return FORBIDDEN_IMPORT.test(content);
  });

  assert.deepEqual(offenders, []);
});
