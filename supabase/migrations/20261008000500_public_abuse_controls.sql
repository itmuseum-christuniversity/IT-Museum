-- =============================================================================
-- 0005 · Abuse controls for the unauthenticated public API.
--
-- * rate_limit_counters + consume_rate_limit(): a fixed-window counter keyed
--   by (bucket, key_hash, window_start). The public-api function calls it for
--   hashed client IPs, hashed submitter emails and a global submission cap.
--   Only HMAC/SHA-256 hex digests are accepted as keys (CHECK constraint), so
--   a raw IP address or email can never be stored here by mistake.
--   Counting is a single INSERT ... ON CONFLICT DO UPDATE, which takes the row
--   lock, so concurrent calls for the same key are serialised and every call
--   sees a distinct count (no lost updates, no read-then-write race).
-- * submission_idempotency + create_submission_idempotent(): a retried
--   submission that carries the same client idempotency key returns the
--   original article instead of creating a second one (and queueing a second
--   email). The key row is inserted in the same transaction as the article, so
--   a concurrent duplicate waits for the first transaction and then sees it.
--   Only SHA-256 digests of the key and of the request are stored.
-- * purge_abuse_controls(): removes finished rate-limit windows and old
--   idempotency rows. Run it daily (README → "Abuse limits"); nothing breaks
--   if it is not scheduled, the tables just grow slowly (consume_rate_limit
--   also deletes the finished windows of the key it touches).
--
-- Tables have RLS on and no policies; browser roles have no grants. Functions
-- are SECURITY DEFINER with a pinned search_path and executable by
-- service_role only (Edge Functions).
--
-- Idempotent. Rollback: supabase/rollback/20261008000500_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rate limiting
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
    bucket text not null check (bucket ~ '^[a-z0-9_:.-]{1,64}$'),
    key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
    window_start timestamptz not null,
    expires_at timestamptz not null,
    hits integer not null default 0,
    primary key (bucket, key_hash, window_start)
);
create index if not exists rate_limit_counters_expires_idx on public.rate_limit_counters (expires_at);

alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_counters to service_role;

-- Count one hit for (bucket, key) in the current fixed window of
-- p_window_seconds and say whether it is within p_max. Denied hits are counted
-- too (a client hammering the endpoint stays limited until the window ends).
create or replace function public.consume_rate_limit(p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer)
returns table (allowed boolean, current_hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
#variable_conflict use_column
declare
    v_now timestamptz := clock_timestamp();
    v_start timestamptz;
    v_end timestamptz;
    v_hits integer;
begin
    if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 31 * 86400 then
        raise exception 'RATE_LIMIT_ARGS: window must be between 1 second and 31 days' using errcode = '22023';
    end if;
    if p_max is null or p_max < 1 then
        raise exception 'RATE_LIMIT_ARGS: max must be at least 1' using errcode = '22023';
    end if;
    v_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);
    v_end := v_start + make_interval(secs => p_window_seconds);

    insert into public.rate_limit_counters as c (bucket, key_hash, window_start, expires_at, hits)
    values (p_bucket, p_key_hash, v_start, v_end, 1)
    on conflict (bucket, key_hash, window_start) do update set hits = c.hits + 1
    returning c.hits into v_hits;

    -- Keep the table small without a scheduler: drop this key's finished windows.
    delete from public.rate_limit_counters r
    where r.bucket = p_bucket and r.key_hash = p_key_hash and r.expires_at <= v_now;

    return query select
        v_hits <= p_max,
        v_hits,
        case when v_hits <= p_max then 0
             else greatest(1, ceil(extract(epoch from (v_end - v_now)))::integer) end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Idempotent submissions
-- ---------------------------------------------------------------------------
create table if not exists public.submission_idempotency (
    key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
    request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
    article_id uuid references public.articles (id) on delete cascade,
    created_at timestamptz not null default now()
);
create index if not exists submission_idempotency_created_idx on public.submission_idempotency (created_at);

alter table public.submission_idempotency enable row level security;
revoke all on public.submission_idempotency from public, anon, authenticated;
grant select, insert, update, delete on public.submission_idempotency to service_role;

-- Returns {"duplicate": false, "article": {...}} for a new submission, or
-- {"duplicate": true, "article_id", "request_hash", "created_at"} when the
-- key was already used. Nothing is written on a duplicate.
create or replace function public.create_submission_idempotent(
    p_row jsonb, p_event jsonb, p_notifications jsonb, p_key_hash text, p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v public.articles;
    r public.submission_idempotency;
begin
    -- Blocks on a concurrent uncommitted insert of the same key, then either
    -- conflicts (the other committed) or proceeds (the other rolled back).
    insert into public.submission_idempotency (key_hash, request_hash)
    values (p_key_hash, p_request_hash)
    on conflict (key_hash) do nothing;
    if not found then
        select * into r from public.submission_idempotency where key_hash = p_key_hash;
        return jsonb_build_object('duplicate', true, 'article_id', r.article_id, 'request_hash', r.request_hash, 'created_at', r.created_at);
    end if;

    v := public.create_submission(p_row, p_event, p_notifications);
    update public.submission_idempotency set article_id = v.id where key_hash = p_key_hash;
    return jsonb_build_object('duplicate', false, 'article', to_jsonb(v));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Clean-up (TTL)
-- ---------------------------------------------------------------------------
create or replace function public.purge_abuse_controls(p_idempotency_max_age interval default interval '7 days')
returns table (rate_limit_rows integer, idempotency_rows integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_rl integer;
    v_idem integer;
begin
    delete from public.rate_limit_counters where expires_at <= clock_timestamp();
    get diagnostics v_rl = row_count;
    delete from public.submission_idempotency where created_at < clock_timestamp() - p_idempotency_max_age;
    get diagnostics v_idem = row_count;
    return query select v_rl, v_idem;
end $$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_submission_idempotent(jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.purge_abuse_controls(interval) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.create_submission_idempotent(jsonb, jsonb, jsonb, text, text) to service_role;
grant execute on function public.purge_abuse_controls(interval) to service_role;
