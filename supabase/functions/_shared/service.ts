/**
 * Workflow service: every privileged read and write goes through here.
 * The Edge Functions provide real `Deps` (Supabase service-role client,
 * storage); tests provide in-memory fakes. No Deno or browser APIs here.
 */
import {
    contributorStatus,
    isAction,
    isStaffRole,
    isStatus,
    planTransition,
    publicationChecklist,
    queuesForRole,
    visibleStatusesForRole,
    type Status,
    type WorkflowAction,
} from './workflow.ts';
import {
    checkManuscriptUrl,
    checkPdfFile,
    hasPdfSignature,
    isEmail,
    makeReferenceCode,
    MAX_AUTHOR_CREDIT_CHARS,
    MAX_DESCRIPTION_CHARS,
    MAX_FINAL_PDF_BYTES,
    MAX_REPORT_BYTES,
    normalizeTags,
    parseKeywords,
    validateSubmission,
    type FieldErrors,
    type SubmissionInput,
} from './validation.ts';
import { describeWait, normalizeEmailForLimit, RATE_LIMITS, type RateLimit } from './abuse.ts';
import {
    BUCKETS,
    ConflictError,
    DuplicateSubmissionError,
    LastAdminError,
    type ArticlePatch,
    type ArticleRow,
    type Deps,
    type EventRow,
    type IdempotencyRecord,
    type NewEvent,
    type NewNotification,
    type QueueQuery,
    type StaffIdentity,
    type StaffMember,
    type Upload,
} from './types.ts';

export class HttpError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public fieldErrors?: FieldErrors,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

/** 429: an abuse limit was hit. `retryAfterSeconds` becomes the Retry-After header. */
export class RateLimitedError extends HttpError {
    constructor(
        message: string,
        public retryAfterSeconds: number,
    ) {
        super(429, 'RATE_LIMITED', message);
        this.name = 'RateLimitedError';
    }
}

const SIGNED_URL_SECONDS = 10 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message: string): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Reject malformed JSON shapes (null, wrong types) with a 400 before they reach the validators. */
function assertSubmissionShape(input: unknown): asserts input is SubmissionInput {
    if (!isPlainObject(input)) throw badRequest('Malformed submission.');
    for (const key of ['title', 'description', 'keywords', 'submitterEmail', 'manuscriptUrl']) {
        if (typeof input[key] !== 'string') throw badRequest('Malformed submission.');
    }
    if (!Array.isArray(input.authors)) throw badRequest('Malformed submission.');
    for (const a of input.authors) {
        if (!isPlainObject(a) || typeof a.name !== 'string' || typeof a.email !== 'string' || typeof a.designation !== 'string') {
            throw badRequest('Malformed submission.');
        }
    }
}

function toBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function assertPdf(upload: Upload | null | undefined, label: string, maxBytes: number): Upload {
    const problem = checkPdfFile(upload ? { name: upload.name, size: upload.bytes.length, type: upload.type } : null, maxBytes);
    if (problem) throw new HttpError(422, 'INVALID_FILE', `${label}: ${problem}`);
    if (!hasPdfSignature(upload!.bytes)) throw new HttpError(422, 'INVALID_FILE', `${label}: the file content is not a PDF.`);
    return upload!;
}

function statusUrl(deps: Deps, reference: string | null): string {
    const base = deps.siteUrl.replace(/\/$/, '');
    return reference ? `${base}/submission/status?ref=${encodeURIComponent(reference)}` : `${base}/submission/status`;
}

function firstAuthorName(a: ArticleRow): string | null {
    return a.authors?.[0]?.name ?? a.author_name.split(',')[0]?.trim() ?? null;
}

function contributorNotification(deps: Deps, a: ArticleRow, template: string, reason: string | null): NewNotification[] {
    if (!a.submitted_email || !isEmail(a.submitted_email)) return [];
    if (template === 'submission_received') {
        // Sent before any human has looked at the submission, to an address nobody
        // has verified: only server-generated values, never the submitted title or
        // names, so the form cannot be used to deliver attacker-written text.
        return [{ recipient: a.submitted_email, template, payload: { reference: a.reference_code, statusUrl: statusUrl(deps, a.reference_code) } }];
    }
    return [
        {
            recipient: a.submitted_email,
            template,
            payload: {
                title: a.title,
                reference: a.reference_code,
                reason,
                statusUrl: statusUrl(deps, a.reference_code),
                articleUrl: template === 'published' ? `${deps.siteUrl.replace(/\/$/, '')}/article/${a.id}` : null,
                recipientName: firstAuthorName(a),
            },
        },
    ];
}

/** Derive an object path from a legacy Supabase public URL for a given bucket. */
export function storagePathFromUrl(url: string | null | undefined, bucket: string): string | null {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    if (i === -1) return null;
    return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

function objectName(deps: Deps, prefix: string): string {
    return `${prefix}/${deps.now().getTime()}_${toBase64Url(deps.randomBytes(9))}.pdf`;
}

/* ------------------------------------------------------------------------ */
/* Storage clean-up                                                          */
/*                                                                           */
/* Storage and the database cannot share a transaction, so the rules are:   */
/*  - new objects are written to unique paths BEFORE the row change commits; */
/*  - superseded objects are removed only AFTER the commit, and only if the  */
/*    committed row no longer references them;                               */
/*  - an uncommitted attempt removes only the unique objects it wrote, and   */
/*    only once a fresh read shows the row does not reference them;          */
/*  - a removal that still fails after a bounded retry is logged and leaves  */
/*    a durable `file` event (metadata.storage_cleanup = 'failed') that      */
/*    `retryStorageCleanup` can act on later.                                */
/* ------------------------------------------------------------------------ */

const CLEANUP_ATTEMPTS = 3;
const CLEANUP_BACKOFF_MS = 250;
const KNOWN_BUCKETS: readonly string[] = Object.values(BUCKETS);

export interface CleanupTarget {
    bucket: string;
    path: string;
    /** Why the object is being removed, e.g. 'unpublished', 'replaced_staged_pdf'. */
    purpose: string;
}

/** True when the row still points at this object, in which case it must not be deleted. */
export function isReferenced(row: ArticleRow, bucket: string, path: string): boolean {
    switch (bucket) {
        case BUCKETS.staging:
            return row.staged_pdf_path === path;
        case BUCKETS.public:
            return row.published_pdf_path === path || storagePathFromUrl(row.published_pdf_url, BUCKETS.public) === path;
        case BUCKETS.reports:
            return (
                row.similarity_report_path === path ||
                row.ai_report_path === path ||
                storagePathFromUrl(row.similarity_report_url, BUCKETS.reports) === path ||
                storagePathFromUrl(row.ai_report_url, BUCKETS.reports) === path
            );
        default:
            return true; // Unknown bucket: never delete.
    }
}

function errorText(err: unknown): string {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error';
    return msg.slice(0, 200);
}

async function removeWithRetry(deps: Deps, bucket: string, path: string): Promise<{ ok: true } | { ok: false; error: string }> {
    let last = '';
    for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt++) {
        try {
            await deps.files.remove(bucket, path);
            return { ok: true };
        } catch (err) {
            last = errorText(err);
            if (attempt < CLEANUP_ATTEMPTS) await deps.sleep?.(CLEANUP_BACKOFF_MS * attempt);
        }
    }
    return { ok: false, error: last };
}

