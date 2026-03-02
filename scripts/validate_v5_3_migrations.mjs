import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const migrationsDir = path.join(rootDir, "db", "migrations");
const rollbackDir = path.join(migrationsDir, "rollback");

const START = 73;
const END = 82;

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readFileSafe(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

function main() {
  const failures = [];
  const passes = [];

  for (let i = START; i <= END; i += 1) {
    const prefix = `V${String(i).padStart(3, "0")}__`;
    const migrationMatches = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".sql"));
    const rollbackMatches = fs
      .readdirSync(rollbackDir)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".sql"));

    if (migrationMatches.length !== 1) {
      failures.push(`${prefix}: expected 1 migration file, found ${migrationMatches.length}`);
      continue;
    }
    if (rollbackMatches.length !== 1) {
      failures.push(`${prefix}: expected 1 rollback file, found ${rollbackMatches.length}`);
      continue;
    }

    const migrationName = migrationMatches[0];
    const rollbackName = rollbackMatches[0];
    const migrationPath = path.join(migrationsDir, migrationName);
    const rollbackPath = path.join(rollbackDir, rollbackName);

    try {
      assert(fileExists(migrationPath), `${migrationName}: missing`);
      assert(fileExists(rollbackPath), `${rollbackName}: missing`);
      const migrationSql = readFileSafe(migrationPath).trim();
      const rollbackSql = readFileSafe(rollbackPath).trim();
      assert(migrationSql.length > 0, `${migrationName}: empty`);
      assert(rollbackSql.length > 0, `${rollbackName}: empty`);
      assert(
        /create|alter|insert|update|delete|drop/i.test(migrationSql),
        `${migrationName}: no SQL operation keyword detected`
      );
      assert(/drop|alter|delete/i.test(rollbackSql), `${rollbackName}: no rollback keyword detected`);
      passes.push(`${prefix}: ok (${migrationName} + ${rollbackName})`);
    } catch (err) {
      failures.push(String(err?.message || err));
    }
  }

  for (const line of passes) {
    console.log(`[ok] ${line}`);
  }

  if (failures.length > 0) {
    for (const line of failures) {
      console.error(`[fail] ${line}`);
    }
    process.exit(1);
  }

  console.log(`[done] V5.3 migration pair validation passed (${END - START + 1} pairs).`);
}

main();
