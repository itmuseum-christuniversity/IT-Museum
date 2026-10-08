import { callJson, callMultipart } from '../lib/api';
import type { ArticleSummary } from '../../supabase/functions/_shared/service.ts';
import type { ArticleRow, StaffMember } from '../../supabase/functions/_shared/types.ts';
import type { ChecklistItem, StaffRole, Status, WorkflowAction } from '../../supabase/functions/_shared/workflow.ts';

export type { ArticleSummary };

export interface Me {
    id: string;
    email: string;
    display_name: string;
    role: StaffRole;
}

export interface TimelineEvent {
    id: number;
    article_id: string;
    created_at: string;
    event_type: string;
    action: WorkflowAction | null;
    from_status: Status | null;
    to_status: Status | null;
    actor_role: string;
    actor_label: string | null;
    reason: string | null;
    visibility: 'internal' | 'contributor';
    metadata: Record<string, unknown>;
}

export interface ArticleDetail {
    article: Omit<ArticleRow, 'contributor_token_hash'>;
    files: { similarityUrl: string | null; aiUrl: string | null; stagedPdfUrl: string | null; publishedPdfUrl: string | null };
    events: TimelineEvent[];
    checklist: ChecklistItem[];
    /** Admin only: storage clean-ups that failed and can be retried with `retryStorageCleanup`. */
    pendingStorageCleanup?: StorageCleanupTarget[];
}

export interface StorageCleanupTarget {
    bucket: string;
    path: string;
    purpose: string;
}

export interface Overview {
    role: StaffRole;
    queues: Status[];
    counts: Partial<Record<Status, number>>;
    needsAttention: ArticleSummary[];
    recent: TimelineEvent[];
}

export interface QueueQuery {
    statuses?: Status[];
    search?: string;
    assignee?: string;
    minAgeDays?: number;
    submittedFrom?: string;
    submittedTo?: string;
}

export type StaffListItem = Partial<StaffMember> & { id: string; display_name: string; role: StaffRole; linked?: boolean };

export type TokenGetter = () => Promise<string>;

export function staffApi(getToken: TokenGetter) {
    const call = async <T>(body: Record<string, unknown>) => callJson<T>('staff-api', body, await getToken());
    return {
        me: () => call<Me>({ action: 'me' }),
        overview: () => call<Overview>({ action: 'overview' }),
        queue: (query: QueueQuery) => call<ArticleSummary[]>({ action: 'queue', query }),
        article: (id: string) => call<ArticleDetail>({ action: 'article', id }),
        transition: (id: string, workflowAction: WorkflowAction, expectedVersion: number, reason?: string) =>
            call<ArticleSummary>({ action: 'transition', id, workflowAction, expectedVersion, reason }),
        note: (id: string, body: string) => call<{ ok: true }>({ action: 'note', id, body }),
        assign: (id: string, assigneeId: string | null, expectedVersion: number) => call<ArticleSummary>({ action: 'assign', id, assigneeId, expectedVersion }),
        suggestTags: (id: string, tags: string[], expectedVersion: number) => call<ArticleSummary>({ action: 'suggest-tags', id, tags, expectedVersion }),
        updateMetadata: (id: string, expectedVersion: number, fields: { title?: string; description?: string; tags?: string[]; author_name?: string }) =>
            call<ArticleSummary>({ action: 'update-metadata', id, expectedVersion, fields }),
        stageFinalPdf: async (id: string, expectedVersion: number, file: File, onProgress?: (f: number) => void) => {
            const form = new FormData();
            form.set('action', 'stage-final-pdf');
            form.set('id', id);
            form.set('expectedVersion', String(expectedVersion));
            form.set('file', file);
            return callMultipart<ArticleSummary>('staff-api', form, { token: await getToken(), onProgress });
        },
        retryStorageCleanup: (id: string) =>
            call<Record<'removed' | 'skipped' | 'failed', StorageCleanupTarget[]>>({ action: 'retry-storage-cleanup', id }),
        staffList: () => call<StaffListItem[]>({ action: 'staff-list' }),
        staffUpsert: (member: { id?: string; email: string; display_name: string; role: StaffRole; active: boolean }) => call<StaffMember>({ action: 'staff-upsert', member }),
    };
}

export type StaffApi = ReturnType<typeof staffApi>;