function cleanupEvent(t: CleanupTarget, outcome: 'failed' | 'done' | 'skipped_referenced', extra: Record<string, unknown> = {}): Omit<NewEvent, 'article_id'> {
    return {
        event_type: 'file',
        action: null,
        from_status: null,
        to_status: null,
        actor_id: 'storage-cleanup',
        actor_role: 'system',
        actor_label: 'Storage clean-up',
        reason: null,
        visibility: 'internal',
        metadata: { storage_cleanup: outcome, bucket: t.bucket, path: t.path, purpose: t.purpose, ...extra },
    };
}

/**
 * Best-effort removal of objects the row no longer needs. `row` is the
 * committed row to check against (or null when the paths are unique to an
 * uncommitted attempt and a fresh read was impossible — then nothing is removed).
 * Returns the targets that could not be removed.
 */
async function cleanupObjects(deps: Deps, articleId: string, row: ArticleRow | null, targets: CleanupTarget[]): Promise<CleanupTarget[]> {
    const failed: CleanupTarget[] = [];
    for (const t of targets) {
        if (!row || isReferenced(row, t.bucket, t.path)) {
            console.warn(`storage clean-up skipped (object still referenced or row unknown): ${JSON.stringify({ articleId, bucket: t.bucket, path: t.path, purpose: t.purpose })}`);
            continue;
        }
        const result = await removeWithRetry(deps, t.bucket, t.path);
        if (result.ok) continue;
        failed.push(t);
        console.error(
            `storage clean-up failed after ${CLEANUP_ATTEMPTS} attempts: ${JSON.stringify({ articleId, bucket: t.bucket, path: t.path, purpose: t.purpose, error: result.error })}`,
        );
        try {
            await deps.repo.insertEvent({ article_id: articleId, ...cleanupEvent(t, 'failed', { attempts: CLEANUP_ATTEMPTS, error: result.error }) });
        } catch (err) {
            console.error(`could not record storage clean-up failure: ${JSON.stringify({ articleId, bucket: t.bucket, path: t.path, error: errorText(err) })}`);
        }
    }
    return failed;
}

/**
 * Roll back objects written by an attempt whose row change did not commit
 * (or whose outcome is unknown). The paths are unique to this attempt, but the
 * row is re-read first so an RPC that committed and then lost its response
 * never has its live object deleted. If the re-read fails, the objects are
 * kept (an orphan is safer than a row pointing at nothing).
 */
async function discardUncommitted(deps: Deps, articleId: string, targets: CleanupTarget[]): Promise<void> {
    if (!targets.length) return;
    let current: ArticleRow | null = null;
    try {
        current = await deps.repo.getArticle(articleId);
    } catch (err) {
        console.error(`could not re-read article before discarding uploads: ${JSON.stringify({ articleId, error: errorText(err) })}`);
    }
    await cleanupObjects(deps, articleId, current, targets);
}

/** Clean-up failures recorded in the audit log that no later event has resolved. */
export function pendingCleanups(events: EventRow[]): CleanupTarget[] {
    const pending = new Map<string, CleanupTarget>();
    for (const e of events) {
        const m = e.metadata as Record<string, unknown> | null;
        if (e.event_type !== 'file' || !m || typeof m.storage_cleanup !== 'string') continue;
        if (typeof m.bucket !== 'string' || typeof m.path !== 'string') continue;
        const key = `${m.bucket}\u0000${m.path}`;
        if (m.storage_cleanup === 'failed') pending.set(key, { bucket: m.bucket, path: m.path, purpose: String(m.purpose ?? '') });
        else pending.delete(key);
    }
    return [...pending.values()];
}

/* ------------------------------------------------------------------------ */
/* Public (contributor) operations                                          */
/* ------------------------------------------------------------------------ */

/**
 * A new submission always carries its one-time access key. A duplicate (a
 * retry repeating an idempotency key that already committed) carries the
 * original reference, and the access key only when it can be re-derived (see
 * `duplicateResult`); null means it was shown on the first attempt only.
 */
export type SubmitResult =
    | { id: string; reference: string; accessKey: string; duplicate: false }
    | { id: string; reference: string; accessKey: string | null; duplicate: true };

/** Request facts the public API passes in; everything is optional so tests stay terse. */
export interface PublicRequestContext {
    /** Normalised client IP (see clientIpFromHeaders), or null when unknown. */
    clientIp?: string | null;
    /** Client-generated UUID, the same for every retry of one form attempt. */
    idempotencyKey?: string | null;
}

/** How long a retried submission can get its access key back. */
const ACCESS_KEY_RECOVERY_MS = 24 * 60 * 60 * 1000;
const CONTACT = 'itmuseum@christuniversity.in';

/**
 * Count one request against `limit` for `value` (an IP, a mailbox, ...). The
 * value is HMAC'd with the server's rate-limit secret first, so neither the
 * database nor its backups hold IPs or email addresses for this purpose.
 */
async function enforceLimit(deps: Deps, limit: RateLimit, value: string, message: (wait: string) => string): Promise<void> {
    const keyHash = await deps.hmacHex('rate-limit', `${limit.bucket}\u0000${value}`);
    const d = await deps.repo.consumeRateLimit(limit.bucket, keyHash, limit.windowSeconds, limit.max);
    if (!d.allowed) {
        const wait = Math.max(1, Math.ceil(d.retryAfterSeconds));
        throw new RateLimitedError(message(describeWait(wait)), wait);
    }
}

