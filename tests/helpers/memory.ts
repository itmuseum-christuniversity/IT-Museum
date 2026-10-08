import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
    ConflictError,
    DuplicateSubmissionError,
    LastAdminError,
    type ArticleRow,
    type Deps,
    type EventRow,
    type FileStore,
    type IdempotencyRecord,
    type NewNotification,
    type Repo,
    type StaffMember,
} from '../../supabase/functions/_shared/types.ts';

/** In-memory Repo that mirrors the SQL functions' compare-and-swap semantics. */
export function memoryRepo() {
    const articles = new Map<string, ArticleRow>();
    const events: EventRow[] = [];
    const outbox: (NewNotification & { article_id: string })[] = [];
    const staff = new Map<string, StaffMember>();
    const idempotency = new Map<string, IdempotencyRecord>();
    /** Mirrors public.rate_limit_counters: `${bucket}|${keyHash}|${windowStart}` → hits. */
    const rateCounters = new Map<string, number>();
    /** Every consumeRateLimit call, in order (bucket + key hash only, like the table). */
    const rateCalls: { bucket: string; keyHash: string }[] = [];
    /** Tests can move the limiter's clock (ms since epoch). */
    const clock = { now: () => Date.now() };
    let eventId = 0;
    let articleSeq = 0;
    const clone = <T>(v: T): T => structuredClone(v);

    const repo: Repo = {
        async getArticle(id) {
            return articles.has(id) ? clone(articles.get(id)!) : null;
        },
        async getArticleByReference(ref) {
            return clone([...articles.values()].find((a) => a.reference_code === ref) ?? null);
        },
        async listArticles(q, staffId) {
            return clone(
                [...articles.values()].filter((a) => {
                    if (!q.statuses.includes(a.status)) return false;
                    if (q.search && !`${a.title} ${a.author_name} ${a.reference_code}`.toLowerCase().includes(q.search.toLowerCase())) return false;
                    if (q.assignee === 'me' && a.assignee_id !== staffId) return false;
                    if (q.assignee === 'unassigned' && a.assignee_id) return false;
                    return true;
                }),
            );
        },
        async countByStatus() {
            const c: Record<string, number> = {};
            for (const a of articles.values()) c[a.status] = (c[a.status] ?? 0) + 1;
            return c;
        },
        async createSubmission(row, event, notifications, idem) {
            // Mirrors create_submission_idempotent: a used key writes nothing.
            if (idem && idempotency.has(idem.keyHash)) throw new DuplicateSubmissionError(clone(idempotency.get(idem.keyHash)!));
            const id = `art-${++articleSeq}`;
            const now = new Date().toISOString();
            const a = {
                file_url: null,
                similarity_report_url: null,
                ai_report_url: null,
                staged_pdf_path: null,
                published_pdf_path: null,
                published_pdf_url: null,
                assignee_id: null,
                legacy_status: null,
                return_to_stage: null,
                rejected_at_stage: null,
                public_reason: null,
                tags: null,
                suggested_tags: null,
                published_at: null,
                unpublished_at: null,
                updated_at: now,
                ...row,
                id,
                status: 'SUBMITTED',
                version: 1,
                created_at: now,
                stage_entered_at: now,
            } as ArticleRow;
            articles.set(id, a);
            events.push({ ...event, article_id: id, id: ++eventId, created_at: now });
            outbox.push(...notifications.map((n) => ({ ...n, article_id: id })));
            if (idem) idempotency.set(idem.keyHash, { articleId: id, requestHash: idem.requestHash, createdAt: now });
            return clone(a);
        },
        async findIdempotency(keyHash) {
            return clone(idempotency.get(keyHash) ?? null);
        },
        async consumeRateLimit(bucket, keyHash, windowSeconds, max) {
            // Same fixed-window arithmetic as consume_rate_limit (migration 0005).
            if (!/^[0-9a-f]{64}$/.test(keyHash)) throw new Error('rate_limit_counters_key_hash_check');
            rateCalls.push({ bucket, keyHash });
            const nowMs = clock.now();
            const start = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds * 1000;
            const k = `${bucket}|${keyHash}|${start}`;
            const hits = (rateCounters.get(k) ?? 0) + 1;
            rateCounters.set(k, hits);
            const allowed = hits <= max;
            return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((start + windowSeconds * 1000 - nowMs) / 1000)) };
        },
        async applyChange({ id, expectedStatus, expectedVersion, newStatus, patch, event, notifications }) {
            const a = articles.get(id);
            if (!a || a.status !== expectedStatus || a.version !== expectedVersion) throw new ConflictError();
            const now = new Date().toISOString();
            const { published_at, unpublished_at, ...rest } = patch;
            const next: ArticleRow = { ...a, ...rest, version: a.version + 1, updated_at: now };
            if (published_at !== undefined) next.published_at = published_at === 'now' ? now : null;
            if (unpublished_at !== undefined) next.unpublished_at = unpublished_at === 'now' ? now : null;
            if (newStatus && newStatus !== a.status) {
                next.status = newStatus;
                next.stage_entered_at = now;
            }
            articles.set(id, next);
            events.push({ ...event, article_id: id, id: ++eventId, created_at: now });
            outbox.push(...notifications.map((n) => ({ ...n, article_id: id })));
            return clone(next);
        },
        async insertEvent(e) {
            events.push({ ...e, id: ++eventId, created_at: new Date().toISOString() });
        },
        async listEvents(articleId) {
            return clone(events.filter((e) => e.article_id === articleId));
        },
        async listRecentEvents(limit) {
            return clone(events.slice(-limit).reverse());
        },
        async findStaffByUid(uid) {
            return clone([...staff.values()].find((s) => s.firebase_uid === uid) ?? null);
        },
        async findStaffByEmail(email) {
            return clone([...staff.values()].find((s) => s.email === email) ?? null);
        },
        async linkStaffUid(id, uid) {
            // Mirrors `UPDATE ... WHERE id = $1 AND firebase_uid IS NULL` plus the unique index on firebase_uid.
            const s = staff.get(id);
            if (!s || s.firebase_uid) return false;
            if ([...staff.values()].some((o) => o.firebase_uid === uid)) return false;
            s.firebase_uid = uid;
            return true;
        },
        async listStaff() {
            return clone([...staff.values()]);
        },
        async upsertStaff(m) {
            const id = m.id ?? `staff-${staff.size + 1}`;
            const prev = staff.get(id);
            const row: StaffMember = { firebase_uid: prev?.firebase_uid ?? null, ...m, id };
            // Mirrors trigger staff_members_keep_an_admin (migration 0004): an active
            // admin may only stop being one while another active admin remains.
            const stopsBeingAdmin = prev?.role === 'admin' && prev.active && (row.role !== 'admin' || !row.active);
            if (stopsBeingAdmin && ![...staff.values()].some((s) => s.id !== id && s.role === 'admin' && s.active)) {
                throw new LastAdminError();
            }
            staff.set(id, row);
            return clone(row);
        },
    };
    return { repo, articles, events, outbox, staff, idempotency, rateCounters, rateCalls, clock };
}

