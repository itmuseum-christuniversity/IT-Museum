import { beforeEach, describe, expect, it } from 'vitest';
import { lookupStatus, resubmit, submitArticle, transition, resolveStaff, HttpError, RateLimitedError } from '../supabase/functions/_shared/service.ts';
import { clientIpFromHeaders, describeWait, normalizeEmailForLimit, normalizeIp, RATE_LIMITS } from '../supabase/functions/_shared/abuse.ts';
import { renderNotification } from '../supabase/functions/_shared/notifications.ts';
import { DuplicateSubmissionError } from '../supabase/functions/_shared/types.ts';
import { pdf, testDeps, validSubmission } from './helpers/memory.ts';

type Env = ReturnType<typeof testDeps>;
let env: Env;

beforeEach(() => {
    env = testDeps();
});

const files = () => ({ similarity: pdf(), ai: pdf() });
const KEY = '0f8b5c2e-3d4a-4b6c-9e1f-2a3b4c5d6e7f';
const OTHER_KEY = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';

function headers(h: Record<string, string>) {
    return { get: (n: string) => h[n.toLowerCase()] ?? null };
}

async function expectLimited(p: Promise<unknown>): Promise<RateLimitedError> {
    const err = await p.then(
        () => null,
        (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(RateLimitedError);
    const e = err as RateLimitedError;
    expect(e.status).toBe(429);
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.retryAfterSeconds).toBeGreaterThan(0);
    return e;
}

describe('client IP and key normalisation', () => {
    it('prefers cf-connecting-ip and otherwise trusts only the last x-forwarded-for hop', () => {
        expect(clientIpFromHeaders(headers({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
        // A client-supplied first entry is ignored: the edge appends the real address.
        expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '6.6.6.6, 198.51.100.4' }))).toBe('198.51.100.4');
        expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'not-an-ip' }))).toBeNull();
        expect(clientIpFromHeaders(headers({}))).toBeNull();
    });

    it('groups IPv6 by /64 and unwraps IPv4-mapped addresses', () => {
        expect(normalizeIp('2001:db8:1234:5678:aaaa::1')).toBe('2001:db8:1234:5678::/64');
        expect(normalizeIp('2001:0db8:1234:5678:ffff:ffff:ffff:ffff')).toBe('2001:db8:1234:5678::/64');
        expect(normalizeIp('[2001:db8::1]')).toBe('2001:db8:0:0::/64');
        expect(normalizeIp('::ffff:192.0.2.1')).toBe('192.0.2.1');
        expect(normalizeIp('192.0.2.256')).toBeNull();
        expect(normalizeIp('1::2::3')).toBeNull();
        expect(normalizeIp('<script>')).toBeNull();
    });

    it('gives aliases of one mailbox a single budget', () => {
        expect(normalizeEmailForLimit(' Victim+promo@Example.org ')).toBe('victim@example.org');
        expect(normalizeEmailForLimit('v.i.c.t.i.m+1@googlemail.com')).toBe('victim@gmail.com');
        expect(normalizeEmailForLimit('first.last@christuniversity.in')).toBe('first.last@christuniversity.in');
    });

    it('describes the wait in words', () => {
        expect(describeWait(30)).toBe('a minute');
        expect(describeWait(600)).toBe('about 10 minutes');
        expect(describeWait(3600)).toBe('about an hour');
        expect(describeWait(5 * 3600)).toBe('about 5 hours');
    });
});