const ipValue = (ctx: PublicRequestContext) => ctx.clientIp || 'unknown';

function hexToBytes(hex: string): Uint8Array {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
}

/**
 * The access key for a submission made with an idempotency key is
 * HMAC(ACCESS_KEY_SECRET, key), truncated to the same 18 bytes as a random
 * key. Only its SHA-256 is stored, as before; a retry with the same
 * idempotency key can re-derive it without the plaintext ever being stored.
 */
async function deriveAccessKey(deps: Deps, idempotencyKey: string): Promise<string> {
    const mac = await deps.hmacHex('access-key', `submission-access-key:v1:${idempotencyKey.toLowerCase()}`);
    return toBase64Url(hexToBytes(mac.slice(0, 36)));
}

async function requestFingerprint(deps: Deps, row: Partial<ArticleRow>): Promise<string> {
    return deps.sha256Hex(
        JSON.stringify([row.title, row.description, row.keywords, row.authors, row.submitted_email?.toLowerCase(), row.manuscript_url]),
    );
}

/** Answer a repeated idempotency key with the original submission, writing nothing. */
async function duplicateResult(deps: Deps, rec: IdempotencyRecord, requestHash: string, idempotencyKey: string): Promise<SubmitResult> {
    const article = rec.articleId ? await deps.repo.getArticle(rec.articleId) : null;
    if (!article?.reference_code) {
        throw new HttpError(409, 'DUPLICATE_SUBMISSION', `This submission was already received. If you need its reference, email ${CONTACT}.`);
    }
    if (!safeEqual(rec.requestHash, requestHash)) {
        throw new HttpError(
            409,
            'IDEMPOTENCY_MISMATCH',
            `This form was already submitted (reference ${article.reference_code}) and the details have changed since. Select Try again to send the changed details as a new submission.`,
        );
    }
    let accessKey: string | null = null;
    const age = deps.now().getTime() - new Date(rec.createdAt).getTime();
    if (age >= 0 && age < ACCESS_KEY_RECOVERY_MS && article.contributor_token_hash) {
        const candidate = await deriveAccessKey(deps, idempotencyKey);
        // Only hand it back if it really is this submission's key (e.g. the secret has not been rotated).
        if (safeEqual(await deps.sha256Hex(candidate), article.contributor_token_hash)) accessKey = candidate;
    }
    return { id: article.id, reference: article.reference_code, accessKey, duplicate: true };
}

export async function submitArticle(
    deps: Deps,
    input: SubmissionInput,
    files: { similarity?: Upload | null; ai?: Upload | null },
    ctx: PublicRequestContext = {},
): Promise<SubmitResult> {
    assertSubmissionShape(input);
    const idempotencyKey = ctx.idempotencyKey ?? null;
    if (idempotencyKey !== null && (typeof idempotencyKey !== 'string' || !UUID_RE.test(idempotencyKey))) {
        throw badRequest('Malformed submission attempt id. Reload the page and try again.');
    }
    const errors = validateSubmission(input);
    if (Object.keys(errors).length) throw new HttpError(422, 'VALIDATION', 'Some fields need attention.', errors);
    const similarity = assertPdf(files.similarity, 'Similarity report', MAX_REPORT_BYTES);
    const ai = assertPdf(files.ai, 'AI detection report', MAX_REPORT_BYTES);
    const url = checkManuscriptUrl(input.manuscriptUrl);
    if (!url.ok) throw new HttpError(422, 'VALIDATION', url.message, { manuscriptUrl: url.message });

    const authors = input.authors.map((a) => ({ name: a.name.trim(), email: a.email.trim(), designation: a.designation.trim() }));
    const content: Partial<ArticleRow> = {
        title: input.title.trim(),
        description: input.description.trim(),
        keywords: parseKeywords(input.keywords).join(', '),
        authors,
        submitted_email: input.submitterEmail.trim(),
        manuscript_url: url.normalized,
    };
    const idempotency = idempotencyKey
        ? { keyHash: await deps.sha256Hex(`submission-idempotency:v1:${idempotencyKey.toLowerCase()}`), requestHash: await requestFingerprint(deps, content) }
        : null;

    // A retry of an attempt that already committed: same answer, nothing new stored or sent,
    // and no rate-limit budget used.
    if (idempotency) {
        const existing = await deps.repo.findIdempotency(idempotency.keyHash);
        if (existing) return duplicateResult(deps, existing, idempotency.requestHash, idempotencyKey!);
    }

    // Abuse limits, before anything is stored. The global cap is checked last so
    // requests already refused per IP or per address do not use it up.
    await enforceLimit(deps, RATE_LIMITS.submitPerIpHour, ipValue(ctx), (w) => `Too many submissions have been sent from your network recently. Please try again in ${w}.`);
    await enforceLimit(deps, RATE_LIMITS.submitPerIpDay, ipValue(ctx), (w) => `Too many submissions have been sent from your network today. Please try again in ${w}.`);
    await enforceLimit(
        deps,
        RATE_LIMITS.submitPerEmailDay,
        normalizeEmailForLimit(input.submitterEmail),
        (w) => `This email address has reached the limit of ${RATE_LIMITS.submitPerEmailDay.max} submissions a day. Please try again in ${w}, or email ${CONTACT}.`,
    );
    await enforceLimit(deps, RATE_LIMITS.submitGlobalDay, 'all', (w) => `We are receiving an unusual number of submissions. Please try again in ${w}, or email ${CONTACT}.`);

    const reference = makeReferenceCode(deps.now().getUTCFullYear(), deps.randomBytes(6));
    const accessKey = idempotencyKey ? await deriveAccessKey(deps, idempotencyKey) : toBase64Url(deps.randomBytes(18));
    const tokenHash = await deps.sha256Hex(accessKey);

    const simPath = objectName(deps, `submissions/${reference}/similarity`);
    const aiPath = objectName(deps, `submissions/${reference}/ai`);
    await deps.files.put(BUCKETS.reports, simPath, similarity.bytes, 'application/pdf');
    await deps.files.put(BUCKETS.reports, aiPath, ai.bytes, 'application/pdf');

    const row: Partial<ArticleRow> = {
        ...content,
        reference_code: reference,
        status: 'SUBMITTED',
        num_authors: authors.length,
        // Legacy flattened columns are still filled so older reports keep working.
        author_name: authors.map((a) => a.name).join(', '),
        institution_email: authors.map((a) => a.email).join(', '),
        author_designations: authors.map((a) => a.designation).join(', '),
        originality_confirmed: true,
        similarity_report_path: simPath,
        ai_report_path: aiPath,
        contributor_token_hash: tokenHash,
    };
    try {
        const created = await deps.repo.createSubmission(
            row,
            {
                event_type: 'submitted',
                action: null,
                from_status: null,
                to_status: 'SUBMITTED',
                actor_id: 'contributor',
                actor_role: 'contributor',
                actor_label: input.submitterEmail.trim(),
                reason: null,
                visibility: 'contributor',
                metadata: { reference },
            },
            contributorNotification(deps, { ...(row as ArticleRow), id: '' }, 'submission_received', null),
            idempotency ?? undefined,
        );
        return { id: created.id, reference, accessKey, duplicate: false };
    } catch (err) {
        // Don't leave orphaned private reports behind if the insert failed (or lost a duplicate race).
        await Promise.allSettled([deps.files.remove(BUCKETS.reports, simPath), deps.files.remove(BUCKETS.reports, aiPath)]);
        if (err instanceof DuplicateSubmissionError && idempotency) {
            return duplicateResult(deps, err.existing, idempotency.requestHash, idempotencyKey!);
        }
        throw err;
    }
}

