import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addNote,
    articleDetail,
    listQueue,
    lookupStatus,
    resolveStaff,
    resubmit,
    retryStorageCleanup,
    stageFinalPdf,
    submitArticle,
    transition,
    updateMetadata,
    upsertStaff,
    HttpError,
} from '../supabase/functions/_shared/service.ts';
import { BUCKETS, ConflictError, type StaffMember } from '../supabase/functions/_shared/types.ts';
import type { StaffRole } from '../supabase/functions/_shared/workflow.ts';
import { pdf, testDeps, validSubmission } from './helpers/memory.ts';

type Env = ReturnType<typeof testDeps>;
let env: Env;
let team: Record<StaffRole, StaffMember>;

async function makeStaff(role: StaffRole): Promise<StaffMember> {
    const m = await env.repo.upsertStaff({ email: `${role}@christuniversity.in`, display_name: role, role, active: true });
    await env.repo.linkStaffUid(m.id, `uid-${role}`);
    return resolveStaff(env.deps, { uid: `uid-${role}`, email: m.email, emailVerified: true });
}

beforeEach(async () => {
    env = testDeps();
    team = {
        admin: await makeStaff('admin'),
        it_reviewer: await makeStaff('it_reviewer'),
        tech_reviewer: await makeStaff('tech_reviewer'),
        lit_reviewer: await makeStaff('lit_reviewer'),
    };
});

async function submit() {
    const r = await submitArticle(env.deps, validSubmission(), { similarity: pdf(), ai: pdf() });
    if (r.duplicate) throw new Error('unexpected duplicate');
    return r;
}

async function act(role: StaffRole, id: string, action: string, reason?: string) {
    const a = await env.repo.getArticle(id);
    return transition(env.deps, team[role], { id, action, reason, expectedVersion: a!.version });
}

describe('complete journey: submit → review → publish', () => {
    it('moves through every stage, publishes as admin and notifies the contributor', async () => {
        const { id, reference, accessKey } = await submit();
        expect(reference).toMatch(/^ITM-\d{4}-/);

        // Reports are private and only reachable through signed URLs.
        const stored = env.articles.get(id)!;
        expect(stored.similarity_report_path).toBeTruthy();
        expect(env.objects.has(`${BUCKETS.reports}/${stored.similarity_report_path}`)).toBe(true);
        expect(stored.contributor_token_hash).not.toBe(accessKey);

        await act('admin', id, 'advance');
        await act('it_reviewer', id, 'advance');
        await act('tech_reviewer', id, 'advance');
        await addNote(env.deps, team.lit_reviewer, { id, body: 'Citations checked; two minor typos fixed in the doc.' });
        await act('lit_reviewer', id, 'advance');
        expect(env.articles.get(id)!.status).toBe('FINAL_APPROVAL');

        // Admin prepares publication.
        let a = env.articles.get(id)!;
        await updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { tags: ['TIFRAC', 'computing history'] } });
        a = env.articles.get(id)!;
        await stageFinalPdf(env.deps, team.admin, { id, expectedVersion: a.version, file: pdf('final.pdf') });
        const detail = await articleDetail(env.deps, team.admin, id);
        expect(detail.checklist.every((c) => c.ok)).toBe(true);
        expect(detail.files.stagedPdfUrl).toContain('signed.example');
        expect('contributor_token_hash' in detail.article).toBe(false);

        await act('admin', id, 'publish');
        a = env.articles.get(id)!;
        expect(a.status).toBe('PUBLISHED');
        expect(a.published_at).toBeTruthy();
        expect(a.published_pdf_url).toContain('/object/public/articles/');
        expect(env.objects.has(`${BUCKETS.public}/${a.published_pdf_path}`)).toBe(true);

        // Audit trail has every step with an actor.
        const actions = env.events.filter((e) => e.article_id === id).map((e) => e.action ?? e.event_type);
        expect(actions).toEqual(['submitted', 'advance', 'advance', 'advance', 'note', 'advance', 'metadata', 'file', 'publish']);
        expect(env.events.every((e) => e.actor_id && e.actor_role)).toBe(true);

        // Contributor emails: received + published.
        expect(env.outbox.map((n) => n.template)).toEqual(['submission_received', 'published']);

        const view = await lookupStatus(env.deps, reference, accessKey);
        expect(view.status).toBe('PUBLISHED');
        expect(view.publishedId).toBe(id);
    });
});