describe('submission rate limits', () => {
    it(`allows ${RATE_LIMITS.submitPerEmailDay.max} submissions per address a day, then answers 429 and stores nothing`, async () => {
        for (let i = 0; i < RATE_LIMITS.submitPerEmailDay.max; i++) {
            await submitArticle(env.deps, validSubmission(), files(), { clientIp: `198.51.100.${i}` });
        }
        const puts = env.ops.filter((o) => o.op === 'put').length;
        // Same mailbox through a +tag alias and a different IP: still the same budget.
        const e = await expectLimited(
            submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'Author+again@christuniversity.in' }, files(), { clientIp: '203.0.113.50' }),
        );
        expect(e.message).toMatch(/this email address has reached the limit/i);
        expect(env.articles.size).toBe(RATE_LIMITS.submitPerEmailDay.max);
        expect(env.outbox).toHaveLength(RATE_LIMITS.submitPerEmailDay.max);
        expect(env.ops.filter((o) => o.op === 'put').length).toBe(puts);
        // A different address is unaffected.
        await submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'colleague@christuniversity.in' }, files(), { clientIp: '203.0.113.50' });
    });

    it(`allows ${RATE_LIMITS.submitPerIpHour.max} submissions per IP an hour; other IPs keep their budget`, async () => {
        const max = RATE_LIMITS.submitPerIpHour.max;
        for (let i = 0; i < max; i++) {
            await submitArticle(env.deps, { ...validSubmission(), submitterEmail: `author${i}@christuniversity.in` }, files(), { clientIp: '198.51.100.7' });
        }
        const e = await expectLimited(
            submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'late@christuniversity.in' }, files(), { clientIp: '198.51.100.7' }),
        );
        expect(e.message).toMatch(/from your network/i);
        expect(e.retryAfterSeconds).toBeLessThanOrEqual(3600);
        expect(env.articles.size).toBe(max);
        await submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'late@christuniversity.in' }, files(), { clientIp: '198.51.100.8' });
        expect(env.articles.size).toBe(max + 1);
    });

    it('the limit resets when the window ends', async () => {
        const start = Date.UTC(2026, 9, 8, 10, 0, 0);
        env.clock.now = () => start;
        const max = RATE_LIMITS.submitPerIpHour.max;
        for (let i = 0; i < max; i++) {
            await submitArticle(env.deps, { ...validSubmission(), submitterEmail: `a${i}@christuniversity.in` }, files(), { clientIp: '198.51.100.9' });
        }
        await expectLimited(submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'b@christuniversity.in' }, files(), { clientIp: '198.51.100.9' }));
        env.clock.now = () => start + 3600 * 1000;
        await submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'b@christuniversity.in' }, files(), { clientIp: '198.51.100.9' });
    });

    it('sends only HMAC digests to the limiter, never the IP or the address', async () => {
        await submitArticle(env.deps, validSubmission(), files(), { clientIp: '198.51.100.23' });
        expect(env.rateCalls.map((c) => c.bucket)).toEqual([
            RATE_LIMITS.submitPerIpHour.bucket,
            RATE_LIMITS.submitPerIpDay.bucket,
            RATE_LIMITS.submitPerEmailDay.bucket,
            RATE_LIMITS.submitGlobalDay.bucket,
        ]);
        for (const c of env.rateCalls) {
            expect(c.keyHash).toMatch(/^[0-9a-f]{64}$/);
            expect(c.keyHash).not.toContain('198.51');
        }
        expect(JSON.stringify([...env.rateCounters.keys()])).not.toMatch(/198\.51|christuniversity/);
    });

    it('invalid input (including a list of addresses) is refused before any budget is used', async () => {
        await expect(
            submitArticle(env.deps, { ...validSubmission(), submitterEmail: 'a@christuniversity.in, victim@example.org' }, files(), { clientIp: '198.51.100.1' }),
        ).rejects.toMatchObject({ status: 422, fieldErrors: { submitterEmail: expect.any(String) } });
        expect(env.rateCalls).toHaveLength(0);
    });
});

describe('idempotent submission', () => {
    it('a retry with the same key returns the original submission and access key, creating nothing', async () => {
        const first = await submitArticle(env.deps, validSubmission(), files(), { clientIp: '198.51.100.2', idempotencyKey: KEY });
        expect(first.duplicate).toBe(false);
        const puts = env.ops.filter((o) => o.op === 'put').length;
        const limiterCalls = env.rateCalls.length;

        const again = await submitArticle(env.deps, validSubmission(), files(), { clientIp: '198.51.100.2', idempotencyKey: KEY });
        expect(again).toEqual({ id: first.id, reference: first.reference, accessKey: first.accessKey, duplicate: true });
        expect(env.articles.size).toBe(1);
        expect(env.outbox).toHaveLength(1);
        expect(env.ops.filter((o) => o.op === 'put').length).toBe(puts);
        expect(env.rateCalls.length).toBe(limiterCalls);
        // The recovered key really opens the submission; only its hash is stored.
        expect((await lookupStatus(env.deps, again.reference, again.accessKey!)).reference).toBe(first.reference);
        expect(JSON.stringify([...env.articles.values()])).not.toContain(first.accessKey);
        expect(JSON.stringify([...env.idempotency.entries()])).not.toContain(KEY);
    });

    it('after the recovery window a retry gets the reference only', async () => {
        const first = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        const realNow = env.deps.now;
        env.deps.now = () => new Date(realNow().getTime() + 25 * 3600 * 1000);
        const again = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        expect(again).toEqual({ id: first.id, reference: first.reference, accessKey: null, duplicate: true });
        expect(env.articles.size).toBe(1);
    });

    it('different keys are different submissions', async () => {
        await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        const second = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: OTHER_KEY });
        expect(second.duplicate).toBe(false);
        expect(env.articles.size).toBe(2);
    });

    it('a reused key with changed details is refused with the original reference', async () => {
        const first = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        const err = await submitArticle(env.deps, { ...validSubmission(), title: 'A completely different title' }, files(), { idempotencyKey: KEY }).catch((e) => e);
        expect(err).toBeInstanceOf(HttpError);
        expect(err).toMatchObject({ status: 409, code: 'IDEMPOTENCY_MISMATCH' });
        expect(err.message).toContain(first.reference);
        expect(env.articles.size).toBe(1);
    });

    it('losing a concurrent duplicate race removes its own uploads and answers with the winner', async () => {
        const first = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        // Simulate the second request reading "no key yet" before the first committed.
        const realFind = env.repo.findIdempotency;
        env.repo.findIdempotency = async () => null;
        env.ops.length = 0;
        const again = await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        env.repo.findIdempotency = realFind;
        expect(again).toMatchObject({ id: first.id, reference: first.reference, duplicate: true });
        expect(env.articles.size).toBe(1);
        expect(env.outbox).toHaveLength(1);
        const puts = env.ops.filter((o) => o.op === 'put').map((o) => o.path);
        const removes = env.ops.filter((o) => o.op === 'remove').map((o) => o.path);
        expect(puts).toHaveLength(2);
        expect(removes.sort()).toEqual([...puts].sort());
    });

    it('the repository refuses a used key atomically', async () => {
        await submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: KEY });
        const [keyHash] = [...env.idempotency.keys()];
        await expect(env.repo.createSubmission({}, {} as never, [], { keyHash, requestHash: 'x' })).rejects.toBeInstanceOf(DuplicateSubmissionError);
    });

    it('rejects a malformed key as a bad request', async () => {
        await expect(submitArticle(env.deps, validSubmission(), files(), { idempotencyKey: 'not-a-uuid' })).rejects.toMatchObject({ status: 400 });
        expect(env.articles.size).toBe(0);
    });
});