async function loadContributorArticle(deps: Deps, reference: string, accessKey: string): Promise<ArticleRow> {
    const notFound = new HttpError(404, 'NOT_FOUND', 'We could not find a submission with that reference and access key.');
    if (!reference?.trim() || !accessKey?.trim()) throw notFound;
    const article = await deps.repo.getArticleByReference(reference.trim().toUpperCase());
    if (!article?.contributor_token_hash) throw notFound;
    const hash = await deps.sha256Hex(accessKey.trim());
    if (!safeEqual(hash, article.contributor_token_hash)) throw notFound;
    return article;
}

export interface ContributorView {
    reference: string;
    title: string;
    status: Status;
    label: string;
    description: string;
    reason: string | null;
    submittedAt: string;
    canResubmit: boolean;
    publishedId: string | null;
    history: { at: string; label: string }[];
}

export async function lookupStatus(deps: Deps, reference: string, accessKey: string, ctx: PublicRequestContext = {}): Promise<ContributorView> {
    // Limits guessing and scraping. Per IP only: a per-reference limit would let
    // anyone who knows a reference lock its contributor out.
    await enforceLimit(deps, RATE_LIMITS.statusPerIp10Min, ipValue(ctx), (w) => `Too many status checks from your network. Please try again in ${w}.`);
    return contributorView(deps, await loadContributorArticle(deps, reference, accessKey));
}

async function contributorView(deps: Deps, a: ArticleRow): Promise<ContributorView> {
    const events = await deps.repo.listEvents(a.id);
    const s = contributorStatus(a.status);
    return {
        reference: a.reference_code!,
        title: a.title,
        status: a.status,
        label: s.label,
        description: s.description,
        reason: a.status === 'CHANGES_REQUESTED' || a.status === 'REJECTED' ? a.public_reason : null,
        submittedAt: a.created_at,
        canResubmit: a.status === 'CHANGES_REQUESTED',
        publishedId: a.status === 'PUBLISHED' ? a.id : null,
        history: events
            .filter((e) => e.visibility === 'contributor')
            .map((e) => ({ at: e.created_at, label: e.to_status ? contributorStatus(e.to_status).label : 'Update' })),
    };
}

export async function resubmit(
    deps: Deps,
    reference: string,
    accessKey: string,
    input: { manuscriptUrl?: string; note: string; similarity?: Upload | null; ai?: Upload | null },
    ctx: PublicRequestContext = {},
): Promise<ContributorView> {
    await enforceLimit(deps, RATE_LIMITS.resubmitPerIpHour, ipValue(ctx), (w) => `Too many revision attempts from your network. Please try again in ${w}.`);
    const a = await loadContributorArticle(deps, reference, accessKey);
    const plan = planTransition(a, 'resubmit', { kind: 'contributor', id: 'contributor' });
    if (!plan.ok) throw new HttpError(409, plan.code, plan.message);
    const note = (input.note ?? '').trim();
    if (note.length < 10) throw new HttpError(422, 'VALIDATION', 'Describe what you changed (at least 10 characters).', { note: 'Describe what you changed.' });
    if (note.length > 4000) throw new HttpError(422, 'VALIDATION', 'Keep the revision note under 4000 characters.', { note: 'Too long.' });

    const patch: ArticlePatch = { ...plan.patch };
    if (input.manuscriptUrl?.trim()) {
        const url = checkManuscriptUrl(input.manuscriptUrl);
        if (!url.ok) throw new HttpError(422, 'VALIDATION', url.message, { manuscriptUrl: url.message });
        patch.manuscript_url = url.normalized;
    }
    // Validate every file before writing any, so a bad second file leaves nothing behind.
    const similarity = input.similarity ? assertPdf(input.similarity, 'Similarity report', MAX_REPORT_BYTES) : null;
    const ai = input.ai ? assertPdf(input.ai, 'AI detection report', MAX_REPORT_BYTES) : null;
    const uploaded: string[] = [];
    let updated: ArticleRow;
    try {
        if (similarity) {
            const p = objectName(deps, `submissions/${a.reference_code}/similarity`);
            await deps.files.put(BUCKETS.reports, p, similarity.bytes, 'application/pdf');
            uploaded.push(p);
            patch.similarity_report_path = p;
        }
        if (ai) {
            const p = objectName(deps, `submissions/${a.reference_code}/ai`);
            await deps.files.put(BUCKETS.reports, p, ai.bytes, 'application/pdf');
            uploaded.push(p);
            patch.ai_report_path = p;
        }
        updated = await deps.repo.applyChange({
            id: a.id,
            expectedStatus: a.status,
            expectedVersion: a.version,
            newStatus: plan.to,
            patch,
            event: {
                event_type: 'transition',
                action: 'resubmit',
                from_status: plan.from,
                to_status: plan.to,
                actor_id: 'contributor',
                actor_role: 'contributor',
                actor_label: a.submitted_email,
                reason: note,
                visibility: 'contributor',
                metadata: { replaced: { manuscript: Boolean(patch.manuscript_url), similarity: Boolean(input.similarity), ai: Boolean(input.ai) } },
            },
            notifications: contributorNotification(deps, a, 'revision_received', null),
        });
    } catch (err) {
        await discardUncommitted(deps, a.id, uploaded.map((path) => ({ bucket: BUCKETS.reports, path, purpose: 'uncommitted_resubmission' })));
        throw err;
    }
    // Committed: the superseded reports are no longer referenced, remove them.
    const superseded: CleanupTarget[] = [];
    if (patch.similarity_report_path && a.similarity_report_path && a.similarity_report_path !== patch.similarity_report_path) {
        superseded.push({ bucket: BUCKETS.reports, path: a.similarity_report_path, purpose: 'superseded_report' });
    }
    if (patch.ai_report_path && a.ai_report_path && a.ai_report_path !== patch.ai_report_path) {
        superseded.push({ bucket: BUCKETS.reports, path: a.ai_report_path, purpose: 'superseded_report' });
    }
    await cleanupObjects(deps, a.id, updated, superseded);
    return contributorView(deps, updated);
}

