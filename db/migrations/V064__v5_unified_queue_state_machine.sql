-- V5.2 unified admin queue state transitions and policy reason dictionary.

CREATE TABLE IF NOT EXISTS v5_unified_admin_queue_state_transitions (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  request_id BIGINT NOT NULL,
  previous_status TEXT NOT NULL DEFAULT '',
  next_status TEXT NOT NULL DEFAULT '',
  reason_code TEXT NOT NULL DEFAULT '',
  reason_text TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  transitioned_by BIGINT NOT NULL DEFAULT 0,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL DEFAULT '',
  CONSTRAINT uq_v5_uq_transitions_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_uq_transitions_lookup
  ON v5_unified_admin_queue_state_transitions(kind, request_id, transitioned_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_uq_transitions_reason
  ON v5_unified_admin_queue_state_transitions(reason_code, transitioned_at DESC);

CREATE TABLE IF NOT EXISTS v5_unified_admin_queue_policy_reasons (
  reason_code TEXT PRIMARY KEY,
  reason_text_tr TEXT NOT NULL DEFAULT '',
  reason_text_en TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info',
  actionable BOOLEAN NOT NULL DEFAULT true,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO v5_unified_admin_queue_policy_reasons (
  reason_code,
  reason_text_tr,
  reason_text_en,
  severity,
  actionable,
  payload_json
)
VALUES
  ('requested_pending_release_policy', 'Release policy kontrolu bekleniyor.', 'Release policy check pending.', 'info', true, '{"source":"v5.2"}'::jsonb),
  ('stale_request', 'Kuyrukta bekleme suresi yuksek.', 'Queue wait time is high.', 'warn', true, '{"source":"v5.2"}'::jsonb),
  ('manual_review_required', 'Manuel admin incelemesi gerekli.', 'Manual admin review required.', 'warn', true, '{"source":"v5.2"}'::jsonb),
  ('kyc_manual_review_required', 'KYC manuel incelemesi gerekli.', 'KYC manual review required.', 'critical', true, '{"source":"v5.2"}'::jsonb),
  ('kyc_screening_blocked', 'KYC screening blocked sonucu dondu.', 'KYC screening returned blocked.', 'critical', true, '{"source":"v5.2"}'::jsonb)
ON CONFLICT (reason_code)
DO UPDATE SET
  reason_text_tr = EXCLUDED.reason_text_tr,
  reason_text_en = EXCLUDED.reason_text_en,
  severity = EXCLUDED.severity,
  actionable = EXCLUDED.actionable,
  payload_json = COALESCE(v5_unified_admin_queue_policy_reasons.payload_json, '{}'::jsonb) || EXCLUDED.payload_json,
  updated_at = now();
