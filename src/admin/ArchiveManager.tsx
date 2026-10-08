import { useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL, type Status } from '../../supabase/functions/_shared/workflow.ts';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { formatDate } from '../lib/format';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from './StatusBadge';
import { useStaff } from './auth';

const TABS: { status: Status; help: string }[] = [
    { status: 'PUBLISHED', help: 'Live in the public archive. Open an article to unpublish it with a reason.' },
    { status: 'UNPUBLISHED', help: 'Hidden from the public. Open an article to republish it.' },
    { status: 'REJECTED', help: 'Rejected submissions. Open one to reopen it with a reason.' },
    { status: 'CHANGES_REQUESTED', help: 'Waiting for contributors to send a revision.' },
];

export default function ArchiveManager() {
    usePageMeta('Archive management — review portal');
    const { api } = useStaff();
    const [tab, setTab] = useState<Status>('PUBLISHED');
    const state = useAsync(() => api.queue({ statuses: [tab] }), [api, tab]);
    const current = TABS.find((t) => t.status === tab)!;

    return (
        <div className="admin-page">
            <header className="admin-page__head">
                <div>
                    <h1>Archive management</h1>
                    <p className="muted">Published, unpublished and closed records. Every change is recorded in the article’s activity log.</p>
                </div>
            </header>
            <div className="segmented" role="tablist" aria-label="Record status">
                {TABS.map((t) => (
                    <button key={t.status} type="button" role="tab" aria-selected={tab === t.status} className="segmented__item" onClick={() => setTab(t.status)}>
                        {STATUS_LABEL[t.status]}
                    </button>
                ))}
            </div>
            <div role="tabpanel" aria-label={STATUS_LABEL[tab]}>
                <p className="muted">{current.help}</p>
                {state.status === 'loading' && <Skeleton height="10rem" />}
                {state.status === 'error' && <ErrorState message={state.error.message} onRetry={state.retry} />}
                {state.status === 'ready' &&
                    (state.data.length === 0 ? (
                        <EmptyState title={`No ${STATUS_LABEL[tab].toLowerCase()} articles`} />
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">{STATUS_LABEL[tab]} articles</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Article</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">{tab === 'PUBLISHED' ? 'Published' : 'Submitted'}</th>
                                        <th scope="col">Public page</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {state.data.map((a) => (
                                        <tr key={a.id}>
                                            <td>
                                                <Link to={`/admin/articles/${a.id}`}>{a.title}</Link>
                                                <div className="subtle">
                                                    {a.author_name} · <code>{a.reference_code}</code>
                                                    {a.legacy_status && ` · imported (${a.legacy_status})`}
                                                </div>
                                            </td>
                                            <td>
                                                <StatusBadge status={a.status} />
                                            </td>
                                            <td>{formatDate(tab === 'PUBLISHED' ? (a.published_at ?? a.created_at) : a.created_at, 'short')}</td>
                                            <td>{a.status === 'PUBLISHED' ? <Link to={`/article/${a.id}`}>View</Link> : <span className="subtle">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
            </div>
        </div>
    );
}