/* ------------------------------------------------------------------------ */
/* Staff operations                                                          */
/* ------------------------------------------------------------------------ */

function notStaff(): HttpError {
    return new HttpError(403, 'NOT_STAFF', 'This account does not have access to the IT Museum review portal.');
}

/**
 * Map a verified Firebase identity to an explicit, active staff record.
 * Deny by default: no record (or inactive) means no access.
 *
 * 1. A uid that is already linked is trusted by uid alone. The uid is
 *    immutable and was bound to the record by an earlier (verified) link, so
 *    a later change to the account's email or its verification flag does not
 *    matter here.
 * 2. Otherwise the email may be used to claim a pre-provisioned record, but
 *    only when Firebase asserts the email is verified — an unverified account
 *    proves nothing about who owns the address. The claim is a conditional
 *    update (firebase_uid IS NULL); only the request that actually linked the
 *    row, or a re-read showing this uid owns it, is granted access.
 */
export async function resolveStaff(deps: Deps, identity: StaffIdentity): Promise<StaffMember> {
    let staff = await deps.repo.findStaffByUid(identity.uid);
    if (!staff) {
        if (!identity.email) throw notStaff();
        // Same answer whether or not a staff record exists for this address, so
        // an unverified sign-up cannot be used to probe who is staff.
        if (!identity.emailVerified) {
            throw new HttpError(403, 'EMAIL_UNVERIFIED', 'Verify your email address before signing in to the review portal.');
        }
        const byEmail = await deps.repo.findStaffByEmail(identity.email.toLowerCase());
        if (!byEmail || byEmail.firebase_uid || !byEmail.active) throw notStaff();
        if (await deps.repo.linkStaffUid(byEmail.id, identity.uid)) {
            staff = { ...byEmail, firebase_uid: identity.uid };
        } else {
            // Lost a race (or the uid is linked elsewhere): trust only what the database now says.
            staff = await deps.repo.findStaffByUid(identity.uid);
        }
    }
    if (!staff || staff.firebase_uid !== identity.uid || !staff.active || !isStaffRole(staff.role)) throw notStaff();
    return staff;
}