describe('confirmation email cannot carry submitted text', () => {
    const spam = 'WIN A PRIZE — claim at https://evil.example/now';

    it('queues only server-generated values for submission_received', async () => {
        const { reference } = await submitArticle(
            env.deps,
            { ...validSubmission(), title: spam, authors: [{ name: 'Visit evil.example', email: 'x@christuniversity.in', designation: 'Spammer' }] },
            files(),
        );
        expect(env.outbox).toHaveLength(1);
        const [n] = env.outbox;
        expect(n.template).toBe('submission_received');
        expect(n.payload).toEqual({ reference, statusUrl: `https://museum.test/submission/status?ref=${reference}` });
        const email = renderNotification(n.template, n.payload as never);
        expect(email.subject).toBe(`IT Museum: submission received (${reference})`);
        expect(`${email.subject}\n${email.text}`).not.toMatch(/evil|PRIZE|Spammer/);
        expect(email.text).toContain(reference);
    });

    it('ignores a title in older queued payloads too', () => {
        const email = renderNotification('submission_received', {
            title: spam,
            reference: 'ITM-2026-ABC234',
            statusUrl: 'https://museum.test/submission/status?ref=ITM-2026-ABC234',
            recipientName: 'Visit evil.example',
        });
        expect(`${email.subject}\n${email.text}`).not.toMatch(/evil|PRIZE/);
    });
});

describe('contributor access limits', () => {
    it(`limits status look-ups to ${RATE_LIMITS.statusPerIp10Min.max} per IP per 10 minutes, wrong keys included`, async () => {
        const { reference, accessKey } = await submitArticle(env.deps, validSubmission(), files());
        if (accessKey === null) throw new Error('expected key');
        for (let i = 0; i < RATE_LIMITS.statusPerIp10Min.max; i++) {
            await expect(lookupStatus(env.deps, reference, `guess-${i}`, { clientIp: '203.0.113.66' })).rejects.toMatchObject({ status: 404 });
        }
        const e = await expectLimited(lookupStatus(env.deps, reference, accessKey, { clientIp: '203.0.113.66' }));
        expect(e.message).toMatch(/status checks/i);
        // The real contributor on another network is not locked out.
        expect((await lookupStatus(env.deps, reference, accessKey, { clientIp: '198.51.100.70' })).reference).toBe(reference);
    });

    it(`limits revision attempts to ${RATE_LIMITS.resubmitPerIpHour.max} per IP an hour`, async () => {
        const { id, reference, accessKey } = await submitArticle(env.deps, validSubmission(), files());
        if (accessKey === null) throw new Error('expected key');
        const admin = await env.repo.upsertStaff({ email: 'admin@christuniversity.in', display_name: 'A', role: 'admin', active: true });
        await env.repo.linkStaffUid(admin.id, 'uid-admin');
        const staff = await resolveStaff(env.deps, { uid: 'uid-admin', email: admin.email, emailVerified: true });
        await transition(env.deps, staff, { id, action: 'request_changes', reason: 'Please add sources for the figures.', expectedVersion: 1 });

        for (let i = 0; i < RATE_LIMITS.resubmitPerIpHour.max; i++) {
            await expect(resubmit(env.deps, reference, `wrong-${i}`, { note: 'Added the sources.' }, { clientIp: '203.0.113.80' })).rejects.toMatchObject({ status: 404 });
        }
        await expectLimited(resubmit(env.deps, reference, accessKey, { note: 'Added the sources.' }, { clientIp: '203.0.113.80' }));
        const view = await resubmit(env.deps, reference, accessKey, { note: 'Added the sources.' }, { clientIp: '198.51.100.80' });
        expect(view.status).toBe('SUBMITTED');
    });
});
