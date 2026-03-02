"use strict";

function registerAdminSystemOpsRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const requireTables = deps.requireTables;
  const parseAdminId = deps.parseAdminId;

  if (!pool || typeof pool.query !== "function") {
    throw new Error("registerAdminSystemOpsRoutes requires pool.query");
  }
  if (typeof requireTables !== "function") {
    throw new Error("registerAdminSystemOpsRoutes requires requireTables");
  }
  if (typeof parseAdminId !== "function") {
    throw new Error("registerAdminSystemOpsRoutes requires parseAdminId");
  }

  fastify.post(
    "/admin/configs",
    {
      schema: {
        body: {
          type: "object",
          required: ["config_key", "version", "config_json"],
          properties: {
            config_key: { type: "string" },
            version: { type: "integer" },
            config_json: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requireTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }

      const { config_key: configKey, version, config_json: configJson } = request.body;
      const adminId = parseAdminId(request);
      await pool.query(
        `INSERT INTO config_versions (config_key, version, config_json, created_by)
         VALUES ($1, $2, $3::jsonb, $4);`,
        [configKey, version, JSON.stringify(configJson), adminId]
      );
      reply.code(201).send({ success: true, data: { config_key: configKey, version } });
    }
  );

  fastify.get("/admin/configs/:key", async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }
    const key = request.params.key;
    const result = await pool.query(
      `SELECT config_key, version, config_json, created_at, created_by
       FROM config_versions
       WHERE config_key = $1
       ORDER BY version DESC, created_at DESC
       LIMIT 1;`,
      [key]
    );
    const row = result.rows[0];
    if (!row) {
      reply.code(404).send({ success: false, error: "not_found" });
      return;
    }
    reply.send({
      success: true,
      data: {
        config_key: row.config_key,
        version: row.version,
        config_json: row.config_json,
        created_at: row.created_at,
        created_by: row.created_by
      }
    });
  });

  fastify.post(
    "/admin/offers",
    {
      schema: {
        body: {
          type: "object",
          required: ["offer_type", "price", "currency", "benefit_json"],
          properties: {
            offer_type: { type: "string" },
            price: { type: "number" },
            currency: { type: "string" },
            benefit_json: { type: "object" },
            start_at: { type: "string" },
            end_at: { type: "string" },
            limits_json: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requireTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }
      const body = request.body;
      const result = await pool.query(
        `INSERT INTO offers (offer_type, price, currency, benefit_json, start_at, end_at, limits_json)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)
         RETURNING id, offer_type, price, currency, benefit_json, start_at, end_at;`,
        [
          body.offer_type,
          body.price,
          body.currency,
          JSON.stringify(body.benefit_json || {}),
          body.start_at || null,
          body.end_at || null,
          JSON.stringify(body.limits_json || {})
        ]
      );
      reply.code(201).send({ success: true, data: result.rows[0] });
    }
  );

  fastify.get("/admin/offers", async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }
    const result = await pool.query(
      `SELECT id, offer_type, price, currency, benefit_json, start_at, end_at
       FROM offers
       ORDER BY id DESC
       LIMIT 100;`
    );
    reply.send({ success: true, data: result.rows });
  });

  fastify.post(
    "/admin/system/freeze",
    {
      schema: {
        body: {
          type: "object",
          required: ["freeze"],
          properties: {
            freeze: { type: "boolean" },
            reason: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requireTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }
      const adminId = parseAdminId(request);
      const freeze = Boolean(request.body.freeze);
      const reason = request.body.reason || "";
      const stateJson = { freeze, reason, updated_by: adminId, updated_at: new Date().toISOString() };
      await pool.query(
        `INSERT INTO system_state (state_key, state_json, updated_by)
         VALUES ('freeze', $1::jsonb, $2)
         ON CONFLICT (state_key)
         DO UPDATE SET state_json = EXCLUDED.state_json,
                       updated_by = EXCLUDED.updated_by,
                       updated_at = now();`,
        [JSON.stringify(stateJson), adminId]
      );

      await pool.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'system_freeze_toggle', 'system_state:freeze', $2::jsonb);`,
        [adminId, JSON.stringify(stateJson)]
      );
      reply.send({ success: true, data: stateJson });
    }
  );

  fastify.get("/admin/system/state", async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }

    const freezeRes = await pool.query(
      `SELECT state_json, updated_at, updated_by
       FROM system_state
       WHERE state_key = 'freeze';`
    );
    const configRes = await pool.query(
      `SELECT DISTINCT ON (config_key) config_key, version, created_at
       FROM config_versions
       ORDER BY config_key, version DESC, created_at DESC;`
    );

    const freezeRow = freezeRes.rows[0];
    const freezeState = freezeRow
      ? {
          freeze: Boolean(freezeRow.state_json?.freeze),
          reason: freezeRow.state_json?.reason || "",
          updated_at: freezeRow.updated_at,
          updated_by: freezeRow.updated_by
        }
      : { freeze: false, reason: "", updated_at: null, updated_by: 0 };

    reply.send({
      success: true,
      data: {
        freeze: freezeState,
        active_configs: configRes.rows
      }
    });
  });
}

module.exports = {
  registerAdminSystemOpsRoutes
};