function requireAdmin(staff: StaffMember) {
    if (staff.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Only an admin can do this.');
}

async function loadVisibleArticle(deps: Deps, staff: StaffMember, id: string): Promise<ArticleRow> {
    const a = await deps.repo.getArticle(id);
    if (!a || !visibleStatusesForRole(staff.role).includes(a.status)) {
        // Same response for "missing" and "not yours" to avoid leaking existence.
        throw new HttpError(404, 'NOT_FOUND', 'Article not found in your queues.');
    }
    return a;
}

function staffEvent(staff: StaffMember, partial: Partial<Omit<NewEvent, 'article_id'>> & Pick<NewEvent, 'event_type'>): Omit<NewEvent, 'article_id'> {
    return {
        action: null,
        from_status: null,
        to_status: null,
        reason: null,
        visibility: 'internal',
        metadata: {},
        ...partial,
        actor_id: staff.id,
        actor_role: staff.role,
        actor_label: staff.display_name || staff.email,
    };
}

/** A lean row for lists — never includes token hashes or report paths. */
export function summarize(a: ArticleRow) {
    return {
        id: a.id,
        reference_code: a.reference_code,
        title: a.title,
        author_name: a.author_name,
        status: a.status,
        version: a.version,
        assignee_id: a.assignee_id,
        created_at: a.created_at,
        stage_entered_at: a.stage_entered_at ?? a.updated_at ?? a.created_at,
        published_at: a.published_at,
        return_to_stage: a.return_to_stage,
        rejected_at_stage: a.rejected_at_stage,
        legacy_status: a.legacy_status,
        tags: a.tags ?? [],
    };
}
export type ArticleSummary = ReturnType<typeof summarize>;

export async function overview(deps: Deps, staff: StaffMember) {
    const counts = await deps.repo.countByStatus();
    const mine = queuesForRole(staff.role);
    const queue = await deps.repo.listArticles({ statuses: mine, limit: 200 }, staff.id);
    const cutoff = deps.now().getTime() - 7 * 24 * 3600 * 1000;
    const needsAttention = queue
        .filter((a) => new Date(a.stage_entered_at ?? a.created_at).getTime() < cutoff || a.assignee_id === staff.id)
        .slice(0, 10)
        .map(summarize);
    const visible = visibleStatusesForRole(staff.role);
    const scopedCounts = Object.fromEntries(visible.map((s) => [s, counts[s] ?? 0]));
    const recent = staff.role === 'admin' ? await deps.repo.listRecentEvents(15) : [];
    return { role: staff.role, queues: mine, counts: scopedCounts, needsAttention, recent: recent.map(publicEventShape) };
}

/** Validate the untrusted queue filter from the request body; anything malformed is a 400. */
function parseQueueQuery(raw: unknown): Partial<QueueQuery> {
    if (raw === undefined || raw === null) return {};
    if (!isPlainObject(raw)) throw badRequest('Invalid queue filter.');
    const out: Partial<QueueQuery> = {};
    const present = (v: unknown) => v !== undefined && v !== null && v !== '';

    if (present(raw.statuses)) {
        if (!Array.isArray(raw.statuses) || raw.statuses.length > 20 || raw.statuses.some((s) => typeof s !== 'string')) {
            throw badRequest('Invalid status filter.');
        }
        out.statuses = raw.statuses as Status[];
    }
    if (present(raw.search)) {
        if (typeof raw.search !== 'string') throw badRequest('Invalid search text.');
        out.search = raw.search.slice(0, 120);
    }
    if (present(raw.assignee)) {
        if (typeof raw.assignee !== 'string' || !(raw.assignee === 'me' || raw.assignee === 'unassigned' || UUID_RE.test(raw.assignee))) {
            throw badRequest('Invalid assignee filter.');
        }
        out.assignee = raw.assignee;
    }
    if (present(raw.minAgeDays)) {
        if (typeof raw.minAgeDays !== 'number' || !Number.isFinite(raw.minAgeDays) || raw.minAgeDays < 0 || raw.minAgeDays > 36500) {
            throw badRequest('Invalid minimum age.');
        }
        out.minAgeDays = raw.minAgeDays;
    }
    if (present(raw.limit)) {
        if (typeof raw.limit !== 'number' || !Number.isFinite(raw.limit) || raw.limit < 1) throw badRequest('Invalid limit.');
        out.limit = Math.floor(raw.limit);
    }
    for (const key of ['submittedFrom', 'submittedTo'] as const) {
        if (!present(raw[key])) continue;
        const v = raw[key];
        const time = typeof v === 'string' && v.length <= 64 ? new Date(v).getTime() : NaN;
        if (!Number.isFinite(time)) throw badRequest('Invalid date filter.');
        out[key] = new Date(time).toISOString();
    }
    return out;
}

export async function listQueue(deps: Deps, staff: StaffMember, rawQuery: unknown) {
    const query = parseQueueQuery(rawQuery);
    const visible = visibleStatusesForRole(staff.role);
    const requested = (query.statuses ?? []).filter(isStatus);
    const statuses = requested.length ? requested.filter((s) => visible.includes(s)) : queuesForRole(staff.role);
    if (!statuses.length) throw new HttpError(403, 'FORBIDDEN', 'You cannot view that queue.');
    const rows = await deps.repo.listArticles(
        {
            statuses,
            search: query.search,
            assignee: query.assignee,
            minAgeDays: query.minAgeDays,
            submittedFrom: query.submittedFrom,
            submittedTo: query.submittedTo,
            limit: Math.min(query.limit ?? 100, 300),
        },
        staff.id,
    );
    return rows.map(summarize);
}

function publicEventShape(e: EventRow) {
    return {
        id: e.id,
        article_id: e.article_id,
        created_at: e.created_at,
        event_type: e.event_type,
        action: e.action,
        from_status: e.from_status,
        to_status: e.to_status,
        actor_role: e.actor_role,
        actor_label: e.actor_label,
        reason: e.reason,
        visibility: e.visibility,
        metadata: e.metadata,
    };
}

export async function articleDetail(deps: Deps, staff: StaffMember, id: string) {
    const a = await loadVisibleArticle(deps, staff, id);
    const events = await deps.repo.listEvents(a.id);
    const simPath = a.similarity_report_path ?? storagePathFromUrl(a.similarity_report_url, BUCKETS.reports);
    const aiPath = a.ai_report_path ?? storagePathFromUrl(a.ai_report_url, BUCKETS.reports);
    const sign = (bucket: string, path: string | null) => (path ? deps.files.signedUrl(bucket, path, SIGNED_URL_SECONDS) : Promise.resolve(null));
    const [similarityUrl, aiUrl, stagedPdfUrl] = await Promise.all([
        sign(BUCKETS.reports, simPath),
        sign(BUCKETS.reports, aiPath),
        staff.role === 'admin' ? sign(BUCKETS.staging, a.staged_pdf_path) : Promise.resolve(null),
    ]);
    const { contributor_token_hash: _hidden, ...rest } = a;
    void _hidden;
    return {
        article: {
            ...rest,
            manuscript_url: a.manuscript_url ?? (a.file_url && checkManuscriptUrl(a.file_url).ok ? a.file_url : null),
        },
        files: { similarityUrl, aiUrl, stagedPdfUrl, publishedPdfUrl: a.published_pdf_url },
        events: events.map(publicEventShape),
        checklist: publicationChecklist(a),
        // Storage clean-ups that failed and still need an admin retry (e.g. a public PDF left behind by unpublish).
        pendingStorageCleanup: staff.role === 'admin' ? pendingCleanups(events) : [],
    };
}

export async function transition(
    deps: Deps,
    staff: StaffMember,
    input: { id: string; action: string; reason?: string; expectedVersion: number },
) {
    if (!isAction(input.action)) throw new HttpError(400, 'UNKNOWN_ACTION', 'Unknown action.');
    if (input.reason !== undefined && input.reason !== null && typeof input.reason !== 'string') throw badRequest('The reason must be text.');
    const action = input.action as WorkflowAction;
    const a = await loadVisibleArticle(deps, staff, input.id);
    if (a.version !== input.expectedVersion) throw new ConflictError();
    const plan = planTransition(a, action, { kind: 'staff', id: staff.id, role: staff.role }, input.reason);
    if (!plan.ok) throw new HttpError(plan.code === 'FORBIDDEN' ? 403 : 422, plan.code, plan.message);

    const patch: ArticlePatch = { ...plan.patch };
    // Objects this attempt wrote (removed again if the change does not commit)
    // and objects it supersedes (removed only after the change commits).
    const written: CleanupTarget[] = [];
    const removeAfterCommit: CleanupTarget[] = [];

    try {
        // Publishing copies the staged final PDF into the public bucket. The
        // destination is unique to this attempt: two concurrent publishes never
        // share a path, so the one that loses the version check can only ever
        // remove its own copy, never the winner's live PDF.
        if (action === 'publish') {
            const source = a.staged_pdf_path;
            if (source) {
                const dest = objectName(deps, `published/${a.id}`);
                await deps.files.copy(BUCKETS.staging, source, BUCKETS.public, dest);
                written.push({ bucket: BUCKETS.public, path: dest, purpose: 'uncommitted_publish' });
                patch.published_pdf_path = dest;
                patch.published_pdf_url = deps.files.publicUrl(BUCKETS.public, dest);
                if (a.published_pdf_path && a.published_pdf_path !== dest) {
                    removeAfterCommit.push({ bucket: BUCKETS.public, path: a.published_pdf_path, purpose: 'replaced_public_pdf' });
                }
            }
            // else: a legacy record re-published with its existing public PDF.
        }

        // Unpublishing keeps a private copy in staging, then removes the public object.
        if (action === 'unpublish') {
            const publicPath = a.published_pdf_path ?? storagePathFromUrl(a.published_pdf_url ?? a.file_url, BUCKETS.public);
            if (publicPath) {
                if (!a.staged_pdf_path) {
                    const keep = objectName(deps, `unpublished/${a.id}`);
                    await deps.files.copy(BUCKETS.public, publicPath, BUCKETS.staging, keep);
                    written.push({ bucket: BUCKETS.staging, path: keep, purpose: 'uncommitted_unpublish' });
                    patch.staged_pdf_path = keep;
                }
                removeAfterCommit.push({ bucket: BUCKETS.public, path: publicPath, purpose: 'unpublished' });
            }
            patch.published_pdf_path = null;
            patch.published_pdf_url = null;
        }
    } catch (err) {
        await discardUncommitted(deps, a.id, written);
        throw err;
    }

    const template = plan.notify;
    const reasonForContributor = plan.reasonVisibleToContributor ? (input.reason ?? '').trim() : null;
    let updated: ArticleRow;
    try {
        updated = await deps.repo.applyChange({
            id: a.id,
            expectedStatus: a.status,
            expectedVersion: a.version,
            newStatus: plan.to,
            patch,
            event: staffEvent(staff, {
                event_type: 'transition',
                action,
                from_status: plan.from,
                to_status: plan.to,
                reason: input.reason?.trim() || null,
                visibility: plan.reasonVisibleToContributor ? 'contributor' : 'internal',
                metadata: action === 'publish' ? { pdf: patch.published_pdf_path ?? a.published_pdf_path } : {},
            }),
            notifications: template ? contributorNotification(deps, { ...a, title: a.title }, template, reasonForContributor) : [],
        });
    } catch (err) {
        await discardUncommitted(deps, a.id, written);
        throw err;
    }
    // Committed. If removing the old public PDF still fails after retries, the
    // failure is logged and recorded as a `file` event for retryStorageCleanup.
    await cleanupObjects(deps, a.id, updated, removeAfterCommit);
    return summarize(updated);
}

/**
 * Admin action: retry storage clean-ups that failed earlier for one article
 * (for example an unpublished PDF whose public copy could not be deleted).
 * Only targets recorded by the service itself are considered, and an object
 * the row references again is never removed.
 */
export async function retryStorageCleanup(deps: Deps, staff: StaffMember, input: { id: string }) {
    requireAdmin(staff);
    const a = await loadVisibleArticle(deps, staff, input.id);
    const pending = pendingCleanups(await deps.repo.listEvents(a.id)).filter((t) => KNOWN_BUCKETS.includes(t.bucket));
    const removed: CleanupTarget[] = [];
    const skipped: CleanupTarget[] = [];
    const failed: CleanupTarget[] = [];
    for (const t of pending) {
        if (isReferenced(a, t.bucket, t.path)) {
            skipped.push(t);
            await deps.repo.insertEvent({ article_id: a.id, ...cleanupEvent(t, 'skipped_referenced', { requested_by: staff.id }) });
            continue;
        }
        const stillFailing = await cleanupObjects(deps, a.id, a, [t]);
        if (stillFailing.length) {
            failed.push(t);
        } else {
            removed.push(t);
            await deps.repo.insertEvent({ article_id: a.id, ...cleanupEvent(t, 'done', { requested_by: staff.id }) });
        }
    }
    return { removed, skipped, failed };
}

export async function addNote(deps: Deps, staff: StaffMember, input: { id: string; body: string }) {
    const a = await loadVisibleArticle(deps, staff, input.id);
    const body = (input.body ?? '').trim();
    if (body.length < 2) throw new HttpError(422, 'VALIDATION', 'Write a note first.');
    if (body.length > 8000) throw new HttpError(422, 'VALIDATION', 'Notes are limited to 8000 characters.');
    await deps.repo.insertEvent({
        article_id: a.id,
        ...staffEvent(staff, { event_type: 'note', reason: body, from_status: a.status, to_status: a.status, metadata: { stage: a.status } }),
    });
    return { ok: true };
}

export async function assign(deps: Deps, staff: StaffMember, input: { id: string; assigneeId: string | null; expectedVersion: number }) {
    requireAdmin(staff);
    const a = await loadVisibleArticle(deps, staff, input.id);
    let label: string | null = null;
    if (input.assigneeId) {
        const all = await deps.repo.listStaff();
        const target = all.find((s) => s.id === input.assigneeId && s.active);
        if (!target) throw new HttpError(422, 'VALIDATION', 'Choose an active staff member.');
        label = target.display_name || target.email;
    }
    const updated = await deps.repo.applyChange({
        id: a.id,
        expectedStatus: a.status,
        expectedVersion: input.expectedVersion,
        newStatus: null,
        patch: { assignee_id: input.assigneeId },
        event: staffEvent(staff, { event_type: 'assignment', metadata: { assignee_id: input.assigneeId, assignee: label } }),
        notifications: [],
    });
    return summarize(updated);
}

/** Literature reviewers may suggest tags; only admins edit the published metadata. */
export async function suggestTags(deps: Deps, staff: StaffMember, input: { id: string; tags: string[]; expectedVersion: number }) {
    const a = await loadVisibleArticle(deps, staff, input.id);
    const allowed = (staff.role === 'lit_reviewer' && a.status === 'LIT_REVIEW') || staff.role === 'admin';
    if (!allowed) throw new HttpError(403, 'FORBIDDEN', 'Tag suggestions are made during literature review.');
    const tags = normalizeTags(Array.isArray(input.tags) ? input.tags.map(String) : []);
    const updated = await deps.repo.applyChange({
        id: a.id,
        expectedStatus: a.status,
        expectedVersion: input.expectedVersion,
        newStatus: null,
        patch: { suggested_tags: tags },
        event: staffEvent(staff, { event_type: 'metadata', metadata: { suggested_tags: tags } }),
        notifications: [],
    });
    return summarize(updated);
}

export async function updateMetadata(
    deps: Deps,
    staff: StaffMember,
    input: { id: string; expectedVersion: number; fields: { title?: string; description?: string; tags?: string[]; author_name?: string } },
) {
    requireAdmin(staff);
    const a = await loadVisibleArticle(deps, staff, input.id);
    const patch: ArticlePatch = {};
    const f = input.fields ?? {};
    if (f.title !== undefined) {
        const t = String(f.title).trim();
        if (t.length < 5 || t.length > 300) throw new HttpError(422, 'VALIDATION', 'Title must be 5–300 characters.', { title: 'Title must be 5–300 characters.' });
        patch.title = t;
    }
    if (f.description !== undefined) {
        const d = String(f.description).trim();
        if (d.length < 30) throw new HttpError(422, 'VALIDATION', 'Description must be at least 30 characters.', { description: 'Too short.' });
        if (d.length > MAX_DESCRIPTION_CHARS) {
            throw new HttpError(422, 'VALIDATION', `Description must be ${MAX_DESCRIPTION_CHARS} characters or fewer.`, { description: 'Too long.' });
        }
        patch.description = d;
    }
    if (f.author_name !== undefined) {
        const n = String(f.author_name).trim();
        if (!n) throw new HttpError(422, 'VALIDATION', 'Author credit cannot be empty.', { author_name: 'Required.' });
        if (n.length > MAX_AUTHOR_CREDIT_CHARS) {
            throw new HttpError(422, 'VALIDATION', `Author credit must be ${MAX_AUTHOR_CREDIT_CHARS} characters or fewer.`, { author_name: 'Too long.' });
        }
        patch.author_name = n;
    }
    if (f.tags !== undefined) patch.tags = normalizeTags(Array.isArray(f.tags) ? f.tags.map(String) : []);
    if (!Object.keys(patch).length) throw new HttpError(422, 'VALIDATION', 'Nothing to update.');
    const changed = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { from: (a as unknown as Record<string, unknown>)[k], to: v }]));
    const updated = await deps.repo.applyChange({
        id: a.id,
        expectedStatus: a.status,
        expectedVersion: input.expectedVersion,
        newStatus: null,
        patch,
        event: staffEvent(staff, { event_type: 'metadata', metadata: { changed } }),
        notifications: [],
    });
    return summarize(updated);
}

