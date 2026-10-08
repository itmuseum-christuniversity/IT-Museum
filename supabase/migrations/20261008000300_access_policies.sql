-- =============================================================================
-- 0003 · Deny-by-default access.
--
-- Anonymous and signed-in browser clients (anon / authenticated roles) may:
--   * read published articles through the public.published_articles view,
--     which exposes only public columns (no emails, reports, notes, tokens);
--   * read homepage sections.
-- Everything else — drafts, review notes, reports, staff records, the outbox —
-- is reachable only through the Edge Functions using the service role.
--
-- Existing policies on these tables (names unknown, created by hand) are
-- dropped and replaced. Review supabase/inspect_production.sql output first.
--
-- Before changing anything, the pre-0003 access state is captured in schema
-- migration_backup (pre_0003_*): every policy this file drops (name, table,
-- permissive/restrictive, command, roles, USING, WITH CHECK), the table grants
-- held by anon/authenticated, the RLS flags and the storage bucket settings.
-- Rollback (recreates them from there): supabase/rollback/20261008000300_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Capture the pre-0003 access state
--    Grants / RLS flags / buckets are captured once per "generation" (until a
--    rollback marks the capture restored), so re-running this file never
--    overwrites the real pre-state with its own. Every dropped policy is
--    recorded at the moment it is dropped.
-- ---------------------------------------------------------------------------
create schema if not exists migration_backup;
revoke all on schema migration_backup from public;

create table if not exists migration_backup.pre_0003_capture (
    id bigint generated always as identity primary key,
    captured_at timestamptz not null default now(),
    restored_at timestamptz
);
create table if not exists migration_backup.pre_0003_policies (
    id bigint generated always as identity primary key,
    schemaname name not null,
    tablename name not null,
    policyname name not null,
    permissive text not null,
    roles name[] not null,
    cmd text not null,
    qual text,
    with_check text,
    dropped_at timestamptz not null default now(),
    restored_at timestamptz
);
create table if not exists migration_backup.pre_0003_grants (
    capture_id bigint not null references migration_backup.pre_0003_capture (id),
    table_name name not null,
    grantee name not null,
    privilege_type text not null
);
create table if not exists migration_backup.pre_0003_rls (
    capture_id bigint not null references migration_backup.pre_0003_capture (id),
    table_name name not null,
    rls_enabled boolean not null
);
create table if not exists migration_backup.pre_0003_buckets (
    capture_id bigint not null references migration_backup.pre_0003_capture (id),
    bucket_id text not null,
    existed boolean not null,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
);

