-- Ensure a user cannot hold multiple active payout requests for same currency.
-- If historical duplicates exist, keep the newest active request and reject older ones.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, currency
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM payout_requests
  WHERE status IN ('requested', 'pending', 'approved')
)
UPDATE payout_requests
SET status = 'rejected'
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_active_user_currency_uniq
  ON payout_requests(user_id, currency)
  WHERE status IN ('requested', 'pending', 'approved');
