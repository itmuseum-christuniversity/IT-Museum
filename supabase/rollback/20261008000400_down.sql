-- Roll back 0004 (hardening). Run this before 20261008000300_down.sql.
-- Removes 0004's objects: the indexes (the original queue index comes back),
-- the TRUNCATE trigger and the last-admin guard.
-- Deliberately kept: the pinned search_path of the SECURITY DEFINER functions
-- (0002 now sets the same value, and weakening it is never needed for
-- compatibility) and the TRUNCATE revoke (0002 never granted TRUNCATE).
begin;
drop trigger if exists staff_members_keep_an_admin on public.staff_members;
drop function if exists public.staff_members_keep_an_admin();

drop trigger if exists article_events_no_truncate on public.article_events;

drop index if exists public.articles_assignee_idx;
drop index if exists public.articles_created_at_idx;
drop index if exists public.article_events_created_at_idx;
drop index if exists public.articles_status_stage_idx;
create index if not exists articles_status_idx on public.articles (status, stage_entered_at);
commit;
