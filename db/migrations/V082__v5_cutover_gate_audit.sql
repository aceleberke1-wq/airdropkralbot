-- V5.3 canary gate decision audit log.

CREATE TABLE IF NOT EXISTS v5_cutover_gate_audit (
  id BIGSERIAL PRIMARY KEY,
  gate_ref TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  gate_key TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'hold',
  approved_by BIGINT NOT NULL DEFAULT 0,
  previous_stage TEXT NOT NULL DEFAULT '',
  next_stage TEXT NOT NULL DEFAULT '',
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_gate_audit_stage_time
  ON v5_cutover_gate_audit(stage_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_gate_audit_gate_time
  ON v5_cutover_gate_audit(gate_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_gate_audit_decision_time
  ON v5_cutover_gate_audit(decision, created_at DESC);
