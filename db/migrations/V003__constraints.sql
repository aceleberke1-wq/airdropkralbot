-- V003__constraints.sql
ALTER TABLE task_attempts
  ADD CONSTRAINT task_attempts_result_chk
  CHECK (result IN ('pending','success','fail','near_miss'));

ALTER TABLE payout_requests
  ADD CONSTRAINT payout_status_chk
  CHECK (status IN ('requested','pending','approved','rejected','paid'));