/** Upload (or replace) the final PDF in private staging. Admin only, before publishing. */
export async function stageFinalPdf(deps: Deps, staff: StaffMember, input: { id: string; expectedVersion: number; file: Upload | null }) {
    requireAdmin(staff);
    const a = await loadVisibleArticle(deps, staff, input.id);
    if (a.status !== 'FINAL_APPROVAL' && a.status !== 'UNPUBLISHED') {
        throw new HttpError(422, 'INVALID_STATE', 'Final PDFs are prepared during final approval.');
    }
    const file = assertPdf(input.file, 'Final PDF', MAX_FINAL_PDF_BYTES);
    const path = objectName(deps, `final/${a.id}`);
    await deps.files.put(BUCKETS.staging, path, file.bytes, 'application/pdf');
    let updated: ArticleRow;
    try {
        updated = await deps.repo.applyChange({
            id: a.id,
            expectedStatus: a.status,
            expectedVersion: input.expectedVersion,
            newStatus: null,
            patch: { staged_pdf_path: path },
            event: staffEvent(staff, { event_type: 'file', metadata: { staged_pdf_path: path, previous: a.staged_pdf_path, name: file.name, bytes: file.bytes.length } }),
            notifications: [],
        });
    } catch (err) {
        await discardUncommitted(deps, a.id, [{ bucket: BUCKETS.staging, path, purpose: 'uncommitted_staged_pdf' }]);
        throw err;
    }
    // Committed: the previously staged PDF is no longer referenced.
    if (a.staged_pdf_path && a.staged_pdf_path !== path) {
        await cleanupObjects(deps, a.id, updated, [{ bucket: BUCKETS.staging, path: a.staged_pdf_path, purpose: 'replaced_staged_pdf' }]);
    }
    return summarize(updated);
}

