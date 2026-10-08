-- Roll back 0002 (workflow). Run 20261008000400_down.sql and
-- 20261008000300_down.sql first.
--
-- What it does
--   * Puts the pre-migration status back (from legacy_status) on rows that
--     existed before the migration, so the old screens can read them.
--   * Rows created by the new workflow have no legacy equivalent and keep their
--     new-vocabulary status (export them first if the old screens need them).
--   * Renames the audit log and outbox (never destroys them).
--   * reference_code / legacy_status are kept; re-applying 0002 re-maps every
--     row whose status is outside the canonical vocabulary, so
--     rollback → re-apply round-trips.
--
-- DATA LOSS GUARD
--   Resetting status to legacy_status discards any workflow progress made after
--   the migration (e.g. a legacy IT_REVIEW row since advanced to LIT_REVIEW
--   goes back to ADMIN_APPROVED). If any post-migration workflow activity
--   exists (articles with version > 1, or audit events other than the
--   legacy_import ones), this script REFUSES to run unless you opt in first in
--   the same session:
--
--       set itmuseum.rollback_discard_workflow = 'on';
--
--   Either way, every articles row is snapshotted as JSON into
--   migration_backup.articles_workflow_rollback before anything changes, so the
--   discarded statuses can be restored by hand.
begin;

do $$
declare
    v_progressed integer;
    v_events integer := 0;
begin
    select count(*) into v_progressed from public.articles where version > 1;
    if to_regclass('public.article_events') is not null then
        execute 'select count(*) from public.article_events where event_type <> ''legacy_import''' into v_events;
    end if;
    if (v_progressed > 0 or v_events > 0)
       and coalesce(current_setting('itmuseum.rollback_discard_workflow', true), '') <> 'on' then
        raise exception 'Refusing to roll back 0002: % article(s) changed and % workflow event(s) were recorded after the migration. Rolling back resets their status to the legacy value. Run "set itmuseum.rollback_discard_workflow = ''on'';" first to proceed.', v_progressed, v_events
            using errcode = 'P0001';
    end if;
    if v_progressed > 0 or v_events > 0 then
        raise notice 'Rolling back 0002 with post-migration workflow data: % article(s), % event(s). Their current state is saved in migration_backup.articles_workflow_rollback.', v_progressed, v_events;
    end if;
end $$;

create table if not exists migration_backup.articles_workflow_rollback (
    id bigint generated always as identity primary key,
    rolled_back_at timestamptz not null default now(),
    article jsonb not null
);
revoke all on migration_backup.articles_workflow_rollback from public;
insert into migration_backup.articles_workflow_rollback (article)
select to_jsonb(a) from public.articles a;

alter table public.articles drop constraint if exists articles_status_check_v2;
alter table public.articles drop constraint if exists articles_return_stage_check;
alter table public.articles drop constraint if exists articles_rejected_stage_check;
update public.articles set status = legacy_status where legacy_status is not null;
-- file_url, similarity_report_url and ai_report_url were never modified.
drop function if exists public.apply_article_change(uuid, text, integer, text, jsonb, jsonb, jsonb);
drop function if exists public.create_submission(jsonb, jsonb, jsonb);
drop function if exists public.claim_notifications(integer);

-- The audit log and outbox are kept (renamed) rather than destroyed. Their
-- named indexes are renamed too, so re-applying 0002 can create fresh ones
-- (index names are unique per schema). A second rollback gets a timestamp
-- suffix instead of failing on the existing *_rolled_back names.
do $$
declare
    v_suffix text := '_rolled_back';
begin
    if to_regclass('public.article_events_rolled_back') is not null
       or to_regclass('public.notification_outbox_rolled_back') is not null then
        v_suffix := '_rolled_back_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
    end if;
    if to_regclass('public.article_events') is not null then
        execute format('alter table public.article_events rename to %I', 'article_events' || v_suffix);
    end if;
    if to_regclass('public.article_events_article_idx') is not null then
        execute format('alter index public.article_events_article_idx rename to %I', 'article_events' || v_suffix || '_article_idx');
    end if;
    if to_regclass('public.notification_outbox') is not null then
        execute format('alter table public.notification_outbox rename to %I', 'notification_outbox' || v_suffix);
    end if;
    if to_regclass('public.notification_outbox_due_idx') is not null then
        execute format('alter index public.notification_outbox_due_idx rename to %I', 'notification_outbox' || v_suffix || '_due_idx');
    end if;
end $$;
commit;
-- A full restore is also possible from migration_backup.articles_20261008.
