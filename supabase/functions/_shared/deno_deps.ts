// Deno-only adapters: Supabase service-role client, storage, Firebase token
// verification and HTTP helpers. Not imported by the frontend or tests.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';
import { ConflictError, DuplicateSubmissionError, LastAdminError, type ArticleRow, type Deps, type EventRow, type FileStore, type Repo, type StaffIdentity, type StaffMember } from './types.ts';
import { classifyTokenError, FIREBASE_REQUIRED_CLAIMS, FIREBASE_TOKEN_ALGORITHMS, identityFromClaims } from './auth.ts';
import { HttpError, RateLimitedError } from './service.ts';
import { MAX_REPORT_BYTES } from './validation.ts';
import { STATUSES } from './workflow.ts';

/* ------------------------------------------------------------------ env */

function env(name: string, required = true): string {
    const v = Deno.env.get(name) ?? '';
    if (required && !v) throw new Error(`Missing required environment variable ${name}`);
    return v;
}

export function serviceClient(): SupabaseClient {
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the Edge runtime.
    return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/* ------------------------------------------------------------------ http */

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin') ?? '';
    const allow = allowedOrigins.length === 0 ? '*' : allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Expose-Headers': 'Retry-After',
        Vary: 'Origin',
    };
}

export function json(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
    });
}

