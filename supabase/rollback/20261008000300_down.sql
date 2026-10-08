-- Roll back 0003 (access policies). Run 20261008000400_down.sql first.
--
-- Restores the access state captured by 0003 in migration_backup.pre_0003_*:
--   * the policies 0003 dropped on articles / sections / authorized_users and
--     on storage.objects (exact name, PERMISSIVE/RESTRICTIVE, command, roles,
--     USING, WITH CHECK);
--   * the anon / authenticated table grants and the RLS on/off flags of
--     articles, sections and authorized_users;
--   * public / size limit / MIME settings of the articles and reports buckets.
--
-- Deliberately NOT restored, even if they were open before 0003:
--   * anything on staff_members, article_events, notification_outbox (created
--     by 0002; they stay RLS-on with no browser grants);
--   * columns 0002 added to public.articles (contributor_token_hash, report
--     and PDF paths, reference_code, ...). Grants on articles are re-created
--     column by column for the pre-0002 columns only. Consequence: a client
--     that runs `select *` on articles (the pre-2026-10 frontend does) gets
--     "permission denied" until 0002 is rolled back AND someone grants
--     table-level SELECT by hand, knowingly exposing those columns.
--   * the publication-staging bucket is left in place (private) if 0003
--     created it, so no staged PDF is orphaned.
--
-- If no capture exists (0003 was applied by an older version of this file),
-- a documented MINIMAL state is applied instead: anon/authenticated may read
-- the public columns of PUBLISHED articles and the sections; authorized_users
-- and every private column stay closed; buckets are not changed. Restore
-- anything else by hand from the inspect_production.sql output.
begin;

drop view if exists public.published_articles;
drop policy if exists "Sections are publicly readable" on public.sections;
drop policy if exists "itmuseum: museum buckets are service-role only" on storage.objects;

do $$
declare
    v_capture bigint;
    v_cols text;
    v_roles text;
    r record;
begin
    if to_regclass('migration_backup.pre_0003_capture') is not null then
        select id into v_capture from migration_backup.pre_0003_capture
        where restored_at is null order by id desc limit 1;
    end if;

    revoke all on public.articles, public.sections, public.authorized_users from anon, authenticated;

    if v_capture is null then
        raise notice 'No captured pre-0003 state found: applying the minimal public-read state only.';
        grant select (id, title, author_name, description, keywords, tags, created_at, file_url, status)
            on public.articles to anon, authenticated;
        drop policy if exists "legacy public read (published only)" on public.articles;
        create policy "legacy public read (published only)" on public.articles
            for select to anon, authenticated using (status = 'PUBLISHED');
        grant select on public.sections to anon, authenticated;
        drop policy if exists "legacy public read" on public.sections;
        create policy "legacy public read" on public.sections for select to anon, authenticated using (true);
        return;
    end if;

    -- 1. Policies
    for r in
        select * from migration_backup.pre_0003_policies
        where restored_at is null
          and ((schemaname = 'public' and tablename in ('articles', 'sections', 'authorized_users'))
               or (schemaname = 'storage' and tablename = 'objects'))
        order by id
    loop
        if exists (select 1 from pg_policies p where p.schemaname = r.schemaname and p.tablename = r.tablename and p.policyname = r.policyname) then
            raise notice 'Policy % on %.% already exists; left as is.', r.policyname, r.schemaname, r.tablename;
            continue;
        end if;
        select string_agg(quote_ident(x), ', ') into v_roles from unnest(r.roles) as x;
        execute format('create policy %I on %I.%I as %s for %s to %s%s%s',
            r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd, v_roles,
            case when r.qual is not null then ' using (' || r.qual || ')' else '' end,
            case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end);
        raise notice 'Recreated policy % on %.%', r.policyname, r.schemaname, r.tablename;
    end loop;
    -- Policies on 0002's tables are marked handled too: they are intentionally not recreated.
    update migration_backup.pre_0003_policies set restored_at = now() where restored_at is null;

    -- 2. Grants. Pre-0002 columns of articles = the columns of the 0002 backup
    --    copy that still exist; the 0001 baseline list if that copy is missing.
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
    from pg_attribute a
    where a.attrelid = to_regclass('migration_backup.articles_20261008') and a.attnum > 0 and not a.attisdropped
      and exists (select 1 from pg_attribute b
                  where b.attrelid = 'public.articles'::regclass and b.attname = a.attname and b.attnum > 0 and not b.attisdropped);
    v_cols := coalesce(v_cols, 'id, title, author_name, institution_email, description, keywords, num_authors, author_designations, '
        || 'submitted_email, similarity_report_url, ai_report_url, originality_confirmed, file_url, status, created_at, tags');

    for r in select * from migration_backup.pre_0003_grants where capture_id = v_capture loop
        if r.table_name = 'articles' and r.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES') then
            execute format('grant %s (%s) on public.articles to %I', r.privilege_type, v_cols, r.grantee);
        else
            execute format('grant %s on public.%I to %I', r.privilege_type, r.table_name, r.grantee);
        end if;
    end loop;

    -- 3. RLS flags
    for r in select * from migration_backup.pre_0003_rls where capture_id = v_capture loop
        execute format('alter table public.%I %s row level security', r.table_name,
            case when r.rls_enabled then 'enable' else 'disable' end);
    end loop;

    -- 4. Buckets
    for r in select * from migration_backup.pre_0003_buckets where capture_id = v_capture loop
        if r.existed then
            update storage.buckets
            set public = r.public, file_size_limit = r.file_size_limit, allowed_mime_types = r.allowed_mime_types
            where id = r.bucket_id;
        else
            raise notice 'Bucket % did not exist before 0003; left in place (private).', r.bucket_id;
        end if;
    end loop;

    update migration_backup.pre_0003_capture set restored_at = now() where id = v_capture;
end $$;
commit;