describe('authorisation', () => {
    it('denies by default: unknown or inactive accounts get no access', async () => {
        await expect(resolveStaff(env.deps, { uid: 'stranger', email: 'admin.fake@christuniversity.in', emailVerified: true })).rejects.toMatchObject({ status: 403 });
        const inactive = await env.repo.upsertStaff({ email: 'old@christuniversity.in', display_name: 'Old', role: 'admin', active: false });
        await expect(resolveStaff(env.deps, { uid: 'x', email: inactive.email, emailVerified: true })).rejects.toMatchObject({ code: 'NOT_STAFF' });
    });

    describe('linking a Firebase account to a staff record', () => {
        const provision = (email: string, active = true) =>
            env.repo.upsertStaff({ email, display_name: 'New Reviewer', role: 'it_reviewer', active });

        it('refuses to link (or grant access) by email when the email is not verified', async () => {
            const m = await provision('new.reviewer@christuniversity.in');
            await expect(resolveStaff(env.deps, { uid: 'attacker', email: m.email, emailVerified: false })).rejects.toMatchObject({
                status: 403,
                code: 'EMAIL_UNVERIFIED',
            });
            expect(env.staff.get(m.id)!.firebase_uid).toBeNull();
            // The real owner can still claim the record once verified.
            const owner = await resolveStaff(env.deps, { uid: 'owner', email: m.email, emailVerified: true });
            expect(owner.id).toBe(m.id);
        });

        it('gives the same unverified answer whether or not the address is staff (no membership probe)', async () => {
            await expect(resolveStaff(env.deps, { uid: 'u1', email: 'nobody@example.com', emailVerified: false })).rejects.toMatchObject({
                code: 'EMAIL_UNVERIFIED',
            });
        });

        it('links a verified email on first sign-in, case-insensitively, and then trusts the uid', async () => {
            const m = await provision('new.reviewer@christuniversity.in');
            const first = await resolveStaff(env.deps, { uid: 'fb-1', email: 'New.Reviewer@ChristUniversity.in', emailVerified: true });
            expect(first).toMatchObject({ id: m.id, firebase_uid: 'fb-1', role: 'it_reviewer' });
            expect(env.staff.get(m.id)!.firebase_uid).toBe('fb-1');
            const again = await resolveStaff(env.deps, { uid: 'fb-1', email: m.email, emailVerified: true });
            expect(again.id).toBe(m.id);
        });

        it('keeps an already-linked uid working even if the token says the email is unverified', async () => {
            // Linking is the trust decision; the uid is immutable. Existing staff must not be locked out.
            const linked = await resolveStaff(env.deps, { uid: 'uid-admin', email: null, emailVerified: false });
            expect(linked.id).toBe(team.admin.id);
        });

        it('denies an email match whose record is already linked to a different uid', async () => {
            await expect(resolveStaff(env.deps, { uid: 'other', email: team.admin.email, emailVerified: true })).rejects.toMatchObject({
                status: 403,
                code: 'NOT_STAFF',
            });
            expect(env.staff.get(team.admin.id)!.firebase_uid).toBe('uid-admin');
        });

        it('denies the loser of a concurrent link race', async () => {
            const m = await provision('race@christuniversity.in');
            // Simulate a concurrent request that links the row after our lookup but before our update.
            const realFind = env.repo.findStaffByEmail;
            env.repo.findStaffByEmail = async (email) => {
                const row = await realFind(email);
                env.staff.get(m.id)!.firebase_uid = 'winner';
                return row;
            };
            await expect(resolveStaff(env.deps, { uid: 'loser', email: m.email, emailVerified: true })).rejects.toMatchObject({
                status: 403,
                code: 'NOT_STAFF',
            });
            env.repo.findStaffByEmail = realFind;
            expect(env.staff.get(m.id)!.firebase_uid).toBe('winner');
            expect((await resolveStaff(env.deps, { uid: 'winner', email: m.email, emailVerified: true })).id).toBe(m.id);
        });

        it('grants a race loser only when the re-read shows this uid owns the record (same user, two tabs)', async () => {
            const m = await provision('tabs@christuniversity.in');
            const realFind = env.repo.findStaffByEmail;
            env.repo.findStaffByEmail = async (email) => {
                const row = await realFind(email);
                env.staff.get(m.id)!.firebase_uid = 'same-user';
                return row;
            };
            const staff = await resolveStaff(env.deps, { uid: 'same-user', email: m.email, emailVerified: true });
            env.repo.findStaffByEmail = realFind;
            expect(staff.id).toBe(m.id);
        });

        it('does not link or admit inactive staff', async () => {
            const m = await provision('inactive@christuniversity.in', false);
            await expect(resolveStaff(env.deps, { uid: 'fb-x', email: m.email, emailVerified: true })).rejects.toMatchObject({ code: 'NOT_STAFF' });
            expect(env.staff.get(m.id)!.firebase_uid).toBeNull();
            // An already-linked account that is later deactivated is denied too.
            env.staff.get(team.it_reviewer.id)!.active = false;
            await expect(resolveStaff(env.deps, { uid: 'uid-it_reviewer', email: team.it_reviewer.email, emailVerified: true })).rejects.toMatchObject({
                code: 'NOT_STAFF',
            });
        });

        it('denies a token without an email that matches no linked uid', async () => {
            await expect(resolveStaff(env.deps, { uid: 'anon', email: null, emailVerified: false })).rejects.toMatchObject({ code: 'NOT_STAFF' });
        });
    });

    it('does not infer roles from email text', async () => {
        // The old code made anyone with "admin" in their email an admin.
        await expect(resolveStaff(env.deps, { uid: 'u', email: 'itmuseum.admin2@christuniversity.in', emailVerified: true })).rejects.toBeInstanceOf(HttpError);
    });

    it('reviewers cannot see or act on other queues', async () => {
        const { id } = await submit();
        await expect(articleDetail(env.deps, team.it_reviewer, id)).rejects.toMatchObject({ status: 404 });
        await expect(act('it_reviewer', id, 'advance')).rejects.toMatchObject({ status: 404 });
        await act('admin', id, 'advance');
        await expect(act('tech_reviewer', id, 'advance')).rejects.toMatchObject({ status: 404 });
        await expect(listQueue(env.deps, team.it_reviewer, { statuses: ['FINAL_APPROVAL'] })).rejects.toMatchObject({ status: 403 });
        expect((await listQueue(env.deps, team.it_reviewer, {})).map((r) => r.id)).toEqual([id]);
    });

    it('only admins edit metadata, stage PDFs and manage staff', async () => {
        const { id } = await submit();
        await expect(updateMetadata(env.deps, team.lit_reviewer, { id, expectedVersion: 1, fields: { title: 'Changed title' } })).rejects.toMatchObject({ status: 403 });
        await expect(stageFinalPdf(env.deps, team.it_reviewer, { id, expectedVersion: 1, file: pdf() })).rejects.toMatchObject({ status: 403 });
        await expect(
            upsertStaff(env.deps, team.tech_reviewer, { email: 'x@y.in', display_name: 'X', role: 'admin', active: true }),
        ).rejects.toMatchObject({ status: 403 });
    });

    it('an admin cannot lock themselves out', async () => {
        await expect(
            upsertStaff(env.deps, team.admin, { id: team.admin.id, email: team.admin.email, display_name: 'A', role: 'it_reviewer', active: true }),
        ).rejects.toMatchObject({ code: 'SELF_LOCKOUT' });
    });

    it('never leaves zero active admins (database guard mapped to 409 LAST_ADMIN)', async () => {
        const second = await env.repo.upsertStaff({ email: 'second@christuniversity.in', display_name: 'Second', role: 'admin', active: true });
        const demote = (target: StaffMember) => ({ id: target.id, email: target.email, display_name: target.display_name, role: 'it_reviewer', active: true });
        // Two active admins: demoting the other one is fine...
        await expect(upsertStaff(env.deps, team.admin, demote(second))).resolves.toMatchObject({ role: 'it_reviewer' });
        // ...but an admin acting from a stale view (e.g. `second` before its demotion
        // landed, the concurrent "demote each other" case) cannot remove the last one.
        const err = await upsertStaff(env.deps, { ...second, role: 'admin' }, demote(team.admin)).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(HttpError);
        expect(err).toMatchObject({ status: 409, code: 'LAST_ADMIN' });
        expect((err as Error).message).toMatch(/at least one active admin/i);
        // Deactivating the last admin is refused the same way.
        await expect(
            upsertStaff(env.deps, { ...second, role: 'admin' }, { ...demote(team.admin), role: 'admin', active: false }),
        ).rejects.toMatchObject({ status: 409, code: 'LAST_ADMIN' });
        expect(env.staff.get(team.admin.id)).toMatchObject({ role: 'admin', active: true });
    });
});

