/**
 * Canonical publication workflow for the IT Museum.
 *
 * This module is pure TypeScript with no runtime imports so it can be shared by
 * the Supabase Edge Functions (Deno), the React admin UI and the Vitest suite.
 * The server is the only place that *applies* a transition; the UI uses the same
 * rules purely to decide which controls to show.
 *
 * Status names describe the queue an article is currently waiting in, not the
 * last person who approved it.
 */

export const STATUSES = [
    'SUBMITTED',
    'IT_REVIEW',
    'TECH_REVIEW',
    'LIT_REVIEW',
    'FINAL_APPROVAL',
    'CHANGES_REQUESTED',
    'REJECTED',
    'PUBLISHED',
    'UNPUBLISHED',
] as const;
export type Status = (typeof STATUSES)[number];

/** Stages in which a staff member reviews and decides. Order matters. */
export const REVIEW_STAGES = ['SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL'] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export const STAFF_ROLES = ['admin', 'it_reviewer', 'tech_reviewer', 'lit_reviewer'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ACTIONS = [
    'advance',
    'request_changes',
    'reject',
    'publish',
    'unpublish',
    'reopen',
    'resubmit',
] as const;
export type WorkflowAction = (typeof ACTIONS)[number];

export type Actor =
    | { kind: 'staff'; id: string; role: StaffRole }
    | { kind: 'contributor'; id: string };

/** Which role owns (works) each review queue. */
export const STAGE_OWNER: Record<ReviewStage, StaffRole> = {
    SUBMITTED: 'admin',
    IT_REVIEW: 'it_reviewer',
    TECH_REVIEW: 'tech_reviewer',
    LIT_REVIEW: 'lit_reviewer',
    FINAL_APPROVAL: 'admin',
};

/** Where "advance" sends an article. FINAL_APPROVAL is left with `publish`. */
export const NEXT_STAGE: Partial<Record<ReviewStage, ReviewStage>> = {
    SUBMITTED: 'IT_REVIEW',
    IT_REVIEW: 'TECH_REVIEW',
    TECH_REVIEW: 'LIT_REVIEW',
    LIT_REVIEW: 'FINAL_APPROVAL',
};

export const STATUS_LABEL: Record<Status, string> = {
    SUBMITTED: 'Admin intake',
    IT_REVIEW: 'IT review',
    TECH_REVIEW: 'Technical review',
    LIT_REVIEW: 'Literature review',
    FINAL_APPROVAL: 'Final approval',
    CHANGES_REQUESTED: 'Changes requested',
    REJECTED: 'Rejected',
    PUBLISHED: 'Published',
    UNPUBLISHED: 'Unpublished',
};

export const ROLE_LABEL: Record<StaffRole, string> = {
    admin: 'Admin',
    it_reviewer: 'IT reviewer',
    tech_reviewer: 'Technical reviewer',
    lit_reviewer: 'Literature reviewer',
};

export const ACTION_LABEL: Record<WorkflowAction, string> = {
    advance: 'Approve and advance',
    request_changes: 'Request changes',
    reject: 'Reject',
    publish: 'Publish',
    unpublish: 'Unpublish',
    reopen: 'Reopen',
    resubmit: 'Resubmit revision',
};

/** Actions that must carry a written reason. */
export const REASON_REQUIRED: ReadonlySet<WorkflowAction> = new Set<WorkflowAction>([
    'request_changes',
    'reject',
    'unpublish',
    'reopen',
]);

export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 2000;

/**
 * Legacy status values written by the previous admin screens, mapped to the new
 * enum. Rejections are mapped in SQL (see the workflow migration) because the
 * old code reused rejection codes across stages; see README "Legacy statuses".
 */
export const LEGACY_STATUS_MAP: Record<string, Status> = {
    SUBMITTED: 'SUBMITTED',
    ADMIN_APPROVED: 'IT_REVIEW',
    IT_APPROVED: 'TECH_REVIEW',
    TECH_APPROVED: 'LIT_REVIEW',
    LIT_APPROVED: 'FINAL_APPROVAL',
    PUBLISHED: 'PUBLISHED',
    ADMIN_REJECTED: 'REJECTED',
    IT_REJECTED: 'REJECTED',
    TECH_REJECTED: 'REJECTED',
    LIT_REJECTED: 'REJECTED',
};

export function isStatus(value: unknown): value is Status {
    return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}
export function isReviewStage(value: unknown): value is ReviewStage {
    return typeof value === 'string' && (REVIEW_STAGES as readonly string[]).includes(value);
}
export function isStaffRole(value: unknown): value is StaffRole {
    return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}
export function isAction(value: unknown): value is WorkflowAction {
    return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

/** The statuses whose queue a role works. Admin also manages the archive. */
export function queuesForRole(role: StaffRole): Status[] {
    if (role === 'admin') return ['SUBMITTED', 'FINAL_APPROVAL'];
    return REVIEW_STAGES.filter((s) => STAGE_OWNER[s] === role);
}

/** Statuses a role may open in the workspace (read access). */
export function visibleStatusesForRole(role: StaffRole): Status[] {
    if (role === 'admin') return [...STATUSES];
    return queuesForRole(role);
}

/** Minimal shape the rules need. The DB row has more columns. */
export interface WorkflowArticle {
    status: Status;
    return_to_stage: ReviewStage | null;
    rejected_at_stage: ReviewStage | null;
    title: string;
    description: string;
    author_name: string;
    tags: string[] | null;
    published_pdf_path: string | null;
    staged_pdf_path: string | null;
}

export interface ChecklistItem {
    id: string;
    label: string;
    ok: boolean;
}

/** Everything the admin must confirm before an article can go live. */
export function publicationChecklist(a: WorkflowArticle): ChecklistItem[] {
    return [
        { id: 'title', label: 'Title is present', ok: a.title.trim().length >= 5 },
        { id: 'authors', label: 'Author credit is present', ok: a.author_name.trim().length > 0 },
        { id: 'abstract', label: 'Abstract/description is present', ok: a.description.trim().length >= 30 },
        { id: 'tags', label: 'At least one archive tag', ok: (a.tags ?? []).length > 0 },
        {
            id: 'pdf',
            label: 'Final PDF uploaded',
            ok: Boolean(a.staged_pdf_path || a.published_pdf_path),
        },
    ];
}

export type ContributorTemplate =
    | 'submission_received'
    | 'changes_requested'
    | 'rejected'
    | 'published'
    | 'unpublished'
    | 'revision_received';

export interface TransitionPlan {
    ok: true;
    from: Status;
    to: Status;
    /** Columns to set besides status (applied atomically with the status change). */
    patch: {
        return_to_stage?: ReviewStage | null;
        rejected_at_stage?: ReviewStage | null;
        public_reason?: string | null;
        published_at?: 'now' | null;
        unpublished_at?: 'now' | null;
    };
    /** Whether the reason is shown to the contributor (vs. internal-only). */
    reasonVisibleToContributor: boolean;
    notify: ContributorTemplate | null;
}

export interface TransitionDenied {
    ok: false;
    code: 'FORBIDDEN' | 'INVALID_STATE' | 'REASON_REQUIRED' | 'REASON_TOO_LONG' | 'CHECKLIST_INCOMPLETE' | 'UNKNOWN_ACTION';
    message: string;
}

export type TransitionResult = TransitionPlan | TransitionDenied;

function deny(code: TransitionDenied['code'], message: string): TransitionDenied {
    return { ok: false, code, message };
}

/**
 * Decide whether `actor` may perform `action` on `article`, and if so what the
 * resulting state is. Pure: no I/O. The server applies the plan with a
 * compare-and-swap on (status, version) so concurrent decisions cannot both win.
 */
export function planTransition(
    article: WorkflowArticle,
    action: WorkflowAction,
    actor: Actor,
    reason?: string | null,
): TransitionResult {
    if (!isAction(action)) return deny('UNKNOWN_ACTION', `Unknown action "${String(action)}".`);
    const from = article.status;
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (trimmed.length > MAX_REASON_LENGTH) {
        return deny('REASON_TOO_LONG', `Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`);
    }

    if (REASON_REQUIRED.has(action) && trimmed.length < MIN_REASON_LENGTH) {
        return deny('REASON_REQUIRED', `A reason of at least ${MIN_REASON_LENGTH} characters is required.`);
    }

    // Contributors can only resubmit their own revision.
    if (actor.kind === 'contributor') {
        if (action !== 'resubmit') return deny('FORBIDDEN', 'Contributors can only resubmit a requested revision.');
        if (from !== 'CHANGES_REQUESTED') return deny('INVALID_STATE', 'This submission is not waiting for a revision.');
        const target = article.return_to_stage ?? 'SUBMITTED';
        return {
            ok: true,
            from,
            to: target,
            patch: { return_to_stage: null, public_reason: null },
            reasonVisibleToContributor: false,
            notify: 'revision_received',
        };
    }

    const role = actor.role;

    switch (action) {
        case 'advance': {
            if (!isReviewStage(from) || !NEXT_STAGE[from]) {
                return deny('INVALID_STATE', `Articles in "${STATUS_LABEL[from]}" cannot be advanced.`);
            }
            if (STAGE_OWNER[from] !== role) {
                return deny('FORBIDDEN', `Only the ${ROLE_LABEL[STAGE_OWNER[from]]} can decide at ${STATUS_LABEL[from]}.`);
            }
            return {
                ok: true,
                from,
                to: NEXT_STAGE[from]!,
                patch: {},
                reasonVisibleToContributor: false,
                notify: null,
            };
        }
        case 'request_changes':
        case 'reject': {
            if (!isReviewStage(from)) {
                return deny('INVALID_STATE', `Articles in "${STATUS_LABEL[from]}" are not under review.`);
            }
            if (STAGE_OWNER[from] !== role) {
                return deny('FORBIDDEN', `Only the ${ROLE_LABEL[STAGE_OWNER[from]]} can decide at ${STATUS_LABEL[from]}.`);
            }
            if (action === 'request_changes') {
                return {
                    ok: true,
                    from,
                    to: 'CHANGES_REQUESTED',
                    patch: { return_to_stage: from, public_reason: trimmed },
                    reasonVisibleToContributor: true,
                    notify: 'changes_requested',
                };
            }
            return {
                ok: true,
                from,
                to: 'REJECTED',
                patch: { rejected_at_stage: from, return_to_stage: null, public_reason: trimmed },
                reasonVisibleToContributor: true,
                notify: 'rejected',
            };
        }
        case 'publish': {
            if (role !== 'admin') return deny('FORBIDDEN', 'Only an admin can publish.');
            if (from !== 'FINAL_APPROVAL' && from !== 'UNPUBLISHED') {
                return deny('INVALID_STATE', 'Only articles in final approval (or previously unpublished) can be published.');
            }
            const missing = publicationChecklist(article).filter((c) => !c.ok);
            if (missing.length) {
                return deny('CHECKLIST_INCOMPLETE', `Complete the publication checklist: ${missing.map((m) => m.label).join('; ')}.`);
            }
            return {
                ok: true,
                from,
                to: 'PUBLISHED',
                patch: { published_at: 'now', unpublished_at: null, public_reason: null },
                reasonVisibleToContributor: false,
                notify: from === 'FINAL_APPROVAL' ? 'published' : null,
            };
        }
        case 'unpublish': {
            if (role !== 'admin') return deny('FORBIDDEN', 'Only an admin can unpublish.');
            if (from !== 'PUBLISHED') return deny('INVALID_STATE', 'Only published articles can be unpublished.');
            return {
                ok: true,
                from,
                to: 'UNPUBLISHED',
                patch: { unpublished_at: 'now' },
                reasonVisibleToContributor: false,
                notify: 'unpublished',
            };
        }
        case 'reopen': {
            if (role !== 'admin') return deny('FORBIDDEN', 'Only an admin can reopen a rejected article.');
            if (from !== 'REJECTED') return deny('INVALID_STATE', 'Only rejected articles can be reopened.');
            return {
                ok: true,
                from,
                to: article.rejected_at_stage ?? 'SUBMITTED',
                patch: { public_reason: null },
                reasonVisibleToContributor: false,
                notify: null,
            };
        }
        case 'resubmit':
            return deny('FORBIDDEN', 'Only the contributor can resubmit a revision.');
    }
    return deny('UNKNOWN_ACTION', 'Unknown action.');
}

/** Actions to offer in the UI for a role at a status (before reason/checklist checks). */
export function availableActions(status: Status, role: StaffRole): WorkflowAction[] {
    const probe: WorkflowArticle = {
        status,
        return_to_stage: null,
        rejected_at_stage: null,
        title: 'xxxxx',
        description: 'x'.repeat(40),
        author_name: 'x',
        tags: ['x'],
        published_pdf_path: 'x',
        staged_pdf_path: 'x',
    };
    const actor: Actor = { kind: 'staff', id: 'probe', role };
    return ACTIONS.filter((a) => planTransition(probe, a, actor, 'x'.repeat(MIN_REASON_LENGTH)).ok);
}

/** What a contributor may see about their submission. Never exposes internal notes. */
export function contributorStatus(status: Status): { label: string; description: string } {
    switch (status) {
        case 'SUBMITTED':
            return { label: 'Received', description: 'Your submission has been received and is awaiting intake checks.' };
        case 'IT_REVIEW':
        case 'TECH_REVIEW':
        case 'LIT_REVIEW':
            return {
                label: 'In review',
                description: `Your article is with the ${STATUS_LABEL[status].toLowerCase()} panel (stage ${REVIEW_STAGES.indexOf(status) + 1} of ${REVIEW_STAGES.length}).`,
            };
        case 'FINAL_APPROVAL':
            return { label: 'Final approval', description: 'Reviews are complete; the editorial admin is preparing a final decision.' };
        case 'CHANGES_REQUESTED':
            return { label: 'Changes requested', description: 'The review panel has asked for a revision. See the note below and resubmit when ready.' };
        case 'REJECTED':
            return { label: 'Not accepted', description: 'The review panel has decided not to accept this submission.' };
        case 'PUBLISHED':
            return { label: 'Published', description: 'Your article is live in the IT Museum archive.' };
        case 'UNPUBLISHED':
            return { label: 'Withdrawn from archive', description: 'This article is currently not shown in the public archive.' };
    }
}
