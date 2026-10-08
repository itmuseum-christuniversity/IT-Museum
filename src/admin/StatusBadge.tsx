import { STATUS_LABEL, type Status } from '../../supabase/functions/_shared/workflow.ts';

const TONE: Record<Status, string> = {
    SUBMITTED: 'badge--blue',
    IT_REVIEW: 'badge--blue',
    TECH_REVIEW: 'badge--blue',
    LIT_REVIEW: 'badge--blue',
    FINAL_APPROVAL: 'badge--gold',
    CHANGES_REQUESTED: 'badge--warning',
    REJECTED: 'badge--danger',
    PUBLISHED: 'badge--success',
    UNPUBLISHED: '',
};

export function StatusBadge({ status }: { status: Status }) {
    return <span className={`badge ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}
