async function getSystemState(db, key) {
  try {
    const result = await db.query(
      `SELECT state_json, updated_at, updated_by
       FROM system_state
       WHERE state_key = $1;`,
      [key]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === "42P01") {
      return null;
    }
    throw err;
  }
}

async function getFreezeState(db) {
  const row = await getSystemState(db, "freeze");
  if (!row || !row.state_json || typeof row.state_json !== "object") {
    return { freeze: false, reason: "", updated_at: null, updated_by: 0 };
  }
  return {
    freeze: Boolean(row.state_json.freeze),
    reason: row.state_json.reason || "",
    updated_at: row.updated_at || null,
    updated_by: Number(row.updated_by || 0)
  };
}

module.exports = {
  getSystemState,
  getFreezeState
};
