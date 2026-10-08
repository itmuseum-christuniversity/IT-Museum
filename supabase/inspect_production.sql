-- Read-only inspection of the live database. Run this in the Supabase SQL
-- editor (or `psql`) BEFORE applying the migrations, save the output, and
-- compare it with supabase/migrations/20261008000100_baseline_existing_schema.sql.
-- Nothing here writes data.

-- 1. Columns of the tables the app uses
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('articles', 'sections', 'authorized_users')
order by table_name, ordinal_position;

-- 2. Status values actually present (drives the legacy mapping in 0002)
select status, count(*) from public.articles group by status order by 2 desc;

-- 3. Which file URLs look like Google Docs vs. Supabase storage
select
    status,
    count(*) filter (where file_url ilike 'https://docs.google.com/%' or file_url ilike 'https://drive.google.com/%') as google_links,
    count(*) filter (where file_url ilike '%/storage/v1/object/public/articles/%') as public_pdfs,
    count(*) filter (where file_url is null) as no_file
from public.articles group by status;

-- 4. Constraints, triggers and RLS policies
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid in ('public.articles'::regclass, 'public.sections'::regclass);
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage') order by 1, 2;
select relname, relrowsecurity from pg_class where relname in ('articles', 'sections', 'authorized_users');

-- 5. Table grants for browser roles
select table_name, grantee, string_agg(privilege_type, ', ')
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1, 2;

-- 6. Storage buckets and object counts
select b.id, b.public, b.file_size_limit, b.allowed_mime_types, count(o.id) as objects
from storage.buckets b left join storage.objects o on o.bucket_id = b.id
group by b.id, b.public, b.file_size_limit, b.allowed_mime_types;

-- 7. People in the old authorization table (names only; no secrets stored here)
select email, name from public.authorized_users order by email;
