import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { STATUS_LABEL, type Status } from '../../supabase/functions/_shared/workflow.ts';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { ageLabel, daysSince, formatDateTime } from '../lib/format';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from './StatusBadge';
import { useStaff } from './auth';
import { describeEvent } from './Timeline';

const PIPELINE: Status[] = ['SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED'];

export default function Overview() {
    usePageMeta('Overview — review portal');
    const { api, me } = useStaff();
    const state = useAsync(() => api.overview(), [api]);

    return (
        <div className="admin-page">
            <header className="admin-page__head">
                <div>
                    <h1>Overview</h1>
                    <p className="muted">Welcome, {me.display_name}. {me.role === 'admin' ? 'Intake and final approval are yours to decide.' : 'Articles waiting in your review stage are listed below.'}</p>
                </div>
                <Link to="/admin/queue" className="btn btn--primary">
                    Open {me.role === 'admin' ? 'inbox' : 'my queue'}
                </Link>
            </header>

            {state.status === 'loading' && (
                <div className="stat-grid" aria-busy="true">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} height="6rem" />
                    ))}
                </div>
            )}
            {state.status === 'error' && <ErrorState message={state.error.message} onRetry={state.retry} />}
            {state.status === 'ready' && (
                <>
                    <section aria-labelledby="counts-title">
                        <h2 id="counts-title" className="visually-hidden">
                            Queue counts
                        </h2>
                        <ul className="stat-grid">
                            {PIPELINE.filter((s) => s in state.data.counts).map((s) => {
                                const mine = state.data.queues.includes(s);
                                return (
                                    <li key={s} className={`stat ${mine ? 'stat--mine' : ''}`}>
                                        <Link to={`/admin/queue?status=${s}`}>
                                            <span className="stat__value">{state.data.counts[s] ?? 0}</span>
                                            <span className="stat__label">{STATUS_LABEL[s]}</span>
                                            {mine && <span className="stat__hint">Your queue</span>}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    <div className="admin-columns">
                        <section aria-labelledby="attention-title" className="card">
                            <h2 id="attention-title" className="h3">
                                Needs attention
                            </h2>
                            <p className="subtle">Waiting more than 7 days in your stage, or assigned to you.</p>
                            {state.data.needsAttention.length === 0 ? (
                                <EmptyState title="Nothing overdue" headingLevel={3}>
                                    <p>Your queue is up to date.</p>
                                </EmptyState>
                            ) : (
                                <ul className="attention-list">
                                    {state.data.needsAttention.map((a) => (
                                        <li key={a.id}>
                                            <Link to={`/admin/articles/${a.id}`}>{a.title}</Link>
                                            <span className="cluster subtle">
                                                <StatusBadge status={a.status} />
                                                {daysSince(a.stage_entered_at) > 7 && (
                                                    <span className="cluster" style={{ ['--cluster-gap' as string]: '0.25rem', color: 'var(--warning-fg)' }}>
                                                        <AlertTriangle size={14} aria-hidden="true" /> waiting {ageLabel(a.stage_entered_at)}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        {me.role === 'admin' && (
                            <section aria-labelledby="recent-title" className="card">
                                <h2 id="recent-title" className="h3">
                                    Recent activity
                                </h2>
                                {state.data.recent.length === 0 ? (
                                    <p className="muted">No activity yet.</p>
                                ) : (
                                    <ul className="activity-list">
                                        {state.data.recent.map((e) => (
                                            <li key={e.id}>
                                                <Link to={`/admin/articles/${e.article_id}`}>{describeEvent(e)}</Link>
                                                <span className="subtle">
                                                    {e.actor_label ?? e.actor_role} · {formatDateTime(e.created_at)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