do $$
declare v_capture bigint;
begin
    if exists (select 1 from migration_backup.pre_0003_capture where restored_at is null) then
        return;
    end if;
    insert into migration_backup.pre_0003_capture default values returning id into v_capture;

    -- From pg_class ACLs rather than information_schema, which hides grants
    -- whose grantor/grantee is not a role the migration user belongs to.
    insert into migration_backup.pre_0003_grants (capture_id, table_name, grantee, privilege_type)
    select v_capture, c.relname, r.rolname, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    join pg_roles r on r.oid = a.grantee
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname in ('articles', 'sections', 'authorized_users')
      and r.rolname in ('anon', 'authenticated');

    insert into migration_backup.pre_0003_rls (capture_id, table_name, rls_enabled)
    select v_capture, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('articles', 'sections', 'authorized_users');

    insert into migration_backup.pre_0003_buckets (capture_id, bucket_id, existed, public, file_size_limit, allowed_mime_types)
    select v_capture, x.id, b.id is not null, b.public, b.file_size_limit, b.allowed_mime_types
    from unnest(array['articles', 'reports', 'publication-staging']) as x(id)
    left join storage.buckets b on b.id = x.id;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Remove hand-made policies on our tables (each one is recorded first)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
    for r in
        select * from pg_policies
        where schemaname = 'public'
          and tablename in ('articles', 'sections', 'authorized_users', 'staff_members', 'article_events', 'notification_outbox')
    loop
        -- This file's own policy is recreated below; recording it would make the
        -- rollback "restore" something that did not exist before 0003.
        if not (r.tablename = 'sections' and r.policyname = 'Sections are publicly readable') then
            insert into migration_backup.pre_0003_policies (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
            values (r.schemaname, r.tablename, r.policyname, r.permissive, r.roles, r.cmd, r.qual, r.with_check);
        end if;
        raise notice 'Dropping policy % on % (saved in migration_backup.pre_0003_policies)', r.policyname, r.tablename;
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS and revoke direct table access from browser roles
-- ---------------------------------------------------------------------------
alter table public.articles enable row level security;
alter table public.sections enable row level security;
alter table public.authorized_users enable row level security;
alter table public.staff_members enable row level security;
alter table public.article_events enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on public.articles from anon, authenticated;
revoke all on public.authorized_users from anon, authenticated;
revoke all on public.staff_members from anon, authenticated;
revoke all on public.article_events from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on all tables in schema migration_backup from anon, authenticated;

-- Sections are public, read-only content.
revoke insert, update, delete, truncate on public.sections from anon, authenticated;
grant select on public.sections to anon, authenticated;
create policy "Sections are publicly readable" on public.sections for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 3. Public, column-limited view of published articles
--    (runs as the view owner, so the base table stays locked)
-- ---------------------------------------------------------------------------
create or replace view public.published_articles
with (security_invoker = false)
as
select
    a.id,
    a.reference_code,
    a.title,
    a.author_name,
    (
        select jsonb_agg(jsonb_build_object('name', x->>'name', 'designation', x->>'designation'))
        from jsonb_array_elements(coalesce(a.authors, '[]'::jsonb)) x
    ) as authors,
    a.description,
    coalesce(a.tags, '{}'::text[]) as tags,
    a.created_at,
    a.published_at,
    a.published_pdf_url as pdf_url,
    -- Legacy records published before PDFs were archived only have the shared document.
    case when a.published_pdf_url is null then coalesce(a.manuscript_url, a.file_url) end as external_document_url
from public.articles a
where a.status = 'PUBLISHED';

revoke all on public.published_articles from public;
grant select on public.published_articles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage
--    articles            → public on purpose: currently published PDFs only
--    reports             → private: similarity/AI reports (signed URLs for staff)
--    publication-staging → private: final PDFs awaiting publication / unpublished
-- ---------------------------------------------------------------------------
update storage.buckets set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf']
where id = 'reports';

update storage.buckets set public = true, file_size_limit = 26214400, allowed_mime_types = array['application/pdf']
where id = 'articles';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publication-staging', 'publication-staging', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Browser clients no longer upload or list directly; the Edge Functions do,
-- with the service role (which bypasses RLS; public downloads from the
-- `articles` bucket do not go through RLS either).
--
-- a) Drop client policies whose USING / WITH CHECK names one of these three
--    buckets, recording each one in migration_backup.pre_0003_policies first.
--    Policies for other buckets are left alone.
-- b) Policies that are unrestricted across ALL buckets (USING/WITH CHECK true
--    or absent) are NOT dropped: other buckets in the project may rely on
--    them. Instead a RESTRICTIVE policy, which is ANDed with every permissive
--    one, shuts anon/authenticated out of the three museum buckets.
do $$
declare r record;
begin
    for r in
        select * from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname <> 'itmuseum: museum buckets are service-role only'
          and (
              coalesce(qual, '') ~ '''(articles|reports|publication-staging)'''
              or coalesce(with_check, '') ~ '''(articles|reports|publication-staging)'''
          )
    loop
        insert into migration_backup.pre_0003_policies (schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
        values (r.schemaname, r.tablename, r.policyname, r.permissive, r.roles, r.cmd, r.qual, r.with_check);
        raise notice 'Dropping storage policy % (roles %; saved in migration_backup.pre_0003_policies). If it also covered other buckets, recreate it for those only.', r.policyname, r.roles;
        execute format('drop policy %I on storage.objects', r.policyname);
    end loop;

    for r in
        select policyname, cmd, roles from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and permissive = 'PERMISSIVE'
          and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true'
    loop
        raise notice 'Storage policy % (% for %) is unrestricted across all buckets. Left in place; the restrictive policy blocks it for the museum buckets. Review it.', r.policyname, r.cmd, r.roles;
    end loop;
end $$;

drop policy if exists "itmuseum: museum buckets are service-role only" on storage.objects;
create policy "itmuseum: museum buckets are service-role only" on storage.objects
    as restrictive
    for all
    to anon, authenticated
    using (bucket_id is null or bucket_id not in ('articles', 'reports', 'publication-staging'))
    with check (bucket_id is null or bucket_id not in ('articles', 'reports', 'publication-staging'));
