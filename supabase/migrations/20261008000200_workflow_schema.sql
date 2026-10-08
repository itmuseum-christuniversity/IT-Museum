-- =============================================================================
-- 0002 · Canonical review workflow, audit log, staff roles and outbox.
--
-- * Backs up articles/sections/authorized_users to schema migration_backup.
-- * Adds workflow columns; never drops or overwrites existing data columns
--   (file_url, similarity_report_url, ai_report_url are left untouched).
-- * Maps legacy statuses to the new queue-based statuses and records the
--   original value in legacy_status plus an immutable audit event.
-- * Adds article_events (append-only), staff_members, notification_outbox.
-- * Adds apply_article_change / create_submission, callable only by the
--   service role (Edge Functions). Concurrency is guarded by (status, version).
--
-- Idempotent: safe to re-run. Rollback: supabase/rollback/20261008000200_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Backups (first run only)
-- ---------------------------------------------------------------------------
create schema if not exists migration_backup;
revoke all on schema migration_backup from public;
create table if not exists migration_backup.articles_20261008 as table public.articles;
create table if not exists migration_backup.sections_20261008 as table public.sections;
create table if not exists migration_backup.authorized_users_20261008 as table public.authorized_users;

-- ---------------------------------------------------------------------------
-- 2. Make sure status is plain text (some hand-built schemas used an enum)
--    and drop any old CHECK constraint on it.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'articles' and column_name = 'status' and data_type = 'USER-DEFINED'
    ) then
        alter table public.articles alter column status drop default;
        alter table public.articles alter column status type text using status::text;
    end if;

    for r in
        select conname from pg_constraint
        where conrelid = 'public.articles'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%status%'
          and conname not in ('articles_status_check_v2', 'articles_return_stage_check', 'articles_rejected_stage_check')
    loop
        execute format('alter table public.articles drop constraint %I', r.conname);
    end loop;
end $$;

alter table public.articles alter column status set default 'SUBMITTED';

-- ---------------------------------------------------------------------------
-- 3. New columns
-- ---------------------------------------------------------------------------
alter table public.articles
    add column if not exists reference_code text,
    add column if not exists version integer not null default 1,
    add column if not exists legacy_status text,
    add column if not exists return_to_stage text,
    add column if not exists rejected_at_stage text,
    add column if not exists public_reason text,
    add column if not exists suggested_tags text[],
    add column if not exists authors jsonb,
    add column if not exists manuscript_url text,
    add column if not exists similarity_report_path text,
    add column if not exists ai_report_path text,
    add column if not exists staged_pdf_path text,
    add column if not exists published_pdf_path text,
    add column if not exists published_pdf_url text,
    add column if not exists assignee_id uuid,
    add column if not exists contributor_token_hash text,
    add column if not exists updated_at timestamptz,
    add column if not exists stage_entered_at timestamptz,
    add column if not exists published_at timestamptz,
    add column if not exists unpublished_at timestamptz;

create unique index if not exists articles_reference_code_key on public.articles (reference_code);
create index if not exists articles_status_idx on public.articles (status, stage_entered_at);

-- ---------------------------------------------------------------------------
-- 4. Staff roles (explicit records; replaces email-substring inference)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_members (
    id uuid primary key default gen_random_uuid(),
    firebase_uid text unique,
    email text not null unique check (email = lower(email)),
    display_name text not null,
    role text not null check (role in ('admin', 'it_reviewer', 'tech_reviewer', 'lit_reviewer')),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'articles_assignee_fk') then
        alter table public.articles
            add constraint articles_assignee_fk foreign key (assignee_id) references public.staff_members (id) on delete set null;
    end if;
end $$;