describe('concurrency', () => {
    it('rejects a second decision made from a stale view', async () => {
        const { id } = await submit();
        const loaded = env.articles.get(id)!.version;
        await transition(env.deps, team.admin, { id, action: 'advance', expectedVersion: loaded });
        // A second admin tab still holding the old version:
        await expect(
            transition(env.deps, team.admin, { id, action: 'reject', reason: 'Out of scope for the archive.', expectedVersion: loaded }),
        ).rejects.toBeInstanceOf(ConflictError);
        expect(env.articles.get(id)!.status).toBe('IT_REVIEW');
    });

    it('the repository compare-and-swap rejects stale writes', async () => {
        const { id } = await submit();
        await env.repo.applyChange({
            id,
            expectedStatus: 'SUBMITTED',
            expectedVersion: 1,
            newStatus: 'IT_REVIEW',
            patch: {},
            event: { event_type: 'transition', action: 'advance', from_status: 'SUBMITTED', to_status: 'IT_REVIEW', actor_id: 'a', actor_role: 'admin', actor_label: null, reason: null, visibility: 'internal', metadata: {} },
            notifications: [],
        });
        await expect(
            env.repo.applyChange({
                id,
                expectedStatus: 'SUBMITTED',
                expectedVersion: 1,
                newStatus: 'REJECTED',
                patch: {},
                event: { event_type: 'transition', action: 'reject', from_status: 'SUBMITTED', to_status: 'REJECTED', actor_id: 'b', actor_role: 'admin', actor_label: null, reason: 'x', visibility: 'internal', metadata: {} },
                notifications: [],
            }),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('transition() checks the version the reviewer saw', async () => {
        const { id } = await submit();
        await expect(transition(env.deps, team.admin, { id, action: 'advance', expectedVersion: 99 })).rejects.toBeInstanceOf(ConflictError);
    });
});

describe('revision and rejection', () => {
    it('request changes → contributor resubmits → returns to the requesting stage', async () => {
        const { id, reference, accessKey } = await submit();
        await act('admin', id, 'advance');
        await act('it_reviewer', id, 'advance');
        await addNote(env.deps, team.tech_reviewer, { id, body: 'INTERNAL: suspect figures copied from a blog.' });
        await act('tech_reviewer', id, 'request_changes', 'Please add sources for the 1962 benchmark figures.');
        // Once decided, the article leaves the technical queue.
        await expect(articleDetail(env.deps, team.tech_reviewer, id)).rejects.toMatchObject({ status: 404 });

        const view = await lookupStatus(env.deps, reference, accessKey);
        expect(view.status).toBe('CHANGES_REQUESTED');
        expect(view.reason).toBe('Please add sources for the 1962 benchmark figures.');
        expect(JSON.stringify(view)).not.toContain('INTERNAL');

        await resubmit(env.deps, reference, accessKey, {
            note: 'Added three archival sources and a footnote.',
            manuscriptUrl: 'https://docs.google.com/document/d/1NewVersionAbcdef/edit',
            similarity: pdf('new-sim.pdf'),
        });
        const a = env.articles.get(id)!;
        expect(a.status).toBe('TECH_REVIEW');
        expect(a.return_to_stage).toBeNull();
        expect(a.manuscript_url).toContain('1NewVersionAbcdef');
        expect(env.outbox.map((n) => n.template)).toEqual(['submission_received', 'changes_requested', 'revision_received']);
    });

    it('rejection records the stage and reason; admin can reopen with a reason', async () => {
        const { id, reference, accessKey } = await submit();
        await act('admin', id, 'advance');
        await act('it_reviewer', id, 'reject', 'The topic is outside the museum’s scope.');
        expect(env.articles.get(id)!).toMatchObject({ status: 'REJECTED', rejected_at_stage: 'IT_REVIEW' });
        expect((await lookupStatus(env.deps, reference, accessKey)).label).toBe('Not accepted');
        await expect(act('admin', id, 'reopen')).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
        await act('admin', id, 'reopen', 'Scope decision overturned by the board.');
        expect(env.articles.get(id)!.status).toBe('IT_REVIEW');
    });

    it('wrong access keys reveal nothing', async () => {
        const { reference } = await submit();
        await expect(lookupStatus(env.deps, reference, 'guess')).rejects.toMatchObject({ status: 404 });
        await expect(lookupStatus(env.deps, 'ITM-2026-ZZZZZZ', 'guess')).rejects.toMatchObject({ status: 404 });
    });
});

describe('publication management', () => {
    async function publishOne() {
        const { id } = await submit();
        for (const r of ['admin', 'it_reviewer', 'tech_reviewer', 'lit_reviewer'] as StaffRole[]) await act(r, id, 'advance');
        let a = env.articles.get(id)!;
        await updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { tags: ['history'] } });
        a = env.articles.get(id)!;
        await stageFinalPdf(env.deps, team.admin, { id, expectedVersion: a.version, file: pdf('final.pdf') });
        await act('admin', id, 'publish');
        return id;
    }

    it('unpublishing removes the public PDF but keeps a private copy and the audit trail', async () => {
        const id = await publishOne();
        const publicPath = env.articles.get(id)!.published_pdf_path!;
        await act('admin', id, 'unpublish', 'Author asked for a correction to a figure.');
        const a = env.articles.get(id)!;
        expect(a.status).toBe('UNPUBLISHED');
        expect(a.published_pdf_url).toBeNull();
        expect(env.objects.has(`${BUCKETS.public}/${publicPath}`)).toBe(false);
        expect(env.objects.has(`${BUCKETS.staging}/${a.staged_pdf_path}`)).toBe(true);
        expect(env.events.filter((e) => e.article_id === id).length).toBeGreaterThan(5);

        await act('admin', id, 'publish');
        expect(env.articles.get(id)!.status).toBe('PUBLISHED');
    });

    it('rejects non-PDF uploads by content, not just by name', async () => {
        await expect(
            submitArticle(env.deps, validSubmission(), { similarity: { name: 'fake.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('<html>') }, ai: pdf() }),
        ).rejects.toMatchObject({ code: 'INVALID_FILE' });
        expect(env.articles.size).toBe(0);
    });

    it('rejects invalid submissions with field errors and stores nothing', async () => {
        await expect(submitArticle(env.deps, { ...validSubmission(), manuscriptUrl: 'https://evil.example/doc' }, { similarity: pdf(), ai: pdf() })).rejects.toMatchObject({
            status: 422,
            fieldErrors: { manuscriptUrl: expect.any(String) },
        });
        expect(env.objects.size).toBe(0);
    });
});

describe('malformed request shapes are 400/422, never 500', () => {
    const bad = (status: number) => expect.objectContaining({ status, name: 'HttpError' });

    it('rejects null and non-object submissions', async () => {
        for (const input of [null, undefined, 'x', 7, [], true]) {
            await expect(submitArticle(env.deps, input as never, { similarity: pdf(), ai: pdf() })).rejects.toEqual(bad(400));
        }
    });

    it('rejects wrongly typed submission fields', async () => {
        const files = { similarity: pdf(), ai: pdf() };
        await expect(submitArticle(env.deps, { ...validSubmission(), title: 123 } as never, files)).rejects.toEqual(bad(400));
        await expect(submitArticle(env.deps, { ...validSubmission(), authors: 'nope' } as never, files)).rejects.toEqual(bad(400));
        await expect(submitArticle(env.deps, { ...validSubmission(), authors: [null] } as never, files)).rejects.toEqual(bad(400));
        await expect(submitArticle(env.deps, { ...validSubmission(), authors: [{ name: 1, email: 'a@b.co', designation: 'x' }] } as never, files)).rejects.toEqual(bad(400));
        expect(env.articles.size).toBe(0);
    });

    it('rejects a non-string or oversized transition reason', async () => {
        const { id } = await submit();
        const v = env.articles.get(id)!.version;
        await expect(transition(env.deps, team.admin, { id, action: 'reject', reason: { a: 1 } as never, expectedVersion: v })).rejects.toEqual(bad(400));
        await expect(transition(env.deps, team.admin, { id, action: 'reject', reason: 'x'.repeat(2001), expectedVersion: v })).rejects.toMatchObject({
            status: 422,
            code: 'REASON_TOO_LONG',
        });
        expect(env.articles.get(id)!.status).toBe('SUBMITTED');
    });

    it.each([
        ['statuses not an array', { statuses: 'SUBMITTED' }],
        ['statuses containing non-strings', { statuses: [1, null] }],
        ['search not a string', { search: { $ne: 1 } }],
        ['limit not a number', { limit: '10' }],
        ['limit NaN-ish', { limit: Number.POSITIVE_INFINITY }],
        ['limit negative', { limit: -5 }],
        ['minAgeDays negative', { minAgeDays: -1 }],
        ['minAgeDays not a number', { minAgeDays: 'x' }],
        ['assignee not a uuid', { assignee: "x'; drop table" }],
        ['assignee not a string', { assignee: 5 }],
        ['submittedFrom garbage', { submittedFrom: 'not-a-date' }],
        ['submittedTo garbage', { submittedTo: '99999999-99-99' }],
        ['submittedFrom wrong type', { submittedFrom: 12 }],
        ['query itself not an object', 'oops'],
        ['query an array', []],
    ])('listQueue: %s', async (_name, query) => {
        await expect(listQueue(env.deps, team.admin, query as never)).rejects.toEqual(bad(400));
    });

    it('listQueue accepts null/absent filters and well-formed ones', async () => {
        const { id } = await submit();
        expect((await listQueue(env.deps, team.admin, null as never)).map((r) => r.id)).toEqual([id]);
        const rows = await listQueue(env.deps, team.admin, {
            statuses: ['SUBMITTED'],
            search: 'TIFRAC',
            assignee: 'unassigned',
            minAgeDays: 0,
            limit: 10,
            submittedFrom: '2020-01-01T00:00:00Z',
            submittedTo: '2099-01-01',
        });
        expect(rows.map((r) => r.id)).toEqual([id]);
    });

    it('caps admin-edited description and author credit', async () => {
        const { id } = await submit();
        await act('admin', id, 'advance');
        const a = env.articles.get(id)!;
        await expect(updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { description: 'd'.repeat(3001) } })).rejects.toMatchObject({
            status: 422,
            fieldErrors: { description: expect.any(String) },
        });
        await expect(updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { author_name: 'n'.repeat(1300) } })).rejects.toMatchObject({
            status: 422,
            fieldErrors: { author_name: expect.any(String) },
        });
        await expect(updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { description: 'd'.repeat(3000) } })).resolves.toBeTruthy();
    });
});