export type FileOp = { op: 'put' | 'copy' | 'remove' | 'commit'; bucket?: string; path?: string; from?: string; ok: boolean };

/**
 * In-memory FileStore mirroring the real adapter's semantics: `put` and `copy`
 * never overwrite, `remove` is idempotent. Every call is appended to `ops`
 * (tests may push their own markers, e.g. 'commit'), and `faults.remove` can
 * make removals fail.
 */
export function memoryFiles() {
    const objects = new Map<string, Uint8Array>();
    const ops: FileOp[] = [];
    const faults: { remove: (bucket: string, path: string) => boolean } = { remove: () => false };
    const key = (b: string, p: string) => `${b}/${p}`;
    const files: FileStore = {
        async put(bucket, path, bytes) {
            const ok = !objects.has(key(bucket, path));
            ops.push({ op: 'put', bucket, path, ok });
            if (!ok) throw new Error('exists');
            objects.set(key(bucket, path), bytes);
        },
        async copy(fb, fp, tb, tp) {
            const v = objects.get(key(fb, fp));
            const ok = Boolean(v) && !objects.has(key(tb, tp));
            ops.push({ op: 'copy', bucket: tb, path: tp, from: key(fb, fp), ok });
            if (!v) throw new Error(`missing ${fb}/${fp}`);
            if (!ok) throw new Error('exists');
            objects.set(key(tb, tp), v);
        },
        async remove(bucket, path) {
            const ok = !faults.remove(bucket, path);
            ops.push({ op: 'remove', bucket, path, ok });
            if (!ok) throw new Error('storage unavailable');
            objects.delete(key(bucket, path));
        },
        async signedUrl(bucket, path) {
            return objects.has(key(bucket, path)) ? `https://signed.example/${bucket}/${path}?token=x` : null;
        },
        publicUrl(bucket, path) {
            return `https://project.supabase.co/storage/v1/object/public/${bucket}/${path}`;
        },
    };
    return { files, objects, ops, faults };
}

export function testDeps() {
    const mem = memoryRepo();
    const fs = memoryFiles();
    const sleeps: number[] = [];
    const deps: Deps = {
        repo: mem.repo,
        files: fs.files,
        now: () => new Date(),
        randomBytes: (n) => new Uint8Array(randomBytes(n)),
        sha256Hex: async (s) => createHash('sha256').update(s).digest('hex'),
        hmacHex: async (purpose, message) => createHmac('sha256', `test-secret:${purpose}`).update(message).digest('hex'),
        sleep: async (ms) => {
            sleeps.push(ms);
        },
        siteUrl: 'https://museum.test',
    };
    // Mark every successful commit in the file op log so tests can check ordering.
    const applyChange = mem.repo.applyChange;
    mem.repo.applyChange = async (args) => {
        const row = await applyChange(args);
        fs.ops.push({ op: 'commit', ok: true });
        return row;
    };
    return { deps, sleeps, ...mem, ...fs };
}

export const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n%test document\n');
export const pdf = (name = 'report.pdf') => ({ name, type: 'application/pdf', bytes: PDF_BYTES });

export function validSubmission() {
    return {
        title: 'The TIFRAC and the Dawn of Indian Computing',
        description:
            'This article traces the design and construction of TIFRAC at the Tata Institute of Fundamental Research and its influence on early computing education and engineering practice in India.',
        keywords: 'TIFRAC, computing history, India',
        submitterEmail: 'author@christuniversity.in',
        authors: [{ name: 'Asha Rao', email: 'asha@christuniversity.in', designation: 'Associate Professor' }],
        manuscriptUrl: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit',
        originalityConfirmed: true,
    };
}
