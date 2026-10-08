-- =============================================================================
-- 0004 · Hardening: indexes, definer search_path, append-only TRUNCATE guard,
--        last-admin invariant.
--
-- * Indexes for the staff queue filters and the recent-activity feed. Plain
--   CREATE INDEX (not CONCURRENTLY): migrations run in a transaction and the
--   tables are small (a museum archive), so the brief write lock is fine.
-- * SECURITY DEFINER functions get search_path = pg_catalog, public, pg_temp
--   (pg_catalog first, pg_temp last, so no caller-created object can shadow a
--   built-in or a table). Grants are unchanged (service_role only).
-- * article_events refuses TRUNCATE (the row trigger from 0002 only covers
--   UPDATE/DELETE), and TRUNCATE is revoked from the API roles.
-- * staff_members refuses any UPDATE/DELETE that would leave zero active
--   admins. Concurrent demotions are serialised by locking the remaining
--   active admin rows (SELECT ... FOR UPDATE).
--
-- Idempotent. Rollback: supabase/rollback/20261008000400_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Indexes
-- ---------------------------------------------------------------------------
-- "Assigned to me" / "unassigned" queue filters; also serves the FK's ON DELETE SET NULL.
create index if not exists articles_assignee_idx on public.articles (assignee_id);
-- Submitted-from / submitted-to filters.
create index if not exists articles_created_at_idx on public.articles (created_at);
-- Recent activity feed: ORDER BY created_at DESC LIMIT n across all articles.
-- (article_events_article_idx leads with article_id, so it cannot serve this.)
create index if not exists article_events_created_at_idx on public.article_events (created_at desc);
-- The queue orders by stage_entered_at ASC NULLS FIRST (oldest / unknown first).
-- Replace the 0002 index (NULLS LAST by default) with one in the same order.
drop index if exists public.articles_status_idx;
create index if not exists articles_status_stage_idx on public.articles (status, stage_entered_at asc nulls first);

-- ---------------------------------------------------------------------------
-- 2. SECURITY DEFINER search_path
-- ---------------------------------------------------------------------------
alter function public.apply_article_change(uuid, text, integer, text, jsonb, jsonb, jsonb)
    set search_path = pg_catalog, public, pg_temp;
alter function public.create_submission(jsonb, jsonb, jsonb)
    set search_path = pg_catalog, public, pg_temp;
alter function public.claim_notifications(integer)
    set search_path = pg_catalog, public, pg_temp;

-- ---------------------------------------------------------------------------
-- 3. article_events is append-only, TRUNCATE included
-- ---------------------------------------------------------------------------
alter function public.article_events_immutable() set search_path = pg_catalog, public, pg_temp;

drop trigger if exists article_events_no_truncate on public.article_events;
create trigger article_events_no_truncate before truncate on public.article_events
    for each statement execute function public.article_events_immutable();

-- The trigger also stops the owner; the revoke keeps the API roles from even trying.
revoke truncate on public.article_events from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Last-admin invariant
--    Fires only when an ACTIVE ADMIN row stops being one (role changed,
--    deactivated or deleted). It then locks every other active admin row.
--    Two transactions demoting the last two admins at once cannot both pass:
--      READ COMMITTED  – the second waits for the first's row lock, re-reads
--                        the row (now demoted), finds no other admin, fails;
--                        or the two lock each other's rows and Postgres
--                        aborts one with a deadlock error (40P01);
--      REPEATABLE READ – locking a row changed by a committed concurrent
--                        transaction raises a serialization failure (40001).
--    In every case at least one active admin remains.
--    SECURITY DEFINER so the check sees every row regardless of the caller's
--    RLS (staff_members has RLS on and no policies).
-- ---------------------------------------------------------------------------
create or replace function public.staff_members_keep_an_admin() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
    if old.role = 'admin' and old.active
       and (tg_op = 'DELETE' or new.role is distinct from 'admin' or new.active is distinct from true) then
        perform 1 from public.staff_members s
        where s.role = 'admin' and s.active and s.id <> old.id
        for update;
        if not found then
            raise exception 'LAST_ADMIN: at least one active admin is required'
                using errcode = 'P0001',
                      hint = 'Make another staff member an active admin first.';
        end if;
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end $$;

revoke all on function public.staff_members_keep_an_admin() from public, anon, authenticated;

drop trigger if exists staff_members_keep_an_admin on public.staff_members;
create trigger staff_members_keep_an_admin before update or delete on public.staff_members
    for each row execute function public.staff_members_keep_an_admin();