export async function listStaff(deps: Deps, staff: StaffMember) {
    // Reviewers need names for assignment labels; only admins see emails and status.
    const all = await deps.repo.listStaff();
    if (staff.role === 'admin') return all.map(({ firebase_uid, ...s }) => ({ ...s, linked: Boolean(firebase_uid) }));
    return all.filter((s) => s.active).map((s) => ({ id: s.id, display_name: s.display_name, role: s.role }));
}

export async function upsertStaff(
    deps: Deps,
    staff: StaffMember,
    input: { id?: string; email: string; display_name: string; role: string; active: boolean },
) {
    requireAdmin(staff);
    const email = String(input.email ?? '').trim().toLowerCase();
    if (!isEmail(email)) throw new HttpError(422, 'VALIDATION', 'Enter a valid email address.', { email: 'Invalid email.' });
    if (!isStaffRole(input.role)) throw new HttpError(422, 'VALIDATION', 'Choose a role.', { role: 'Choose a role.' });
    const name = String(input.display_name ?? '').trim();
    if (!name) throw new HttpError(422, 'VALIDATION', 'Enter a display name.', { display_name: 'Required.' });
    if (input.id === staff.id && (!input.active || input.role !== 'admin')) {
        throw new HttpError(422, 'SELF_LOCKOUT', 'You cannot remove your own admin access. Ask another admin.');
    }
    try {
        return await deps.repo.upsertStaff({ id: input.id, email, display_name: name, role: input.role, active: Boolean(input.active) });
    } catch (e) {
        // The self-lockout check above only covers the caller. The database guard
        // (migration 0004) also covers demoting the last *other* admin and two
        // admins demoting each other at the same time.
        if (e instanceof LastAdminError) throw new HttpError(409, 'LAST_ADMIN', e.message);
        throw e;
    }
}
