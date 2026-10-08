import type { ReviewStage, StaffRole, Status, WorkflowAction } from './workflow.ts';
import type { AuthorInput } from './validation.ts';

/** Storage buckets. `articles` is intentionally public (published PDFs only). */
export const BUCKETS = {
    reports: 'reports', // private: similarity + AI reports
    staging: 'publication-staging', // private: final PDFs before/after publication
    public: 'articles', // public: currently published PDFs
} as const;

export interface ArticleRow {
    id: string;
    reference_code: string | null;
    status: Status;
    version: number;
    legacy_status: string | null;
    return_to_stage: ReviewStage | null;
    rejected_at_stage: ReviewStage | null;
    public_reason: string | null;

    title: string;
    description: string;
    keywords: string | null;
    tags: string[] | null;
    suggested_tags: string[] | null;

    author_name: string;
    institution_email: string | null;
    author_designations: string | null;
    num_authors: number | null;
    authors: AuthorInput[] | null;
    submitted_email: string | null;
    originality_confirmed: boolean | null;

    /** Legacy column, never overwritten by the new workflow. */
    file_url: string | null;
    manuscript_url: string | null;
    similarity_report_url: string | null;
    ai_report_url: string | null;
    similarity_report_path: string | null;
    ai_report_path: string | null;
    staged_pdf_path: string | null;
    published_pdf_path: string | null;
    published_pdf_url: string | null;

    assignee_id: string | null;
    contributor_token_hash: string | null;

    created_at: string;
    updated_at: string | null;
    stage_entered_at: string | null;
    published_at: string | null;
    unpublished_at: string | null;
}

export type EventType =
    | 'submitted'
    | 'transition'
    | 'note'
    | 'metadata'
    | 'assignment'
    | 'file'
    | 'legacy_import';

export interface NewEvent {
    article_id: string;
    event_type: EventType;
    action: WorkflowAction | null;
    from_status: Status | null;
    to_status: Status | null;
    actor_id: string;
    actor_role: StaffRole | 'contributor' | 'system';
    actor_label: string | null;
    reason: string | null;
    visibility: 'internal' | 'contributor';
    metadata: Record<string, unknown>;
}

export interface EventRow extends NewEvent {
    id: number;
    created_at: string;
}

export interface NewNotification {
    recipient: string;
    template: string;
    payload: Record<string, unknown>;
}

export interface StaffMember {
    id: string;
    firebase_uid: string | null;
    email: string;
    display_name: string;
    role: StaffRole;
    active: boolean;
    created_at?: string;
}

export interface QueueQuery {
    statuses: Status[];
    search?: string;
    assignee?: 'me' | 'unassigned' | string;
    minAgeDays?: number;
    submittedFrom?: string;
    submittedTo?: string;
    limit?: number;
}

/** Columns that may change through `applyChange`. Anything else is rejected by the SQL function too. */
export type ArticlePatch = Partial<
    Pick<
        ArticleRow,
        | 'return_to_stage'
        | 'rejected_at_stage'
        | 'public_reason'
        | 'title'
        | 'description'
        | 'tags'
        | 'suggested_tags'
        | 'author_name'
        | 'assignee_id'
        | 'manuscript_url'
        | 'similarity_report_path'
        | 'ai_report_path'
        | 'staged_pdf_path'
        | 'published_pdf_path'
        | 'published_pdf_url'
    >
> & { published_at?: 'now' | null; unpublished_at?: 'now' | null };

export class ConflictError extends Error {
    constructor(message = 'This article changed while you were working on it. Reload to see the latest version.') {
        super(message);
        this.name = 'ConflictError';
    }
}

/**
 * The database refused a staff change that would leave zero active admins
 * (trigger staff_members_keep_an_admin, migration 0004).
 */
export class LastAdminError extends Error {
    constructor(message = 'At least one active admin is required. Make another staff member an active admin first.') {
        super(message);
        this.name = 'LastAdminError';
    }
}

/** A submission idempotency key that was already used (migration 0005). Hashes only. */
export interface IdempotencyRecord {
    articleId: string | null;
    requestHash: string;
    createdAt: string;
}

/**
 * createSubmission found the idempotency key already used (a concurrent or
 * earlier request with the same key committed first). Nothing was written.
 */
export class DuplicateSubmissionError extends Error {
    constructor(public existing: IdempotencyRecord) {
        super('This submission was already received.');
        this.name = 'DuplicateSubmissionError';
    }
}