describe('storage consistency', () => {
    /** Bring an article to final approval with a staged PDF, ready to publish. */
    async function readyToPublish() {
        const { id } = await submit();
        for (const r of ['admin', 'it_reviewer', 'tech_reviewer', 'lit_reviewer'] as StaffRole[]) await act(r, id, 'advance');
        let a = env.articles.get(id)!;
        await updateMetadata(env.deps, team.admin, { id, expectedVersion: a.version, fields: { tags: ['history'] } });
        a = env.articles.get(id)!;
        await stageFinalPdf(env.deps, team.admin, { id, expectedVersion: a.version, file: pdf('final.pdf') });
        return id;
    }

    const opIndex = (op: string, path?: string) => env.ops.findIndex((o) => o.op === op && (path === undefined || o.path === path));
    const lastCommit = () => env.ops.map((o) => o.op).lastIndexOf('commit');
    const cleanupEvents = (id: string) => env.events.filter((e) => e.article_id === id && e.event_type === 'file' && 'storage_cleanup' in e.metadata);

    it('two concurrent publishes: the loser removes only its own copy, never the winner’s live PDF', async () => {
        const id = await readyToPublish();
        const v = env.articles.get(id)!.version;
        env.ops.length = 0;

        // Hold both attempts at the database until both have copied their PDF, then let them race.
        const real = env.repo.applyChange;
        let arrived = 0;
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        env.repo.applyChange = async (args) => {
            if (++arrived === 2) release();
            await gate;
            return real(args);
        };
        const results = await Promise.allSettled([
            transition(env.deps, team.admin, { id, action: 'publish', expectedVersion: v }),
            transition(env.deps, team.admin, { id, action: 'publish', expectedVersion: v }),
        ]);
        env.repo.applyChange = real;

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toBeInstanceOf(ConflictError);

        const row = env.articles.get(id)!;
        expect(row.status).toBe('PUBLISHED');
        // The committed row points at an object that exists, with a matching URL.
        expect(env.objects.has(`${BUCKETS.public}/${row.published_pdf_path}`)).toBe(true);
        expect(row.published_pdf_url).toBe(env.files.publicUrl(BUCKETS.public, row.published_pdf_path!));

        const copies = env.ops.filter((o) => o.op === 'copy' && o.bucket === BUCKETS.public);
        expect(copies).toHaveLength(2);
        expect(copies.every((c) => c.ok)).toBe(true); // nothing was overwritten
        expect(new Set(copies.map((c) => c.path)).size).toBe(2);
        const loserPath = copies.find((c) => c.path !== row.published_pdf_path)!.path;
        expect(env.ops.filter((o) => o.op === 'remove').map((o) => o.path)).toEqual([loserPath]);
        expect(env.objects.has(`${BUCKETS.public}/${loserPath}`)).toBe(false);
    });

    it('keeps the copied PDF when the commit succeeded but its response was lost', async () => {
        const id = await readyToPublish();
        const v = env.articles.get(id)!.version;
        const real = env.repo.applyChange;
        env.repo.applyChange = async (args) => {
            await real(args);
            throw new Error('connection reset');
        };
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await expect(transition(env.deps, team.admin, { id, action: 'publish', expectedVersion: v })).rejects.toThrow('connection reset');
        env.repo.applyChange = real;
        warn.mockRestore();

        const row = env.articles.get(id)!;
        expect(row.status).toBe('PUBLISHED');
        expect(env.objects.has(`${BUCKETS.public}/${row.published_pdf_path}`)).toBe(true);
        expect(env.ops.some((o) => o.op === 'remove' && o.bucket === BUCKETS.public)).toBe(false);
    });

    it('copy never overwrites an existing object (matches the real adapter)', async () => {
        await env.files.put(BUCKETS.staging, 'a.pdf', new Uint8Array([1]), 'application/pdf');
        await env.files.put(BUCKETS.public, 'b.pdf', new Uint8Array([2]), 'application/pdf');
        await expect(env.files.copy(BUCKETS.staging, 'a.pdf', BUCKETS.public, 'b.pdf')).rejects.toThrow('exists');
        expect(env.objects.get(`${BUCKETS.public}/b.pdf`)).toEqual(new Uint8Array([2]));
    });

    it('unpublish: a failing public delete is retried, logged, recorded, and recoverable by an admin', async () => {
        const id = await readyToPublish();
        await act('admin', id, 'publish');
        const publicPath = env.articles.get(id)!.published_pdf_path!;
        env.faults.remove = (bucket) => bucket === BUCKETS.public;
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        env.ops.length = 0;
        env.sleeps.length = 0;

        // The unpublish itself succeeds: the database change has committed.
        await act('admin', id, 'unpublish', 'Author asked for a correction.');
        const a = env.articles.get(id)!;
        expect(a.status).toBe('UNPUBLISHED');
        expect(a.published_pdf_url).toBeNull();

        // Bounded retry with backoff, all after the commit.
        const removes = env.ops.filter((o) => o.op === 'remove' && o.path === publicPath);
        expect(removes).toHaveLength(3);
        expect(opIndex('remove', publicPath)).toBeGreaterThan(lastCommit());
        expect(env.sleeps).toEqual([250, 500]);
        expect(env.objects.has(`${BUCKETS.public}/${publicPath}`)).toBe(true);

        // Logged (no secrets) and durably traced.
        expect(error).toHaveBeenCalledTimes(1);
        const logged = String(error.mock.calls[0][0]);
        expect(logged).toContain('storage clean-up failed');
        expect(logged).toContain(publicPath);
        expect(logged).not.toContain(a.contributor_token_hash!);
        expect(cleanupEvents(id).map((e) => e.metadata)).toEqual([
            expect.objectContaining({ storage_cleanup: 'failed', bucket: BUCKETS.public, path: publicPath, purpose: 'unpublished', attempts: 3 }),
        ]);
        const pending = [{ bucket: BUCKETS.public, path: publicPath, purpose: 'unpublished' }];
        expect((await articleDetail(env.deps, team.admin, id)).pendingStorageCleanup).toEqual(pending);

        // Only admins may retry; a retry that still fails stays pending.
        await expect(retryStorageCleanup(env.deps, team.lit_reviewer, { id })).rejects.toMatchObject({ status: 403 });
        expect(await retryStorageCleanup(env.deps, team.admin, { id })).toMatchObject({ removed: [], failed: pending });
        expect((await articleDetail(env.deps, team.admin, id)).pendingStorageCleanup).toEqual(pending);

        // Storage recovers: the retry removes the object and resolves the record.
        env.faults.remove = () => false;
        expect(await retryStorageCleanup(env.deps, team.admin, { id })).toMatchObject({ removed: pending, failed: [] });
        expect(env.objects.has(`${BUCKETS.public}/${publicPath}`)).toBe(false);
        expect((await articleDetail(env.deps, team.admin, id)).pendingStorageCleanup).toEqual([]);
        expect(cleanupEvents(id).at(-1)!.metadata).toMatchObject({ storage_cleanup: 'done', path: publicPath });
        error.mockRestore();
    });

    it('retry never removes an object the row references again', async () => {
        const id = await readyToPublish();
        await act('admin', id, 'publish');
        const row = env.articles.get(id)!;
        // A (hypothetical) stale failure record for the object that is live right now.
        await env.repo.insertEvent({
            article_id: id,
            event_type: 'file',
            action: null,
            from_status: null,
            to_status: null,
            actor_id: 'storage-cleanup',
            actor_role: 'system',
            actor_label: null,
            reason: null,
            visibility: 'internal',
            metadata: { storage_cleanup: 'failed', bucket: BUCKETS.public, path: row.published_pdf_path, purpose: 'unpublished' },
        });
        const result = await retryStorageCleanup(env.deps, team.admin, { id });
        expect(result.skipped).toHaveLength(1);
        expect(env.objects.has(`${BUCKETS.public}/${row.published_pdf_path}`)).toBe(true);
        expect((await articleDetail(env.deps, team.admin, id)).pendingStorageCleanup).toEqual([]);
    });

    it('replacing a staged PDF deletes the previous one only after the commit', async () => {
        const id = await readyToPublish();
        const first = env.articles.get(id)!.staged_pdf_path!;
        env.ops.length = 0;
        await stageFinalPdf(env.deps, team.admin, { id, expectedVersion: env.articles.get(id)!.version, file: pdf('final-v2.pdf') });
        const second = env.articles.get(id)!.staged_pdf_path!;
        expect(second).not.toBe(first);
        expect(env.objects.has(`${BUCKETS.staging}/${second}`)).toBe(true);
        expect(env.objects.has(`${BUCKETS.staging}/${first}`)).toBe(false);
        expect(env.ops.map((o) => o.op)).toEqual(['put', 'commit', 'remove']);
        expect(env.ops[2]).toMatchObject({ bucket: BUCKETS.staging, path: first });

        // A stale replace removes only its own upload; the staged PDF still referenced stays.
        env.ops.length = 0;
        await expect(stageFinalPdf(env.deps, team.admin, { id, expectedVersion: 1, file: pdf('stale.pdf') })).rejects.toBeInstanceOf(ConflictError);
        const stalePath = env.ops[0].path!;
        expect(env.ops.map((o) => [o.op, o.path])).toEqual([
            ['put', stalePath],
            ['remove', stalePath],
        ]);
        expect(env.objects.has(`${BUCKETS.staging}/${second}`)).toBe(true);
        expect(env.articles.get(id)!.staged_pdf_path).toBe(second);
    });

    it('a failed staged-PDF clean-up is logged and recorded, but the replace still succeeds', async () => {
        const id = await readyToPublish();
        const first = env.articles.get(id)!.staged_pdf_path!;
        env.faults.remove = (_b, p) => p === first;
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        await stageFinalPdf(env.deps, team.admin, { id, expectedVersion: env.articles.get(id)!.version, file: pdf('final-v2.pdf') });
        expect(error).toHaveBeenCalledTimes(1);
        expect(cleanupEvents(id).map((e) => e.metadata)).toEqual([
            expect.objectContaining({ storage_cleanup: 'failed', bucket: BUCKETS.staging, path: first, purpose: 'replaced_staged_pdf' }),
        ]);
        error.mockRestore();
    });

    it('resubmit deletes superseded reports after the commit and keeps the ones not replaced', async () => {
        const { id, reference, accessKey } = await submit();
        await act('admin', id, 'advance');
        await act('it_reviewer', id, 'request_changes', 'Please add sources for the benchmark figures.');
        const before = env.articles.get(id)!;
        env.ops.length = 0;
        await resubmit(env.deps, reference, accessKey, { note: 'Added three archival sources.', similarity: pdf('new-sim.pdf') });
        const after = env.articles.get(id)!;
        expect(after.similarity_report_path).not.toBe(before.similarity_report_path);
        expect(env.objects.has(`${BUCKETS.reports}/${after.similarity_report_path}`)).toBe(true);
        expect(env.objects.has(`${BUCKETS.reports}/${before.similarity_report_path}`)).toBe(false);
        expect(env.objects.has(`${BUCKETS.reports}/${before.ai_report_path}`)).toBe(true);
        expect(env.ops.map((o) => o.op)).toEqual(['put', 'commit', 'remove']);
        expect(env.ops[2]).toMatchObject({ bucket: BUCKETS.reports, path: before.similarity_report_path });
    });

    it('a resubmit that does not commit removes only its own uploads', async () => {
        const { id, reference, accessKey } = await submit();
        await act('admin', id, 'advance');
        await act('it_reviewer', id, 'request_changes', 'Please add sources for the benchmark figures.');
        const before = env.articles.get(id)!;
        const real = env.repo.applyChange;
        env.repo.applyChange = async () => {
            throw new ConflictError();
        };
        env.ops.length = 0;
        await expect(
            resubmit(env.deps, reference, accessKey, { note: 'Added three archival sources.', similarity: pdf('s.pdf'), ai: pdf('a.pdf') }),
        ).rejects.toBeInstanceOf(ConflictError);
        env.repo.applyChange = real;
        const puts = env.ops.filter((o) => o.op === 'put').map((o) => o.path);
        expect(puts).toHaveLength(2);
        expect(env.ops.filter((o) => o.op === 'remove').map((o) => o.path)).toEqual(puts);
        expect(env.objects.has(`${BUCKETS.reports}/${before.similarity_report_path}`)).toBe(true);
        expect(env.objects.has(`${BUCKETS.reports}/${before.ai_report_path}`)).toBe(true);
    });
});