-- Bootstrap: carry over people from authorized_users with the role the old
-- email pattern implied, but INACTIVE. An admin must review and activate them
-- (README → "Granting access"). Nobody gets the old default-to-admin fallback.
insert into public.staff_members (email, display_name, role, active)
select distinct on (lower(trim(email)))
    lower(trim(email)),
    coalesce(nullif(trim(name), ''), lower(trim(email))),
    case
        when lower(email) like '%literaturereview%' or lower(email) like '%litreview%' then 'lit_reviewer'
        when lower(email) like '%technicalreview%' or lower(email) like '%techreview%' then 'tech_reviewer'
        when lower(email) like '%itreview%' then 'it_reviewer'
        when lower(email) like '%admin%' then 'admin'
    end,
    false
from public.authorized_users
where email is not null
  and (
      lower(email) like '%literaturereview%' or lower(email) like '%litreview%'
      or lower(email) like '%technicalreview%' or lower(email) like '%techreview%'
      or lower(email) like '%itreview%' or lower(email) like '%admin%'
  )
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Append-only audit log
-- ---------------------------------------------------------------------------
create table if not exists public.article_events (
    id bigint generated always as identity primary key,
    article_id uuid not null references public.articles (id) on delete restrict,
    event_type text not null check (event_type in ('submitted', 'transition', 'note', 'metadata', 'assignment', 'file', 'legacy_import')),
    action text,
    from_status text,
    to_status text,
    actor_id text not null,
    actor_role text not null,
    actor_label text,
    reason text,
    visibility text not null default 'internal' check (visibility in ('internal', 'contributor')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists article_events_article_idx on public.article_events (article_id, created_at);

create or replace function public.article_events_immutable() returns trigger
language plpgsql as $$
begin
    raise exception 'article_events is append-only';
end $$;

drop trigger if exists article_events_no_update on public.article_events;
create trigger article_events_no_update before update or delete on public.article_events
    for each row execute function public.article_events_immutable();

-- ---------------------------------------------------------------------------
-- 6. Notification outbox (delivered by the notify-worker function)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_outbox (
    id bigint generated always as identity primary key,
    article_id uuid references public.articles (id) on delete set null,
    event_id bigint references public.article_events (id) on delete set null,
    recipient text not null,
    template text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
    attempts integer not null default 0,
    last_error text,
    next_attempt_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    sent_at timestamptz
);
create index if not exists notification_outbox_due_idx on public.notification_outbox (status, next_attempt_at);

-- ---------------------------------------------------------------------------
-- 7. Legacy data migration. A row is (re)mapped when it predates the new
--    workflow (reference_code and legacy_status both null) OR when its status
--    is outside the canonical vocabulary. The second case is what makes
--    rollback → re-apply safe: 20261008000200_down.sql puts old-vocabulary
--    statuses back but leaves reference_code/legacy_status set, and the old
--    frontend may write more old statuses while rolled back. Rows already in
--    the canonical vocabulary are never touched, so a plain re-run is a no-op.
-- ---------------------------------------------------------------------------
drop table if exists _legacy_rows;
create temporary table _legacy_rows as
select id, status as old_status, legacy_status as previous_legacy_status,
       (reference_code is null and legacy_status is null) as first_import
from public.articles
where (reference_code is null and legacy_status is null)
   or status is null
   or status not in ('SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL',
                     'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED');

update public.articles a
set legacy_status = l.old_status,
    status = case upper(l.old_status)
        when 'SUBMITTED' then 'SUBMITTED'
        when 'ADMIN_APPROVED' then 'IT_REVIEW'
        when 'APPROVED_FIRST' then 'TECH_REVIEW'
        when 'IT_APPROVED' then 'TECH_REVIEW'
        when 'TECH_APPROVED' then 'LIT_REVIEW'
        when 'APPROVED_TECHNICAL' then 'LIT_REVIEW'
        when 'LIT_APPROVED' then 'FINAL_APPROVAL'
        when 'APPROVED_LITERATURE' then 'FINAL_APPROVAL'
        when 'READY_FOR_PUBLISHING' then 'FINAL_APPROVAL'
        when 'PUBLISHED' then 'PUBLISHED'
        when 'ACCEPTED' then 'PUBLISHED'
        when 'ADMIN_REJECTED' then 'REJECTED'
        when 'IT_REJECTED' then 'REJECTED'
        when 'TECH_REJECTED' then 'REJECTED'
        when 'LIT_REJECTED' then 'REJECTED'
        when 'REJECTED' then 'REJECTED'
        -- Anything unrecognised goes back to admin intake rather than vanishing.
        else 'SUBMITTED'
    end,
    -- The old screens reused rejection codes across panels:
    --   IT panel → ADMIN_REJECTED, Technical → IT_REJECTED, Literature → TECH_REJECTED,
    --   Admin triage → ADMIN_REJECTED. ADMIN_REJECTED is therefore ambiguous (NULL).
    rejected_at_stage = case upper(l.old_status)
        when 'IT_REJECTED' then 'TECH_REVIEW'
        when 'TECH_REJECTED' then 'LIT_REVIEW'
        when 'LIT_REJECTED' then 'LIT_REVIEW'
        else null
    end,
    -- Keep an existing reference (a re-mapped row, or a new-workflow row the old
    -- frontend touched while rolled back); contributors may already hold it.
    reference_code = coalesce(a.reference_code, 'ITM-LEGACY-' || upper(substr(replace(a.id::text, '-', ''), 1, 8))),
    stage_entered_at = coalesce(a.stage_entered_at, a.created_at),
    updated_at = coalesce(a.updated_at, a.created_at)
from _legacy_rows l
where a.id = l.id;

-- Keep the Google Doc and the final PDF in separate columns.
update public.articles a
set manuscript_url = a.file_url
from _legacy_rows l
where a.id = l.id and a.manuscript_url is null
  and (a.file_url ilike 'https://docs.google.com/%' or a.file_url ilike 'https://drive.google.com/%');

update public.articles a
set published_pdf_url = a.file_url,
    published_pdf_path = nullif(split_part(a.file_url, '/storage/v1/object/public/articles/', 2), '')
from _legacy_rows l
where a.id = l.id and a.status = 'PUBLISHED' and a.published_pdf_url is null
  and a.file_url ilike '%/storage/v1/object/public/articles/%';

update public.articles a
set similarity_report_path = coalesce(a.similarity_report_path, nullif(split_part(a.similarity_report_url, '/storage/v1/object/public/reports/', 2), '')),
    ai_report_path = coalesce(a.ai_report_path, nullif(split_part(a.ai_report_url, '/storage/v1/object/public/reports/', 2), ''))
from _legacy_rows l
where a.id = l.id;

-- Structured authors from the old comma-joined columns (only when unambiguous).
update public.articles a
set authors = sub.authors
from (
    select x.id, jsonb_agg(jsonb_build_object('name', trim(t.n), 'email', trim(coalesce(t.e, '')), 'designation', trim(coalesce(t.d, ''))) order by t.ord) as authors
    from public.articles x
    join _legacy_rows l on l.id = x.id
    cross join lateral unnest(
        string_to_array(x.author_name, ','),
        string_to_array(coalesce(x.institution_email, ''), ','),
        string_to_array(coalesce(x.author_designations, ''), ',')
    ) with ordinality as t(n, e, d, ord)
    where x.authors is null and coalesce(x.author_name, '') <> '' and t.n is not null
    group by x.id
) sub
where a.id = sub.id;

insert into public.article_events (article_id, event_type, from_status, to_status, actor_id, actor_role, actor_label, reason, visibility, metadata)
select a.id, 'legacy_import', null, a.status, 'migration-20261008', 'system', 'Workflow migration',
    case
        when a.legacy_status = 'ADMIN_REJECTED' then 'Rejected under the previous workflow by admin triage or the IT panel (the old code used ADMIN_REJECTED for both).'
        when a.status = 'REJECTED' then 'Rejected under the previous workflow.'
        else null
    end,
    'internal',
    jsonb_build_object('legacy_status', a.legacy_status, 'mapped_to', a.status, 'rejected_at_stage', a.rejected_at_stage, 'file_url', a.file_url)
        || case when not l.first_import
                then jsonb_build_object('remapped_after_rollback', true, 'previous_legacy_status', l.previous_legacy_status)
                else '{}'::jsonb end
from public.articles a
join _legacy_rows l on l.id = a.id;

drop table if exists _legacy_rows;

-- ---------------------------------------------------------------------------
-- 8. Constraints for the new vocabulary
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'articles_status_check_v2') then
        alter table public.articles add constraint articles_status_check_v2 check (status in (
            'SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL',
            'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'articles_return_stage_check') then
        alter table public.articles add constraint articles_return_stage_check check (
            return_to_stage is null or return_to_stage in ('SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL'));
    end if;
    if not exists (select 1 from pg_constraint where conname = 'articles_rejected_stage_check') then
        alter table public.articles add constraint articles_rejected_stage_check check (
            rejected_at_stage is null or rejected_at_stage in ('SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL'));
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Atomic workflow write (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.apply_article_change(
    p_id uuid,
    p_expected_status text,
    p_expected_version integer,
    p_new_status text,
    p_patch jsonb,
    p_event jsonb,
    p_notifications jsonb
) returns public.articles
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v public.articles;
    k text;
    v_event_id bigint;
    p jsonb := coalesce(p_patch, '{}'::jsonb);
begin
    for k in select jsonb_object_keys(p) loop
        if k not in (
            'return_to_stage', 'rejected_at_stage', 'public_reason', 'title', 'description', 'tags',
            'suggested_tags', 'author_name', 'assignee_id', 'manuscript_url', 'similarity_report_path',
            'ai_report_path', 'staged_pdf_path', 'published_pdf_path', 'published_pdf_url',
            'published_at', 'unpublished_at'
        ) then
            raise exception 'apply_article_change: column % is not patchable', k using errcode = '22023';
        end if;
    end loop;

    update public.articles a set
        status = coalesce(p_new_status, a.status),
        stage_entered_at = case when p_new_status is not null and p_new_status <> a.status then now() else a.stage_entered_at end,
        return_to_stage = case when p ? 'return_to_stage' then p->>'return_to_stage' else a.return_to_stage end,
        rejected_at_stage = case when p ? 'rejected_at_stage' then p->>'rejected_at_stage' else a.rejected_at_stage end,
        public_reason = case when p ? 'public_reason' then p->>'public_reason' else a.public_reason end,
        title = case when p ? 'title' then p->>'title' else a.title end,
        description = case when p ? 'description' then p->>'description' else a.description end,
        author_name = case when p ? 'author_name' then p->>'author_name' else a.author_name end,
        tags = case when p ? 'tags' then array(select jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb))) else a.tags end,
        suggested_tags = case when p ? 'suggested_tags' then array(select jsonb_array_elements_text(coalesce(p->'suggested_tags', '[]'::jsonb))) else a.suggested_tags end,
        assignee_id = case when p ? 'assignee_id' then (p->>'assignee_id')::uuid else a.assignee_id end,
        manuscript_url = case when p ? 'manuscript_url' then p->>'manuscript_url' else a.manuscript_url end,
        similarity_report_path = case when p ? 'similarity_report_path' then p->>'similarity_report_path' else a.similarity_report_path end,
        ai_report_path = case when p ? 'ai_report_path' then p->>'ai_report_path' else a.ai_report_path end,
        staged_pdf_path = case when p ? 'staged_pdf_path' then p->>'staged_pdf_path' else a.staged_pdf_path end,
        published_pdf_path = case when p ? 'published_pdf_path' then p->>'published_pdf_path' else a.published_pdf_path end,
        published_pdf_url = case when p ? 'published_pdf_url' then p->>'published_pdf_url' else a.published_pdf_url end,
        published_at = case when p ? 'published_at' then (case when p->>'published_at' = 'now' then now() end) else a.published_at end,
        unpublished_at = case when p ? 'unpublished_at' then (case when p->>'unpublished_at' = 'now' then now() end) else a.unpublished_at end,
        version = a.version + 1,
        updated_at = now()
    where a.id = p_id
      and a.status = p_expected_status
      and a.version = p_expected_version
    returning a.* into v;

    if not found then
        raise exception 'STALE_VERSION' using errcode = 'P0001',
            hint = 'The article changed since it was loaded (or does not exist).';
    end if;

    insert into public.article_events (article_id, event_type, action, from_status, to_status, actor_id, actor_role, actor_label, reason, visibility, metadata)
    values (
        p_id,
        p_event->>'event_type',
        p_event->>'action',
        p_event->>'from_status',
        p_event->>'to_status',
        p_event->>'actor_id',
        p_event->>'actor_role',
        p_event->>'actor_label',
        p_event->>'reason',
        coalesce(p_event->>'visibility', 'internal'),
        coalesce(p_event->'metadata', '{}'::jsonb)
    )
    returning id into v_event_id;

    insert into public.notification_outbox (article_id, event_id, recipient, template, payload)
    select p_id, v_event_id, n->>'recipient', n->>'template', coalesce(n->'payload', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_notifications, '[]'::jsonb)) n;

    return v;
end $$;

create or replace function public.create_submission(p_row jsonb, p_event jsonb, p_notifications jsonb)
returns public.articles
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v public.articles;
    v_event_id bigint;
begin
    insert into public.articles (
        reference_code, status, title, description, keywords, authors, num_authors, author_name,
        institution_email, author_designations, submitted_email, originality_confirmed, manuscript_url,
        similarity_report_path, ai_report_path, contributor_token_hash, stage_entered_at, updated_at
    ) values (
        p_row->>'reference_code', 'SUBMITTED', p_row->>'title', p_row->>'description', p_row->>'keywords',
        p_row->'authors', (p_row->>'num_authors')::integer, p_row->>'author_name', p_row->>'institution_email',
        p_row->>'author_designations', p_row->>'submitted_email', coalesce((p_row->>'originality_confirmed')::boolean, false),
        p_row->>'manuscript_url', p_row->>'similarity_report_path', p_row->>'ai_report_path',
        p_row->>'contributor_token_hash', now(), now()
    )
    returning * into v;

    insert into public.article_events (article_id, event_type, action, from_status, to_status, actor_id, actor_role, actor_label, reason, visibility, metadata)
    values (v.id, p_event->>'event_type', p_event->>'action', p_event->>'from_status', p_event->>'to_status',
        p_event->>'actor_id', p_event->>'actor_role', p_event->>'actor_label', p_event->>'reason',
        coalesce(p_event->>'visibility', 'internal'), coalesce(p_event->'metadata', '{}'::jsonb))
    returning id into v_event_id;

    insert into public.notification_outbox (article_id, event_id, recipient, template, payload)
    select v.id, v_event_id, n->>'recipient', n->>'template', coalesce(n->'payload', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_notifications, '[]'::jsonb)) n;

    return v;
end $$;

-- Claim a batch of due notifications for the worker (skip-locked, so two
-- workers never send the same email).
create or replace function public.claim_notifications(p_limit integer default 20)
returns setof public.notification_outbox
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
    update public.notification_outbox o
    -- next_attempt_at is pushed forward so a crashed worker's rows are retried
    -- after 10 minutes instead of staying in "sending" forever.
    set status = 'sending', attempts = o.attempts + 1, next_attempt_at = now() + interval '10 minutes'
    where o.id in (
        select id from public.notification_outbox
        where status in ('pending', 'failed', 'sending') and next_attempt_at <= now() and attempts < 5
        order by next_attempt_at
        limit p_limit
        for update skip locked
    )
    returning o.*;
$$;

revoke all on function public.apply_article_change(uuid, text, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.create_submission(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.claim_notifications(integer) from public, anon, authenticated;
grant execute on function public.apply_article_change(uuid, text, integer, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.create_submission(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.claim_notifications(integer) to service_role;