export interface Repo {
    getArticle(id: string): Promise<ArticleRow | null>;
    getArticleByReference(reference: string): Promise<ArticleRow | null>;
    listArticles(query: QueueQuery, staffId: string): Promise<ArticleRow[]>;
    countByStatus(): Promise<Partial<Record<Status, number>>>;
    /**
     * Insert the article, its audit event and its notifications atomically.
     * With `idempotency`, the key hash is recorded in the same transaction;
     * if the key was already used nothing is written and
     * DuplicateSubmissionError is thrown.
     */
    createSubmission(
        row: Partial<ArticleRow>,
        event: Omit<NewEvent, 'article_id'>,
        notifications: NewNotification[],
        idempotency?: { keyHash: string; requestHash: string },
    ): Promise<ArticleRow>;
    findIdempotency(keyHash: string): Promise<IdempotencyRecord | null>;
    /**
     * Count one hit for (bucket, keyHash) in the current fixed window and say
     * whether it is within `max` (consume_rate_limit, migration 0005).
     * `keyHash` must be a 64-char lowercase hex digest.
     */
    consumeRateLimit(bucket: string, keyHash: string, windowSeconds: number, max: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
    /**
     * Atomically: check (status, version), set status (if given) + patch, bump
     * version, append the audit event and queue notifications. Throws
     * ConflictError when the expected status/version no longer match.
     */
    applyChange(args: {
        id: string;
        expectedStatus: Status;
        expectedVersion: number;
        newStatus: Status | null;
        patch: ArticlePatch;
        event: Omit<NewEvent, 'article_id'>;
        notifications: NewNotification[];
    }): Promise<ArticleRow>;
    insertEvent(event: NewEvent): Promise<void>;
    listEvents(articleId: string): Promise<EventRow[]>;
    listRecentEvents(limit: number): Promise<EventRow[]>;

    findStaffByUid(uid: string): Promise<StaffMember | null>;
    findStaffByEmail(email: string): Promise<StaffMember | null>;
    /**
     * Atomically claim an unlinked staff record for `uid` (only while
     * firebase_uid IS NULL). Returns true only if this call linked the row;
     * false if it was already linked or the uid is already used elsewhere.
     */
    linkStaffUid(staffId: string, uid: string): Promise<boolean>;
    listStaff(): Promise<StaffMember[]>;
    /** Throws LastAdminError when the change would leave no active admin. */
    upsertStaff(member: Omit<StaffMember, 'id' | 'firebase_uid'> & { id?: string }): Promise<StaffMember>;
}

/**
 * Object storage. `put` and `copy` never overwrite: both fail if the
 * destination already exists. Callers always write to a fresh, unique path, so
 * an object referenced by a committed row is never replaced underneath it.
 * `remove` is idempotent (removing a missing object succeeds).
 */
export interface FileStore {
    put(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
    copy(fromBucket: string, fromPath: string, toBucket: string, toPath: string): Promise<void>;
    remove(bucket: string, path: string): Promise<void>;
    signedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string | null>;
    publicUrl(bucket: string, path: string): string;
}

export interface Upload {
    name: string;
    type: string;
    bytes: Uint8Array;
}

export interface Deps {
    repo: Repo;
    files: FileStore;
    now: () => Date;
    randomBytes: (n: number) => Uint8Array;
    sha256Hex: (input: string) => Promise<string>;
    /**
     * HMAC-SHA256 (hex) keyed with a server-side secret for `purpose`:
     * 'rate-limit' keys rate-limit counters (RATE_LIMIT_SALT), 'access-key'
     * derives a contributor access key from an idempotency key
     * (ACCESS_KEY_SECRET). Both fall back to a key derived from the service
     * role key when unset.
     */
    hmacHex: (purpose: 'rate-limit' | 'access-key', message: string) => Promise<string>;
    /** Delay between storage clean-up retries. Optional; without it retries are immediate. */
    sleep?: (ms: number) => Promise<void>;
    /** Public site origin, used in contributor emails. */
    siteUrl: string;
}

export interface StaffIdentity {
    uid: string;
    email: string | null;
    /**
     * Firebase's `email_verified` claim. Required before an email address may
     * be used to link this uid to a pre-provisioned staff record.
     */
    emailVerified: boolean;
}
