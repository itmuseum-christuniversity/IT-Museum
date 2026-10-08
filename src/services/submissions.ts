import { callJson, callMultipart } from '../lib/api';
import type { SubmissionInput } from '../../supabase/functions/_shared/validation.ts';
import type { Status } from '../../supabase/functions/_shared/workflow.ts';

export interface SubmitResult {
    id: string;
    reference: string;
    /** Null when the server recognised a retry of an earlier attempt and could not re-derive the key. */
    accessKey: string | null;
    /** True when this attempt had already been received (the retry created nothing new). */
    duplicate?: boolean;
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

/**
 * `idempotencyKey` identifies one form attempt: send the same value on every
 * retry so a submission whose response was lost is not created twice.
 */
export function submitArticle(input: SubmissionInput, files: { similarity: File; ai: File }, idempotencyKey: string, onProgress?: (f: number) => void) {
    const form = new FormData();
    form.set('action', 'submit');
    form.set('idempotencyKey', idempotencyKey);
    form.set('payload', JSON.stringify(input));
    form.set('similarityReport', files.similarity);
    form.set('aiReport', files.ai);
    return callMultipart<SubmitResult>('public-api', form, { onProgress });
}

export function lookupStatus(reference: string, accessKey: string) {
    return callJson<ContributorView>('public-api', { action: 'status', reference, accessKey });
}

export function resubmitRevision(
    reference: string,
    accessKey: string,
    input: { note: string; manuscriptUrl?: string; similarity?: File | null; ai?: File | null },
    onProgress?: (f: number) => void,
) {
    const form = new FormData();
    form.set('action', 'resubmit');
    form.set('reference', reference);
    form.set('accessKey', accessKey);
    form.set('note', input.note);
    if (input.manuscriptUrl) form.set('manuscriptUrl', input.manuscriptUrl);
    if (input.similarity) form.set('similarityReport', input.similarity);
    if (input.ai) form.set('aiReport', input.ai);
    return callMultipart<ContributorView>('public-api', form, { onProgress });
}
