-- Prevent duplicate reward claims for the same task attempt.
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
