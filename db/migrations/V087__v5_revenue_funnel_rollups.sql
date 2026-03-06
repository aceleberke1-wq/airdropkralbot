-- V5.6 Revenue funnel rollup views.

CREATE OR REPLACE VIEW v5_revenue_funnel_rollups_hourly AS
WITH classified AS (
  SELECT
    uid,
    COALESCE(client_ts, created_at) AS event_at,
    COALESCE(NULLIF(variant_key, ''), 'control') AS variant_key,
    COALESCE(NULLIF(funnel_key, ''), 'default') AS funnel_key,
    COALESCE(value_usd, 0)::numeric(24,8) AS value_usd,
    CASE
      WHEN economy_event_key IN ('token_intent', 'buy_intent', 'token_buy_intent') THEN 'intent'
      WHEN economy_event_key IN ('tx_submit', 'token_tx_submit') THEN 'tx_submit'
      WHEN economy_event_key IN ('approved', 'token_approved') THEN 'approved'
      WHEN economy_event_key IN ('pass_purchase') THEN 'pass_purchase'
      WHEN economy_event_key IN ('cosmetic_purchase') THEN 'cosmetic_purchase'
      WHEN event_key IN ('token_buy_intent', 'vault_buy_intent') THEN 'intent'
      WHEN event_key IN ('token_submit_tx', 'vault_submit_tx') THEN 'tx_submit'
      WHEN event_key IN ('token_auto_approved', 'token_purchase_approved') THEN 'approved'
      WHEN event_key IN ('pass_purchase', 'monetization_pass_purchase') THEN 'pass_purchase'
      WHEN event_key IN ('cosmetic_purchase', 'monetization_cosmetic_purchase') THEN 'cosmetic_purchase'
      ELSE NULL
    END AS stage_key
  FROM v5_webapp_ui_events
)
SELECT
  date_trunc('hour', event_at) AS bucket_ts,
  variant_key,
  funnel_key,
  stage_key,
  COUNT(*)::bigint AS event_count,
  COUNT(DISTINCT uid)::bigint AS unique_users,
  COALESCE(SUM(value_usd), 0)::numeric(24,8) AS value_usd_total
FROM classified
WHERE stage_key IS NOT NULL
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW v5_revenue_funnel_rollups_daily AS
WITH classified AS (
  SELECT
    uid,
    COALESCE(client_ts, created_at) AS event_at,
    COALESCE(NULLIF(variant_key, ''), 'control') AS variant_key,
    COALESCE(NULLIF(funnel_key, ''), 'default') AS funnel_key,
    COALESCE(value_usd, 0)::numeric(24,8) AS value_usd,
    CASE
      WHEN economy_event_key IN ('token_intent', 'buy_intent', 'token_buy_intent') THEN 'intent'
      WHEN economy_event_key IN ('tx_submit', 'token_tx_submit') THEN 'tx_submit'
      WHEN economy_event_key IN ('approved', 'token_approved') THEN 'approved'
      WHEN economy_event_key IN ('pass_purchase') THEN 'pass_purchase'
      WHEN economy_event_key IN ('cosmetic_purchase') THEN 'cosmetic_purchase'
      WHEN event_key IN ('token_buy_intent', 'vault_buy_intent') THEN 'intent'
      WHEN event_key IN ('token_submit_tx', 'vault_submit_tx') THEN 'tx_submit'
      WHEN event_key IN ('token_auto_approved', 'token_purchase_approved') THEN 'approved'
      WHEN event_key IN ('pass_purchase', 'monetization_pass_purchase') THEN 'pass_purchase'
      WHEN event_key IN ('cosmetic_purchase', 'monetization_cosmetic_purchase') THEN 'cosmetic_purchase'
      ELSE NULL
    END AS stage_key
  FROM v5_webapp_ui_events
)
SELECT
  date_trunc('day', event_at) AS bucket_day,
  variant_key,
  funnel_key,
  stage_key,
  COUNT(*)::bigint AS event_count,
  COUNT(DISTINCT uid)::bigint AS unique_users,
  COALESCE(SUM(value_usd), 0)::numeric(24,8) AS value_usd_total
FROM classified
WHERE stage_key IS NOT NULL
GROUP BY 1, 2, 3, 4;

