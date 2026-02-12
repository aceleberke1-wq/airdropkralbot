"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (/^\s*psql(\s|$)/i.test(databaseUrl)) {
  console.error("DATABASE_URL must be raw postgres URL. Do not prefix with 'psql'.");
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL === "1";
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined
});

async function scalar(client, sql) {
  const res = await client.query(sql);
  if (!res.rows || res.rows.length === 0) return "";
  const row = res.rows[0];
  const key = Object.keys(row)[0];
  return String(row[key] ?? "");
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"
    );

    const existingRows = Number(await scalar(client, "SELECT count(*) FROM schema_migrations;"));
    const schemaEmpty = Number.isFinite(existingRows) && existingRows === 0;

    if (schemaEmpty) {
      const hasUsersTable = await scalar(
        client,
        "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN '0' ELSE '1' END;"
      );
      if (hasUsersTable === "1") {
        const baseline = ["V001__init.sql", "V002__indexes.sql", "V003__constraints.sql"];
        for (const name of baseline) {
          await client.query("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING;", [name]);
          console.log(`Baselined ${name}`);
        }
      }
    }

    const migrationsDir = path.join(repoRoot, "db", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((x) => x.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of files) {
      const exists = await scalar(
        client,
        `SELECT 1 FROM schema_migrations WHERE filename = '${fileName.replace(/'/g, "''")}' LIMIT 1;`
      );
      if (exists === "1") {
        console.log(`Skipping ${fileName} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(filePath, "utf8");
      console.log(`Applying ${fileName}`);
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1);", [fileName]);
    }

    console.log("Migration completed.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
