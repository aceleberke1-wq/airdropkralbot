const { Pool } = require("pg");

function createPool({ databaseUrl, ssl }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : undefined
  });

  pool.on("error", (err) => {
    console.error("Postgres pool error", err);
  });

  return pool;
}

async function ping(pool) {
  await pool.query("SELECT 1;");
}

async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createPool,
  ping,
  withTransaction
};