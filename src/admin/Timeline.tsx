import { ACTION_LABEL, STATUS_LABEL } from '../../supabase/functions/_shared/workflow.ts';
import { formatDateTime } from '../lib/format';
import type { TimelineEvent } from './api';

export function describeEvent(e: TimelineEvent): string {
    switch (e.event_type) {
        case 'submitted':
            return 'Submitted by the contributor';
        case 'legacy_import':
            return `Imported from the previous system (was ${String(e.metadata?.legacy_status ?? 'unknown')}, now ${e.to_status ? STATUS_LABEL[e.to_status] : '—'})`;
        case 'note':
            return 'Internal note';
        case 'assignment':
            return e.metadata?.assignee ? `Assigned to ${String(e.metadata.assignee)}` : 'Assignment cleared';
        case 'file':
            return 'Final PDF uploaded';
        case 'metadata':
            return e.metadata?.suggested_tags ? 'Tags suggested' : 'Publication metadata edited';
        case 'transition':
            if (e.action === 'advance') return `Approved → ${e.to_status ? STATUS_LABEL[e.to_status] : ''}`;
            return `${e.action ? ACTION_LABEL[e.action] : 'Status change'}${e.from_status ? ` at ${STATUS_LABEL[e.from_status]}` : ''}`;
        default:
            return e.event_type;
    }
}

function kind(e: TimelineEvent) {
    if (e.event_type === 'note') return 'note';
    if (e.action === 'reject' || e.action === 'unpublish') return 'danger';
    if (e.action === 'request_changes') return 'warning';
    if (e.action === 'publish') return 'success';
    return undefined;
}

/** Immutable activity log (append-only in the database). */
export function Timeline({ events }: { events: TimelineEvent[] }) {
    if (!events.length) return <p className="muted">No activity recorded.</p>;
    return (
        <ol className="timeline">
            {events.map((e) => (
                <li key={e.id} data-kind={kind(e)}>
                    <strong>{describeEvent(e)}</strong>
                    <div className="subtle">
                        {e.actor_label ?? e.actor_role} · {formatDateTime(e.created_at)}
                        {e.visibility === 'contributor' && e.event_type === 'transition' && ' · shared with contributor'}
                    </div>
                    {e.reason && <p className="timeline__reason preserve-lines">{e.reason}</p>}
                    {e.event_type === 'metadata' && Array.isArray(e.metadata?.suggested_tags) && (
                        <p className="subtle">{(e.metadata.suggested_tags as string[]).join(', ')}</p>
                    )}
                </li>
            ))}
        </ol>
    );
}
