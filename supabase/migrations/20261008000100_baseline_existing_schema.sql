-- =============================================================================
-- 0001 · Baseline of the schema the application already used (pre-2026-10).
--
-- The production database was created by hand and this repository had no
-- migrations. This file reconstructs the shape the old code read and wrote so a
-- fresh local database matches production. Every statement is idempotent
-- (IF NOT EXISTS), so applying it to production changes nothing that exists.
--
-- BEFORE APPLYING TO PRODUCTION run supabase/inspect_production.sql and compare
-- the output with this file. See README → "Database migration runbook".
-- =============================================================================

-- gen_random_uuid() is built in from PostgreSQL 13 (Supabase runs 15+).

create table if not exists public.articles (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    author_name text not null default '',
    institution_email text,
    description text not null default '',
    keywords text,
    num_authors integer,
    author_designations text,
    submitted_email text,
    similarity_report_url text,
    ai_report_url text,
    originality_confirmed boolean default false,
    file_url text,
    status text not null default 'SUBMITTED',
    created_at timestamptz not null default now(),
    tags text[]
);

-- Columns the old code wrote but that may be missing on older databases.
alter table public.articles add column if not exists keywords text;
alter table public.articles add column if not exists num_authors integer;
alter table public.articles add column if not exists author_designations text;
alter table public.articles add column if not exists submitted_email text;
alter table public.articles add column if not exists similarity_report_url text;
alter table public.articles add column if not exists ai_report_url text;
alter table public.articles add column if not exists originality_confirmed boolean default false;
alter table public.articles add column if not exists file_url text;
alter table public.articles add column if not exists tags text[];

create table if not exists public.sections (
    id uuid primary key default gen_random_uuid(),
    title text,
    content text,
    "order" bigint,
    image_url text,
    pdf_url text,
    created_at timestamptz not null default now()
);

-- Used by the old login screen to match a typed name to an email. Kept (data is
-- preserved) but no longer used for authorisation; see 0002.
create table if not exists public.authorized_users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    name text not null,
    created_at timestamptz not null default now()
);

-- Storage buckets used by the old code.
insert into storage.buckets (id, name, public)
values ('articles', 'articles', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;
