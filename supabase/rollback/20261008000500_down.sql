-- Roll back 0005 (public abuse controls). Run this before 20261008000400_down.sql.
-- Removes the rate limiter, the submission idempotency keys and the purge
-- function. Articles created through create_submission_idempotent are normal
-- articles and are kept; only their idempotency rows (hashes) go away.
-- After this rollback the deployed public-api can no longer submit with an
-- idempotency key or enforce limits: roll the functions back first.
begin;
drop function if exists public.purge_abuse_controls(interval);
drop function if exists public.create_submission_idempotent(jsonb, jsonb, jsonb, text, text);
drop function if exists public.consume_rate_limit(text, text, integer, integer);
drop table if exists public.submission_idempotency;
drop table if exists public.rate_limit_counters;
commit;
