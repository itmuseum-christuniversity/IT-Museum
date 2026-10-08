/**
 * Applies the real SQL migrations to an in-process PostgreSQL (PGlite) with a
 * minimal stand-in for Supabase's roles and storage schema, then checks the
 * legacy data mapping, row-level security and the atomic workflow function.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const dir = join(__dirname, '..', 'supabase', 'migrations');
const rollbackDir = join(__dirname, '..', 'supabase', 'rollback');
const migrations = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
// Newest first: 0004_down, 0003_down, 0002_down.
const rollbacks = readdirSync(rollbackDir).filter((f) => f.endsWith('_down.sql')).sort().reverse();
const sql = (d: string, f: string) => readFileSync(join(d, f), 'utf8');
let db: PGlite;

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create policy "anon can upload reports" on storage.objects for insert to anon with check (bucket_id = 'reports');
create policy "other bucket" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "open read, every bucket" on storage.objects for select to anon using (true);
grant usage on schema storage to anon, authenticated;
grant select, insert on storage.objects to anon, authenticated;
`;

const LEGACY_ROWS = `
insert into public.articles (title, author_name, institution_email, author_designations, description, status, file_url, similarity_report_url, tags, submitted_email) values
 ('In review', 'Asha Rao, Ben Das', 'asha@cu.in, ben@cu.in', 'Professor, Lecturer', 'desc', 'ADMIN_APPROVED',
  'https://docs.google.com/document/d/abc1234567890/edit', 'https://x.supabase.co/storage/v1/object/public/reports/r1.pdf', null, 'asha@cu.in'),
 ('Tech approved', 'C', 'c@cu.in', 'P', 'desc', 'TECH_APPROVED', 'https://docs.google.com/document/d/def1234567890/edit', null, null, 'c@cu.in'),
 ('Lit approved', 'D', 'd@cu.in', 'P', 'desc', 'LIT_APPROVED', 'https://docs.google.com/document/d/ghi1234567890/edit', null, null, 'd@cu.in'),
 ('Live', 'E', 'e@cu.in', 'P', 'desc', 'PUBLISHED', 'https://x.supabase.co/storage/v1/object/public/articles/live.pdf', null, '{history}', 'e@cu.in'),
 ('Rejected by tech', 'F', 'f@cu.in', 'P', 'desc', 'IT_REJECTED', null, null, null, null),
 ('Rejected ambiguous', 'G', 'g@cu.in', 'P', 'desc', 'ADMIN_REJECTED', null, null, null, null);
insert into public.sections (title, content, "order") values ('Welcome', '<p>Hi</p>', 1);
insert into public.authorized_users (email, name) values ('itmuseum.admin@christuniversity.in', 'Admin'), ('random@christuniversity.in', 'Random');
create policy "old open policy" on public.articles for all using (true) with check (true);
grant all on public.articles to anon;
`;

async function asRole<T>(role: string, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role ${role}`);
    try {
        return await fn();
    } finally {
        await db.exec('reset role');
    }
}

beforeAll(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STUB);
    await db.exec(readFileSync(join(dir, migrations[0]), 'utf8'));
    await db.exec(LEGACY_ROWS);
    for (const f of migrations.slice(1)) await db.exec(readFileSync(join(dir, f), 'utf8'));
}, 60_000);

const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

describe('legacy status migration', () => {
    it('maps every legacy status and keeps the original value', async () => {
        const r = await rows<{ title: string; status: string; legacy_status: string; rejected_at_stage: string | null }>(
            'select title, status, legacy_status, rejected_at_stage from public.articles order by title',
        );
        const byTitle = Object.fromEntries(r.map((x) => [x.title, x]));
        expect(byTitle['In review']).toMatchObject({ status: 'IT_REVIEW', legacy_status: 'ADMIN_APPROVED' });
        expect(byTitle['Tech approved']).toMatchObject({ status: 'LIT_REVIEW' });
        expect(byTitle['Lit approved']).toMatchObject({ status: 'FINAL_APPROVAL' });
        expect(byTitle['Live']).toMatchObject({ status: 'PUBLISHED', legacy_status: 'PUBLISHED' });
        expect(byTitle['Rejected by tech']).toMatchObject({ status: 'REJECTED', rejected_at_stage: 'TECH_REVIEW' });
        expect(byTitle['Rejected ambiguous']).toMatchObject({ status: 'REJECTED', rejected_at_stage: null, legacy_status: 'ADMIN_REJECTED' });
    });

    it('keeps the Google Doc and the final PDF separately and never overwrites file_url', async () => {
        const [inReview] = await rows<Record<string, string>>(`select * from public.articles where title = 'In review'`);
        expect(inReview.manuscript_url).toContain('docs.google.com');
        expect(inReview.file_url).toContain('docs.google.com');
        expect(inReview.similarity_report_path).toBe('r1.pdf');
        const [live] = await rows<Record<string, string>>(`select * from public.articles where title = 'Live'`);
        expect(live.published_pdf_path).toBe('live.pdf');
        expect(live.file_url).toBe(live.published_pdf_url);
    });

    it('writes one audit event per legacy row and backs up the originals', async () => {
        expect((await rows(`select * from public.article_events where event_type = 'legacy_import'`)).length).toBe(6);
        expect((await rows('select * from migration_backup.articles_20261008')).length).toBe(6);
        const [b] = await rows<{ status: string }>(`select status from migration_backup.articles_20261008 where title = 'In review'`);
        expect(b.status).toBe('ADMIN_APPROVED');
    });

    it('splits legacy comma-joined authors into structured authors', async () => {
        const [r] = await rows<{ authors: { name: string; email: string }[] }>(`select authors from public.articles where title = 'In review'`);
        expect(r.authors.map((a) => a.name)).toEqual(['Asha Rao', 'Ben Das']);
    });

    it('seeds staff from authorized_users as inactive, with no default-admin fallback', async () => {
        const staff = await rows<{ email: string; role: string; active: boolean }>('select email, role, active from public.staff_members');
        expect(staff).toEqual([{ email: 'itmuseum.admin@christuniversity.in', role: 'admin', active: false }]);
    });

    it('is idempotent', async () => {
        for (const f of migrations) await db.exec(readFileSync(join(dir, f), 'utf8'));
        expect((await rows(`select * from public.article_events where event_type = 'legacy_import'`)).length).toBe(6);
        const [r] = await rows<{ status: string }>(`select status from public.articles where title = 'In review'`);
        expect(r.status).toBe('IT_REVIEW');
    });
});

describe('row-level security', () => {
    it('anonymous users cannot read the articles table, staff or the audit log', async () => {
        for (const table of ['public.articles', 'public.staff_members', 'public.article_events', 'public.notification_outbox', 'public.authorized_users']) {
            await expect(asRole('anon', () => rows(`select * from ${table}`)), table).rejects.toThrow(/permission denied/);
        }
    });

    it('anonymous users see only published articles, without private columns', async () => {
        const published = await asRole('anon', () => rows<Record<string, unknown>>('select * from public.published_articles'));
        expect(published.map((p) => p.title)).toEqual(['Live']);
        const cols = Object.keys(published[0]);
        for (const secret of ['submitted_email', 'institution_email', 'similarity_report_url', 'contributor_token_hash', 'public_reason', 'status']) {
            expect(cols).not.toContain(secret);
        }
        expect(JSON.stringify(published)).not.toContain('@cu.in');
    });

    it('a draft id is not readable through the public view', async () => {
        const [draft] = await rows<{ id: string }>(`select id from public.articles where title = 'In review'`);
        const r = await asRole('anon', () => rows('select * from public.published_articles where id = $1', [draft.id]));
        expect(r).toEqual([]);
    });

    it('anonymous users cannot write anything', async () => {
        await expect(asRole('anon', () => rows(`update public.articles set status = 'PUBLISHED'`))).rejects.toThrow(/permission denied/);
        await expect(asRole('anon', () => rows(`insert into public.sections (title) values ('x')`))).rejects.toThrow(/permission denied/);
    });

    it('sections remain publicly readable', async () => {
        expect((await asRole('anon', () => rows('select title from public.sections'))).length).toBe(1);
    });

    it('browser roles cannot call the workflow functions', async () => {
        await expect(
            asRole('anon', () => rows(`select public.apply_article_change(gen_random_uuid(), 'SUBMITTED', 1, 'PUBLISHED', '{}', '{}', '[]')`)),
        ).rejects.toThrow(/permission denied/);
    });

    it('reports are private, staging is private, published PDFs are public', async () => {
        const b = await rows<{ id: string; public: boolean }>('select id, public from storage.buckets order by id');
        expect(Object.fromEntries(b.map((x) => [x.id, x.public]))).toEqual({ articles: true, 'publication-staging': false, reports: false });
        const policies = await rows<{ policyname: string }>(`select policyname from pg_policies where schemaname = 'storage' order by 1`);
        // Only the policy naming a museum bucket is dropped; other buckets' policies and the
        // all-bucket one stay, and the restrictive policy blocks the latter for museum buckets.
        expect(policies.map((p) => p.policyname)).toEqual([
            'itmuseum: museum buckets are service-role only',
            'open read, every bucket',
            'other bucket',
        ]);
    });

    it('records every dropped policy so the rollback can recreate it', async () => {
        const saved = await rows<Record<string, unknown>>(
            'select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check from migration_backup.pre_0003_policies order by id',
        );
        expect(saved).toEqual([
            { schemaname: 'public', tablename: 'articles', policyname: 'old open policy', permissive: 'PERMISSIVE', roles: ['public'], cmd: 'ALL', qual: 'true', with_check: 'true' },
            {
                schemaname: 'storage', tablename: 'objects', policyname: 'anon can upload reports', permissive: 'PERMISSIVE',
                roles: ['anon'], cmd: 'INSERT', qual: null, with_check: "(bucket_id = 'reports'::text)",
            },
        ]);
        const grants = await rows<{ table_name: string; privilege_type: string }>(
            `select table_name, privilege_type from migration_backup.pre_0003_grants where grantee = 'anon' order by 1, 2`,
        );
        expect(grants.map((g) => g.table_name)).toContain('articles');
        expect((await rows('select * from migration_backup.pre_0003_buckets where bucket_id = $1 and public', ['reports'])).length).toBe(1);
    });

    it('browser roles cannot reach museum buckets even through an all-bucket policy; other buckets unaffected', async () => {
        await db.exec(`insert into storage.objects (bucket_id, name) values ('reports', 'r.pdf'), ('articles', 'a.pdf'), ('avatars', 'me.png')`);
        const seen = await asRole('anon', () => rows<{ bucket_id: string }>('select bucket_id from storage.objects order by 1'));
        expect(seen.map((o) => o.bucket_id)).toEqual(['avatars']);
        await expect(asRole('anon', () => rows(`insert into storage.objects (bucket_id, name) values ('reports', 'x.pdf')`))).rejects.toThrow(
            /row-level security/,
        );
        await db.exec(`delete from storage.objects`);
    });
});

describe('apply_article_change', () => {
    const event = JSON.stringify({ event_type: 'transition', action: 'advance', from_status: 'IT_REVIEW', to_status: 'TECH_REVIEW', actor_id: 's1', actor_role: 'it_reviewer' });

    it('applies a change atomically with an audit event and outbox rows, then rejects the stale duplicate', async () => {
        const [a] = await rows<{ id: string; version: number }>(`select id, version from public.articles where title = 'In review'`);
        const notif = JSON.stringify([{ recipient: 'asha@cu.in', template: 'changes_requested', payload: { title: 'In review' } }]);
        const call = () =>
            asRole('service_role', () =>
                rows<{ apply_article_change: string }>(`select public.apply_article_change($1, 'IT_REVIEW', $2, 'TECH_REVIEW', '{"public_reason": null}', $3, $4)`, [a.id, a.version, event, notif]),
            );
        await call();
        const [after] = await rows<{ status: string; version: number }>('select status, version from public.articles where id = $1', [a.id]);
        expect(after).toEqual({ status: 'TECH_REVIEW', version: a.version + 1 });
        expect((await rows('select * from public.notification_outbox where article_id = $1', [a.id])).length).toBe(1);
        await expect(call()).rejects.toThrow(/STALE_VERSION/);
        expect((await rows(`select * from public.article_events where article_id = $1 and event_type = 'transition'`, [a.id])).length).toBe(1);
    });

    it('refuses to patch columns outside the whitelist', async () => {
        const [a] = await rows<{ id: string; version: number; status: string }>(`select id, version, status from public.articles where title = 'Live'`);
        await expect(
            rows(`select public.apply_article_change($1, $2, $3, null, '{"submitted_email": "x@evil.test"}', $4, '[]')`, [a.id, a.status, a.version, event]),
        ).rejects.toThrow(/not patchable/);
    });

    it('rejects statuses outside the canonical enum', async () => {
        await expect(rows(`update public.articles set status = 'ADMIN_APPROVED' where title = 'Live'`)).rejects.toThrow(/check constraint/);
    });

    it('keeps the audit log append-only', async () => {
        await expect(rows('update public.article_events set reason = $1', ['tampered'])).rejects.toThrow(/append-only/);
        await expect(rows('delete from public.article_events')).rejects.toThrow(/append-only/);
    });

    it('refuses TRUNCATE of the audit log (statement-level trigger)', async () => {
        // CASCADE gets past the outbox foreign key, so the trigger is what refuses it.
        await expect(rows('truncate public.article_events cascade')).rejects.toThrow(/append-only/);
        await expect(rows('truncate public.article_events, public.notification_outbox')).rejects.toThrow(/append-only/);
        await expect(rows('truncate public.articles cascade')).rejects.toThrow(/append-only/);
        expect((await rows('select * from public.article_events')).length).toBeGreaterThan(0);
        const [grant] = await rows<{ ok: boolean }>(`select has_table_privilege('service_role', 'public.article_events', 'TRUNCATE') as ok`);
        expect(grant.ok).toBe(false);
    });

    it('claims due notifications once', async () => {
        const first = await rows('select * from public.claim_notifications(10)');
        const second = await rows('select * from public.claim_notifications(10)');
        expect(first.length).toBe(1);
        expect(second.length).toBe(0);
    });
});

describe('hardening (0004)', () => {
    it('has the queue, date and activity-feed indexes', async () => {
        const idx = await rows<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes where schemaname = 'public'`);
        const def = Object.fromEntries(idx.map((i) => [i.indexname, i.indexdef]));
        expect(def.articles_assignee_idx).toMatch(/\(assignee_id\)/);
        expect(def.articles_created_at_idx).toMatch(/\(created_at\)/);
        expect(def.article_events_created_at_idx).toMatch(/\(created_at DESC\)/);
        // Matches listQueue: order('stage_entered_at', { ascending: true, nullsFirst: true }).
        expect(def.articles_status_stage_idx).toMatch(/\(status, stage_entered_at NULLS FIRST\)/);
        expect(def.articles_status_idx).toBeUndefined();
    });

    it('pins search_path on every SECURITY DEFINER function and keeps them service-role only', async () => {
        const fns = await rows<{ proname: string; proconfig: string[] | null }>(
            `select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosecdef order by 1`,
        );
        expect(fns.map((f) => f.proname)).toEqual([
            'apply_article_change',
            'claim_notifications',
            'consume_rate_limit',
            'create_submission',
            'create_submission_idempotent',
            'purge_abuse_controls',
            'staff_members_keep_an_admin',
        ]);
        for (const f of fns) expect(f.proconfig, f.proname).toEqual(['search_path=pg_catalog, public, pg_temp']);
        for (const f of ['apply_article_change', 'claim_notifications', 'create_submission', 'consume_rate_limit', 'create_submission_idempotent', 'purge_abuse_controls']) {
            const [g] = await rows<{ anon: boolean; svc: boolean }>(
                `select has_function_privilege('anon', p.oid, 'EXECUTE') as anon, has_function_privilege('service_role', p.oid, 'EXECUTE') as svc
                 from pg_proc p where p.proname = $1`,
                [f],
            );
            expect(g, f).toEqual({ anon: false, svc: true });
        }
    });

    describe('last-admin guard', () => {
        // PGlite is a single connection, so true concurrency cannot be exercised here; the
        // "both demote each other" race is checked as the sequential interleaving it reduces to
        // (the second transaction sees the first one's committed demotion). The FOR UPDATE
        // serialisation itself is Postgres behaviour and is described in the migration.
        beforeAll(async () => {
            await db.exec(`delete from public.staff_members; insert into public.staff_members (email, display_name, role, active) values
                ('a@cu.in', 'A', 'admin', true), ('b@cu.in', 'B', 'admin', true), ('old@cu.in', 'Old', 'admin', false), ('r@cu.in', 'R', 'it_reviewer', true)`);
        });

        it('allows demoting one of two active admins, then refuses the second', async () => {
            await rows(`update public.staff_members set role = 'it_reviewer' where email = 'b@cu.in'`);
            await expect(rows(`update public.staff_members set role = 'it_reviewer' where email = 'a@cu.in'`)).rejects.toThrow(/LAST_ADMIN/);
        });

        it('refuses deactivating or deleting the last active admin', async () => {
            await expect(rows(`update public.staff_members set active = false where email = 'a@cu.in'`)).rejects.toThrow(/LAST_ADMIN/);
            await expect(rows(`delete from public.staff_members where email = 'a@cu.in'`)).rejects.toThrow(/LAST_ADMIN/);
            await expect(rows(`update public.staff_members set role = 'lit_reviewer', active = false where role = 'admin'`)).rejects.toThrow(/LAST_ADMIN/);
        });

        it('still allows ordinary edits, other rows and promoting a replacement', async () => {
            await rows(`update public.staff_members set display_name = 'Admin A' where email = 'a@cu.in'`);
            await rows(`delete from public.staff_members where email = 'old@cu.in'`);
            await rows(`update public.staff_members set role = 'admin' where email = 'r@cu.in'`);
            await rows(`update public.staff_members set active = false where email = 'a@cu.in'`);
            const admins = await rows<{ email: string }>(`select email from public.staff_members where role = 'admin' and active`);
            expect(admins).toEqual([{ email: 'r@cu.in' }]);
        });
    });
});

describe('abuse controls (0005)', () => {
    const hex = (c: string) => c.repeat(64);
    type Decision = { allowed: boolean; current_hits: number; retry_after_seconds: number };
    const consume = async (bucket: string, key: string, windowSeconds: number, max: number) =>
        (await rows<Decision>('select * from public.consume_rate_limit($1, $2, $3, $4)', [bucket, key, windowSeconds, max]))[0];

    it('browser roles cannot read or write the counters or idempotency keys', async () => {
        for (const table of ['public.rate_limit_counters', 'public.submission_idempotency']) {
            await expect(asRole('anon', () => rows(`select * from ${table}`)), table).rejects.toThrow(/permission denied/);
            await expect(asRole('authenticated', () => rows(`select * from ${table}`)), table).rejects.toThrow(/permission denied/);
        }
        const rls = await rows<{ relname: string; relrowsecurity: boolean }>(
            `select relname, relrowsecurity from pg_class where relname in ('rate_limit_counters', 'submission_idempotency') order by 1`,
        );
        expect(rls).toEqual([
            { relname: 'rate_limit_counters', relrowsecurity: true },
            { relname: 'submission_idempotency', relrowsecurity: true },
        ]);
        await expect(asRole('anon', () => consume('t:anon', hex('a'), 60, 5))).rejects.toThrow(/permission denied/);
    });

    it('allows up to max hits per window, then refuses with a Retry-After inside the window', async () => {
        const got = [];
        for (let i = 0; i < 4; i++) got.push(await consume('t:limit', hex('b'), 3600, 3));
        expect(got.map((g) => g.allowed)).toEqual([true, true, true, false]);
        expect(got.map((g) => g.current_hits)).toEqual([1, 2, 3, 4]);
        expect(got[3].retry_after_seconds).toBeGreaterThan(0);
        expect(got[3].retry_after_seconds).toBeLessThanOrEqual(3600);
        // Other keys and other buckets have their own budget.
        expect((await consume('t:limit', hex('c'), 3600, 3)).allowed).toBe(true);
        expect((await consume('t:other', hex('b'), 3600, 3)).allowed).toBe(true);
    });

    it('starts a fresh count when the window ends and drops the finished window', async () => {
        // Start just after a 1-second boundary so the first two calls share a window.
        await new Promise((r) => setTimeout(r, 1000 - (Date.now() % 1000) + 20));
        expect((await consume('t:reset', hex('d'), 1, 1)).allowed).toBe(true);
        expect((await consume('t:reset', hex('d'), 1, 1)).allowed).toBe(false);
        await new Promise((r) => setTimeout(r, 1100));
        const next = await consume('t:reset', hex('d'), 1, 1);
        expect(next).toMatchObject({ allowed: true, current_hits: 1 });
        expect((await rows(`select * from public.rate_limit_counters where bucket = 't:reset'`)).length).toBe(1);
    });

    it('counts every concurrent call exactly once (single upsert, no read-then-write)', async () => {
        // PGlite has one connection, so these run one after another; on Postgres the
        // ON CONFLICT DO UPDATE row lock gives the same result under real concurrency.
        const results = await Promise.all(Array.from({ length: 25 }, () => consume('t:burst', hex('e'), 3600, 10)));
        expect(results.map((r) => r.current_hits).sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
        expect(results.filter((r) => r.allowed)).toHaveLength(10);
        const [row] = await rows<{ hits: number }>(`select hits from public.rate_limit_counters where bucket = 't:burst'`);
        expect(row.hits).toBe(25);
    });

    it('stores only digests: raw IPs, emails and bad bucket names are refused', async () => {
        await expect(consume('t:raw', '203.0.113.7', 60, 5)).rejects.toThrow(/key_hash_check/);
        await expect(consume('t:raw', 'author@christuniversity.in', 60, 5)).rejects.toThrow(/key_hash_check/);
        await expect(consume('T RAW', hex('f'), 60, 5)).rejects.toThrow(/bucket_check/);
        await expect(consume('t:raw', hex('f'), 0, 5)).rejects.toThrow(/RATE_LIMIT_ARGS/);
        const cols = await rows<{ column_name: string }>(
            `select column_name from information_schema.columns where table_name = 'rate_limit_counters' order by ordinal_position`,
        );
        expect(cols.map((c) => c.column_name)).toEqual(['bucket', 'key_hash', 'window_start', 'expires_at', 'hits']);
        const keys = await rows<{ key_hash: string }>('select key_hash from public.rate_limit_counters');
        expect(keys.every((k) => /^[0-9a-f]{64}$/.test(k.key_hash))).toBe(true);
    });

    it('creates a submission once per idempotency key; a repeat writes nothing', async () => {
        const row = JSON.stringify({ reference_code: 'ITM-2026-IDEM01', title: 'Idem', description: 'd', author_name: 'N', submitted_email: 'n@cu.in', contributor_token_hash: hex('1') });
        const ev = JSON.stringify({ event_type: 'submitted', actor_id: 'contributor', actor_role: 'contributor', visibility: 'contributor' });
        const notes = JSON.stringify([{ recipient: 'n@cu.in', template: 'submission_received', payload: { reference: 'ITM-2026-IDEM01' } }]);
        const count = async () => (await rows<{ a: number; e: number; o: number }>(
            `select (select count(*)::int from public.articles) a, (select count(*)::int from public.article_events) e, (select count(*)::int from public.notification_outbox) o`,
        ))[0];
        const before = await count();
        const call = () => rows<{ r: Record<string, unknown> }>('select public.create_submission_idempotent($1, $2, $3, $4, $5) as r', [row, ev, notes, hex('2'), hex('3')]);
        const [{ r: first }] = await call();
        expect(first.duplicate).toBe(false);
        const article = first.article as { id: string; reference_code: string };
        expect(article.reference_code).toBe('ITM-2026-IDEM01');
        const afterFirst = await count();
        expect(afterFirst).toEqual({ a: before.a + 1, e: before.e + 1, o: before.o + 1 });

        const [{ r: second }] = await call();
        expect(second).toMatchObject({ duplicate: true, article_id: article.id, request_hash: hex('3') });
        expect(await count()).toEqual(afterFirst);
        const [stored] = await rows<Record<string, unknown>>('select * from public.submission_idempotency where key_hash = $1', [hex('2')]);
        expect(stored).toMatchObject({ key_hash: hex('2'), request_hash: hex('3'), article_id: article.id });
        await expect(rows('select public.create_submission_idempotent($1, $2, $3, $4, $5)', [row, ev, notes, 'not-a-hash', hex('3')])).rejects.toThrow(/key_hash_check/);
    });

    it('purges finished windows and idempotency keys past their TTL', async () => {
        await rows(`insert into public.rate_limit_counters (bucket, key_hash, window_start, expires_at, hits) values ('t:old', $1, now() - interval '2 days', now() - interval '1 day', 3)`, [hex('9')]);
        await rows(`insert into public.submission_idempotency (key_hash, request_hash, created_at) values ($1, $1, now() - interval '8 days')`, [hex('8')]);
        const [r] = await rows<{ rate_limit_rows: number; idempotency_rows: number }>('select * from public.purge_abuse_controls()');
        expect(r.rate_limit_rows).toBeGreaterThanOrEqual(1);
        expect(r.idempotency_rows).toBe(1);
        expect((await rows(`select 1 from public.rate_limit_counters where bucket = 't:old'`)).length).toBe(0);
        // Recent keys (the previous test's) are kept.
        expect((await rows('select 1 from public.submission_idempotency where key_hash = $1', [hex('2')])).length).toBe(1);
    });
});

describe('rollback and re-apply round trip', () => {
    let rt: PGlite;
    const q = async <T = Record<string, unknown>>(s: string, p: unknown[] = []) => (await rt.query<T>(s, p)).rows;
    const asAnon = async <T>(fn: () => Promise<T>) => {
        await rt.exec('set role anon');
        try {
            return await fn();
        } finally {
            await rt.exec('reset role');
        }
    };
    const applyAll = async () => {
        for (const f of migrations) await rt.exec(sql(dir, f));
    };
    const rollbackAll = async () => {
        for (const f of rollbacks) await rt.exec(sql(rollbackDir, f));
    };

    beforeAll(async () => {
        rt = new PGlite();
        await rt.exec(SUPABASE_STUB);
        await rt.exec(sql(dir, migrations[0]));
        await rt.exec(LEGACY_ROWS);
        await applyAll();
        // Post-migration workflow activity: advance a legacy row and create a new-workflow row.
        const [a] = await q<{ id: string; version: number }>(`select id, version from public.articles where title = 'In review'`);
        const ev = JSON.stringify({ event_type: 'transition', action: 'advance', from_status: 'IT_REVIEW', to_status: 'TECH_REVIEW', actor_id: 's1', actor_role: 'it_reviewer' });
        await q(`select public.apply_article_change($1, 'IT_REVIEW', $2, 'TECH_REVIEW', '{}', $3, '[]')`, [a.id, a.version, ev]);
        const sub = JSON.stringify({ event_type: 'submitted', actor_id: 'public', actor_role: 'contributor' });
        await q(`select public.create_submission($1, $2, '[]')`, [
            JSON.stringify({ reference_code: 'ITM-2026-ABC123', title: 'New one', description: 'd', author_name: 'N', submitted_email: 'n@cu.in', contributor_token_hash: 'deadbeef' }),
            sub,
        ]);
    }, 60_000);

    it('the 0002 rollback refuses to discard post-migration workflow data without the explicit override', async () => {
        for (const f of rollbacks.filter((f) => !f.startsWith('20261008000200'))) await rt.exec(sql(rollbackDir, f));
        await expect(rt.exec(sql(rollbackDir, '20261008000200_down.sql'))).rejects.toThrow(/Refusing to roll back 0002/);
        await rt.exec('rollback');
        expect((await q<{ status: string }>(`select status from public.articles where title = 'In review'`))[0].status).toBe('TECH_REVIEW');
    });

    it('with the override, rolls back to legacy statuses and snapshots the discarded state', async () => {
        await rt.exec(`set itmuseum.rollback_discard_workflow = 'on'`);
        await rt.exec(sql(rollbackDir, '20261008000200_down.sql'));
        await rt.exec(`reset itmuseum.rollback_discard_workflow`);
        const byTitle = Object.fromEntries((await q<{ title: string; status: string }>('select title, status from public.articles')).map((r) => [r.title, r.status]));
        expect(byTitle['In review']).toBe('ADMIN_APPROVED');
        expect(byTitle['Rejected by tech']).toBe('IT_REJECTED');
        expect(byTitle['New one']).toBe('SUBMITTED');
        const [snap] = await q<{ article: { status: string } }>(`select article from migration_backup.articles_workflow_rollback where article->>'title' = 'In review'`);
        expect(snap.article.status).toBe('TECH_REVIEW');
        expect(await q(`select to_regclass('public.article_events_rolled_back') is not null as ok`)).toEqual([{ ok: true }]);
    });

    it('after the 0003 rollback anon gets back only the captured pre-state, never the 0002 columns or tables', async () => {
        // Pre-0003 state in the fixture: "old open policy" + grant all on articles to anon.
        expect((await q(`select 1 from pg_policies where policyname = 'old open policy'`)).length).toBe(1);
        expect((await q(`select 1 from pg_policies where policyname = 'anon can upload reports'`)).length).toBe(1);
        expect((await q<{ public: boolean }>(`select public from storage.buckets where id = 'reports'`))[0].public).toBe(true);
        const legacy = await asAnon(() => q<{ title: string }>('select id, title, status, file_url from public.articles order by title'));
        expect(legacy.length).toBe(7);
        for (const col of ['contributor_token_hash', 'similarity_report_path', 'ai_report_path', 'staged_pdf_path', 'reference_code', 'assignee_id']) {
            await expect(asAnon(() => q(`select ${col} from public.articles`)), col).rejects.toThrow(/permission denied/);
        }
        await expect(asAnon(() => q('select * from public.articles'))).rejects.toThrow(/permission denied/);
        await expect(asAnon(() => q('select * from public.staff_members'))).rejects.toThrow(/permission denied/);
        // authorized_users had no anon grant before 0003 in the fixture, so it stays closed.
        await expect(asAnon(() => q('select * from public.authorized_users'))).rejects.toThrow(/permission denied/);
    });

    it('re-applies cleanly: no status-check failure, old statuses re-mapped, references kept', async () => {
        // While rolled back, the old frontend may write old-vocabulary statuses.
        await q(`update public.articles set status = 'IT_APPROVED' where title = 'New one'`);
        await applyAll();
        const r = await q<{ title: string; status: string; reference_code: string; legacy_status: string | null }>(
            'select title, status, reference_code, legacy_status from public.articles',
        );
        const byTitle = Object.fromEntries(r.map((x) => [x.title, x]));
        expect(byTitle['In review']).toMatchObject({ status: 'IT_REVIEW', legacy_status: 'ADMIN_APPROVED' });
        expect(byTitle['In review'].reference_code).toMatch(/^ITM-LEGACY-/);
        expect(byTitle['Rejected by tech'].status).toBe('REJECTED');
        expect(byTitle['New one']).toMatchObject({ status: 'TECH_REVIEW', reference_code: 'ITM-2026-ABC123', legacy_status: 'IT_APPROVED' });
        // Fresh audit log and indexes; one legacy_import event per re-mapped row only.
        const imports = await q<{ metadata: Record<string, unknown> }>(`select metadata from public.article_events where event_type = 'legacy_import'`);
        // Every row with an old-vocabulary status (5 legacy rows + 'New one'); 'Live' (PUBLISHED) is canonical and untouched.
        expect(imports.length).toBe(6);
        expect(imports.filter((i) => i.metadata.remapped_after_rollback === true).length).toBe(6);
        for (const i of ['article_events_article_idx', 'article_events_created_at_idx', 'notification_outbox_due_idx']) {
            expect((await q('select 1 from pg_indexes where indexname = $1', [i])).length, i).toBe(1);
        }
        // Access is locked again and the re-apply captured a fresh pre-state.
        await expect(asAnon(() => q('select title from public.articles'))).rejects.toThrow(/permission denied/);
        expect((await q('select * from migration_backup.pre_0003_capture where restored_at is null')).length).toBe(1);
    });

    it('a second full rollback + re-apply also works', async () => {
        await rt.exec(`set itmuseum.rollback_discard_workflow = 'on'`);
        await rollbackAll();
        await rt.exec(`reset itmuseum.rollback_discard_workflow`);
        await applyAll();
        expect((await q(`select 1 from public.articles where status not in ('SUBMITTED','IT_REVIEW','TECH_REVIEW','LIT_REVIEW','FINAL_APPROVAL','CHANGES_REQUESTED','REJECTED','PUBLISHED','UNPUBLISHED')`)).length).toBe(0);
    });
});

describe('0003 rollback without a captured pre-state', () => {
    it('applies only the documented minimal public-read state', async () => {
        const m = new PGlite();
        await m.exec(SUPABASE_STUB);
        await m.exec(sql(dir, migrations[0]));
        await m.exec(LEGACY_ROWS);
        for (const f of migrations.slice(1)) await m.exec(sql(dir, f));
        // Simulate 0003 applied by an older version of the file (no capture tables).
        await m.exec('drop table migration_backup.pre_0003_grants, migration_backup.pre_0003_rls, migration_backup.pre_0003_buckets, migration_backup.pre_0003_capture');
        await m.exec(sql(rollbackDir, '20261008000400_down.sql'));
        await m.exec(sql(rollbackDir, '20261008000300_down.sql'));
        await m.exec('set role anon');
        try {
            const pub = (await m.query<{ title: string }>('select title, file_url from public.articles')).rows;
            expect(pub.map((p) => p.title)).toEqual(['Live']);
            for (const col of ['submitted_email', 'institution_email', 'similarity_report_url', 'contributor_token_hash']) {
                await expect(m.query(`select ${col} from public.articles`), col).rejects.toThrow(/permission denied/);
            }
            await expect(m.query('select * from public.authorized_users')).rejects.toThrow(/permission denied/);
            expect((await m.query('select * from public.sections')).rows.length).toBe(1);
        } finally {
            await m.exec('reset role');
        }
        expect((await m.query<{ public: boolean }>(`select public from storage.buckets where id = 'reports'`)).rows[0].public).toBe(false);
    }, 60_000);
});
