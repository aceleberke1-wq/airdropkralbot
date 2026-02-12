-- Loop v2 phase 1: idempotency guards and strict task state transitions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loot_reveals_task_attempt_unique'
  ) THEN
    ALTER TABLE loot_reveals
      ADD CONSTRAINT loot_reveals_task_attempt_unique UNIQUE (task_attempt_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS task_attempts_offer_user_uniq
  ON task_attempts(task_offer_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS currency_ledger_ref_event_uniq
  ON currency_ledger(ref_event_id)
  WHERE ref_event_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'task_offers_state_chk'
  ) THEN
    ALTER TABLE task_offers
      ADD CONSTRAINT task_offers_state_chk
      CHECK (offer_state IN ('offered', 'accepted', 'expired', 'consumed'));
  END IF;
END $$;