export function errorResponse(req: Request, err: unknown): Response {
    if (err instanceof RateLimitedError) {
        return json(
            req,
            { error: { code: err.code, message: err.message, fields: null, retryAfterSeconds: err.retryAfterSeconds } },
            429,
            { 'Retry-After': String(err.retryAfterSeconds) },
        );
    }
    if (err instanceof HttpError) {
        return json(req, { error: { code: err.code, message: err.message, fields: err.fieldErrors ?? null } }, err.status);
    }
    if (err instanceof ConflictError) {
        return json(req, { error: { code: 'CONFLICT', message: err.message } }, 409);
    }
    console.error(err);
    return json(req, { error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, 500);
}

/* ------------------------------------------------------------------ auth */

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
const firebaseJwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/**
 * Verify a Firebase Auth ID token: RS256 signature against Google's keys,
 * issuer, audience, expiry and required claims. Bad or expired tokens are 401;
 * failure to fetch/trust the key set is 503 so clients retry instead of
 * signing the user out.
 */
export async function verifyFirebaseToken(req: Request): Promise<StaffIdentity> {
    if (!FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is not configured');
    const header = req.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    let payload: Record<string, unknown>;
    try {
        ({ payload } = await jwtVerify(token, firebaseJwks, {
            issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
            audience: FIREBASE_PROJECT_ID,
            algorithms: FIREBASE_TOKEN_ALGORITHMS,
            requiredClaims: FIREBASE_REQUIRED_CLAIMS,
        }));
    } catch (err) {
        if (classifyTokenError(err) === 'unavailable') {
            console.error('Firebase key set unavailable:', err instanceof Error ? `${err.name}: ${err.message}` : 'error');
            throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Sign-in could not be checked right now. Please try again in a moment.');
        }
        throw new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    }
    const identity = identityFromClaims(payload);
    if (!identity) throw new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    return identity;
}

/* ------------------------------------------------------------------ deps */

function isStale(error: { message?: string } | null): boolean {
    return Boolean(error?.message?.includes('STALE_VERSION'));
}

export function supabaseRepo(db: SupabaseClient): Repo {
    const one = async <T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> => {
        const { data, error } = await p;
        if (error) throw new Error(error.message);
        return data;
    };
    return {
        getArticle: (id) => one(db.from('articles').select('*').eq('id', id).maybeSingle()) as Promise<ArticleRow | null>,
        getArticleByReference: (reference) =>
            one(db.from('articles').select('*').eq('reference_code', reference).maybeSingle()) as Promise<ArticleRow | null>,
        async listArticles(q, staffId) {
            let query = db.from('articles').select('*').in('status', q.statuses);
            if (q.search) {
                const s = q.search.replace(/[%,()]/g, ' ').trim();
                if (s) query = query.or(`title.ilike.%${s}%,author_name.ilike.%${s}%,reference_code.ilike.%${s}%`);
            }
            if (q.assignee === 'me') query = query.eq('assignee_id', staffId);
            else if (q.assignee === 'unassigned') query = query.is('assignee_id', null);
            else if (q.assignee) query = query.eq('assignee_id', q.assignee);
            if (q.minAgeDays) query = query.lte('stage_entered_at', new Date(Date.now() - q.minAgeDays * 86400000).toISOString());
            if (q.submittedFrom) query = query.gte('created_at', q.submittedFrom);
            if (q.submittedTo) query = query.lte('created_at', q.submittedTo);
            const rows = await one(query.order('stage_entered_at', { ascending: true, nullsFirst: true }).limit(q.limit ?? 100));
            return (rows ?? []) as ArticleRow[];
        },
        async countByStatus() {
            // One head-only count per status: exact totals, no row transfer, no max-rows truncation.
            const entries = await Promise.all(
                STATUSES.map(async (status) => {
                    const { count, error } = await db.from('articles').select('*', { count: 'exact', head: true }).eq('status', status);
                    if (error) throw new Error(error.message);
                    return [status, count ?? 0] as const;
                }),
            );
            return Object.fromEntries(entries.filter(([, n]) => n > 0)) as Partial<Record<(typeof STATUSES)[number], number>>;
        },
        async createSubmission(row, event, notifications, idempotency) {
            if (!idempotency) {
                const { data, error } = await db.rpc('create_submission', { p_row: row, p_event: event, p_notifications: notifications });
                if (error) throw new Error(error.message);
                return data as ArticleRow;
            }
            const { data, error } = await db.rpc('create_submission_idempotent', {
                p_row: row,
                p_event: event,
                p_notifications: notifications,
                p_key_hash: idempotency.keyHash,
                p_request_hash: idempotency.requestHash,
            });
            if (error) throw new Error(error.message);
            const r = data as { duplicate: boolean; article?: ArticleRow; article_id?: string | null; request_hash?: string; created_at?: string };
            if (r.duplicate) {
                throw new DuplicateSubmissionError({ articleId: r.article_id ?? null, requestHash: r.request_hash ?? '', createdAt: r.created_at ?? '' });
            }
            return r.article as ArticleRow;
        },
        async findIdempotency(keyHash) {
            const row = await one(
                db.from('submission_idempotency').select('article_id, request_hash, created_at').eq('key_hash', keyHash).maybeSingle(),
            );
            const r = row as { article_id: string | null; request_hash: string; created_at: string } | null;
            return r ? { articleId: r.article_id, requestHash: r.request_hash, createdAt: r.created_at } : null;
        },
        async consumeRateLimit(bucket, keyHash, windowSeconds, max) {
            const { data, error } = await db.rpc('consume_rate_limit', {
                p_bucket: bucket,
                p_key_hash: keyHash,
                p_window_seconds: windowSeconds,
                p_max: max,
            });
            if (error) throw new Error(error.message);
            const r = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; retry_after_seconds: number } | undefined;
            if (!r) throw new Error('consume_rate_limit returned no row');
            return { allowed: r.allowed === true, retryAfterSeconds: Number(r.retry_after_seconds) || 0 };
        },
        async applyChange(a) {
            const { data, error } = await db.rpc('apply_article_change', {
                p_id: a.id,
                p_expected_status: a.expectedStatus,
                p_expected_version: a.expectedVersion,
                p_new_status: a.newStatus,
                p_patch: a.patch,
                p_event: a.event,
                p_notifications: a.notifications,
            });
            if (isStale(error)) throw new ConflictError();
            if (error) throw new Error(error.message);
            return data as ArticleRow;
        },
        async insertEvent(e) {
            const { error } = await db.from('article_events').insert(e);
            if (error) throw new Error(error.message);
        },
        listEvents: async (articleId) =>
            ((await one(db.from('article_events').select('*').eq('article_id', articleId).order('created_at', { ascending: true }))) ?? []) as EventRow[],
        listRecentEvents: async (limit) =>
            ((await one(db.from('article_events').select('*').neq('event_type', 'legacy_import').order('created_at', { ascending: false }).limit(limit))) ?? []) as EventRow[],
        findStaffByUid: (uid) => one(db.from('staff_members').select('*').eq('firebase_uid', uid).maybeSingle()) as Promise<StaffMember | null>,
        findStaffByEmail: (email) => one(db.from('staff_members').select('*').eq('email', email).maybeSingle()) as Promise<StaffMember | null>,
        async linkStaffUid(id, uid) {
            // Conditional update: only claims a row that is still unlinked. `.select('id')` returns the
            // affected rows, so a concurrent request that lost the race sees 0 rows and gets false.
            const { data, error } = await db
                .from('staff_members')
                .update({ firebase_uid: uid, updated_at: new Date().toISOString() })
                .eq('id', id)
                .is('firebase_uid', null)
                .select('id');
            // 23505 = unique_violation: this uid already owns another staff row. Not linked; the caller decides (403).
            if (error && (error as { code?: string }).code === '23505') return false;
            if (error) throw new Error(error.message);
            return (data?.length ?? 0) === 1;
        },
        listStaff: async () => ((await one(db.from('staff_members').select('*').order('role').order('display_name'))) ?? []) as StaffMember[],
        async upsertStaff(m) {
            const row = { ...m, updated_at: new Date().toISOString() };
            const q = m.id ? db.from('staff_members').update(row).eq('id', m.id) : db.from('staff_members').insert(row);
            const { data, error } = await q.select('*').single();
            if (error) {
                if (error.message.includes('duplicate')) throw new HttpError(409, 'DUPLICATE', 'A staff member with this email already exists.');
                // Trigger staff_members_keep_an_admin (migration 0004).
                if (error.message.includes('LAST_ADMIN')) throw new LastAdminError();
                // 40P01 deadlock / 40001 serialization failure: two admins changed staff at the same moment.
                const code = (error as { code?: string }).code;
                if (code === '40P01' || code === '40001') {
                    throw new HttpError(409, 'CONFLICT', 'Another staff change happened at the same time. Reload and try again.');
                }
                throw new Error(error.message);
            }
            return data as StaffMember;
        },
    };
}

export function supabaseFiles(db: SupabaseClient): FileStore {
    return {
        async put(bucket, path, bytes, contentType) {
            const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
            if (error) throw new Error(`Upload failed: ${error.message}`);
        },
        async copy(fromBucket, fromPath, toBucket, toPath) {
            // Never overwrite (see FileStore): the same-bucket copy API refuses an existing
            // destination, and the cross-bucket path uploads with upsert: false to match.
            if (fromBucket === toBucket) {
                const { error } = await db.storage.from(fromBucket).copy(fromPath, toPath);
                if (error) throw new Error(`Copy failed: ${error.message}`);
                return;
            }
            const { data, error } = await db.storage.from(fromBucket).download(fromPath);
            if (error || !data) throw new Error(`Copy failed: ${error?.message ?? 'missing source'}`);
            const { error: upErr } = await db.storage
                .from(toBucket)
                .upload(toPath, new Uint8Array(await data.arrayBuffer()), { contentType: 'application/pdf', upsert: false });
            if (upErr) throw new Error(`Copy failed: ${upErr.message}`);
        },
        async remove(bucket, path) {
            const { error } = await db.storage.from(bucket).remove([path]);
            if (error) throw new Error(error.message);
        },
        async signedUrl(bucket, path, seconds) {
            const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
            if (error) return null;
            return data.signedUrl;
        },
        publicUrl(bucket, path) {
            return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        },
    };
}

const SECRET_ENV = { 'rate-limit': 'RATE_LIMIT_SALT', 'access-key': 'ACCESS_KEY_SECRET' } as const;
const hmacKeys = new Map<string, Promise<CryptoKey>>();

async function importHmacKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/**
 * HMAC key for a purpose: the dedicated secret when set, otherwise one derived
 * from the service role key (HMAC(service_key, "itm:<purpose>")) so limits
 * and retry recovery still work, and nothing guessable is used, before the
 * dedicated secrets are configured. Setting or rotating a dedicated secret
 * resets rate-limit windows and stops access-key recovery for retries of
 * older attempts (they then get the reference only) — both harmless.
 */
function hmacKeyFor(purpose: keyof typeof SECRET_ENV): Promise<CryptoKey> {
    let key = hmacKeys.get(purpose);
    if (!key) {
        const enc = new TextEncoder();
        const dedicated = env(SECRET_ENV[purpose], false);
        key = dedicated
            ? importHmacKey(enc.encode(dedicated))
            : importHmacKey(enc.encode(env('SUPABASE_SERVICE_ROLE_KEY')))
                  .then((k) => crypto.subtle.sign('HMAC', k, enc.encode(`itm:${purpose}`)))
                  .then((derived) => importHmacKey(new Uint8Array(derived)));
        hmacKeys.set(purpose, key);
    }
    return key;
}

async function hmacHex(purpose: keyof typeof SECRET_ENV, message: string): Promise<string> {
    const sig = await crypto.subtle.sign('HMAC', await hmacKeyFor(purpose), new TextEncoder().encode(message));
    return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function realDeps(db: SupabaseClient): Deps {
    return {
        repo: supabaseRepo(db),
        files: supabaseFiles(db),
        now: () => new Date(),
        randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
        async sha256Hex(input) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
            return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
        },
        hmacHex: (purpose, message) => hmacHex(purpose, message),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        siteUrl: env('PUBLIC_SITE_URL', false) || 'https://itmuseum.christuniversity.in',
    };
}

/**
 * Guard against oversized or unbounded request bodies before reading them.
 * Multipart uploads must declare a Content-Length (411 otherwise), because the
 * runtime only bounds the body by the declared length; chunked bodies are refused.
 */
export function checkRequestSize(req: Request, maxBytes: number, tooLargeMessage: string): void {
    const raw = req.headers.get('content-length');
    const length = raw === null || raw.trim() === '' ? NaN : Number(raw);
    const multipart = (req.headers.get('content-type') ?? '').includes('multipart/form-data');
    if (multipart && !Number.isFinite(length)) {
        throw new HttpError(411, 'LENGTH_REQUIRED', 'Uploads must declare their size (Content-Length is required).');
    }
    if (Number.isFinite(length) && length > maxBytes) throw new HttpError(413, 'TOO_LARGE', tooLargeMessage);
}

/** Parse multipart form data; a malformed body is the client's mistake (400), not a server error. */
export async function readForm(req: Request): Promise<FormData> {
    try {
        return await req.formData();
    } catch {
        throw new HttpError(400, 'BAD_REQUEST', 'The upload could not be read. Check the form and try again.');
    }
}

/** Read an uploaded File from multipart form data into memory, refusing files over `maxBytes` before buffering. */
export async function readUpload(form: FormData, field: string, maxBytes: number = MAX_REPORT_BYTES) {
    const f = form.get(field);
    if (!f || typeof f === 'string') return null;
    if (f.size > maxBytes) {
        throw new HttpError(413, 'TOO_LARGE', `The file is too large (${Math.round(maxBytes / 1024 / 1024)} MB maximum).`);
    }
    return { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) };
}

/** Fire-and-forget: ask the notification worker to drain the outbox now. */
export function kickNotifications() {
    const url = `${env('SUPABASE_URL')}/functions/v1/notify-worker`;
    const p = fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` },
        signal: AbortSignal.timeout(5000),
    })
        .then((res) => {
            if (!res.ok) console.warn(`notify-worker kick returned HTTP ${res.status} (will retry on schedule)`);
            return res.body?.cancel();
        })
        .catch((e) => console.warn('notify-worker kick failed (will retry on schedule):', e instanceof Error ? e.name : 'error'));
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(p);
}
