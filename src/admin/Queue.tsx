import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { queuesForRole, STATUS_LABEL, visibleStatusesForRole, type Status } from '../../supabase/functions/_shared/workflow.ts';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { ageLabel, daysSince, formatDate } from '../lib/format';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from './StatusBadge';
import { useStaff } from './auth';

/** `new Date(garbage).toISOString()` throws a RangeError, so URL-supplied dates are checked first. */
function isoOrUndefined(value: string): string | undefined {
    if (!value) return undefined;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

const ASSIGNEE_RE = /^(me|unassigned|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export default function Queue() {
    const { api, me } = useStaff();
    usePageMeta(me.role === 'admin' ? 'Inbox — review portal' : 'My queue — review portal');
    const [params, setParams] = useSearchParams();
    const visible = visibleStatusesForRole(me.role);
    const status = (visible.includes(params.get('status') as Status) ? params.get('status') : '') as Status | '';
    const rawAssignee = params.get('assignee') ?? '';
    const assignee = ASSIGNEE_RE.test(rawAssignee) ? rawAssignee : '';
    const age = params.get('age') ?? '';
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    const [search, setSearch] = useState(params.get('q') ?? '');
    const [debounced, setDebounced] = useState(search);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const set = (k: string, v: string) => {
        const next = new URLSearchParams(params);
        if (v) next.set(k, v);
        else next.delete(k);
        setParams(next, { replace: true });
    };

    const staff = useAsync(() => api.staffList(), [api]);
    // URL params are user-editable: ignore anything that is not a valid date / non-negative number.
    const fromIso = isoOrUndefined(from);
    const toIsoValue = isoOrUndefined(to ? `${to}T23:59:59` : '');
    const minAge = age !== '' && Number.isFinite(Number(age)) && Number(age) >= 0 ? Number(age) : undefined;
    const state = useAsync(
        () =>
            api.queue({
                statuses: status ? [status] : queuesForRole(me.role),
                search: debounced || undefined,
                assignee: assignee || undefined,
                minAgeDays: minAge,
                submittedFrom: fromIso,
                submittedTo: toIsoValue,
            }),
        [api, status, debounced, assignee, age, from, to],
    );
    const names = new Map((staff.status === 'ready' ? staff.data : []).map((s) => [s.id, s.display_name]));

    return (
        <div className="admin-page">
            <header className="admin-page__head">
                <div>
                    <h1>{me.role === 'admin' ? 'Inbox' : 'My queue'}</h1>
                    <p className="muted">Oldest first. Default view shows the stages you decide: {queuesForRole(me.role).map((s) => STATUS_LABEL[s]).join(' and ')}.</p>
                </div>
            </header>

            <form className="queue-filters" role="search" onSubmit={(e) => e.preventDefault()}>
                <div className="field">
                    <label className="field__label" htmlFor="q-search">
                        Search
                    </label>
                    <div className="input-icon">
                        <Search size={18} aria-hidden="true" />
                        <input id="q-search" className="input input--search" type="search" placeholder="Title, author or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="q-status">
                        Stage
                    </label>
                    <select id="q-status" className="select" value={status} onChange={(e) => set('status', e.target.value)}>
                        <option value="">My stages</option>
                        {visible.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="q-assignee">
                        Assignee
                    </label>
                    <select id="q-assignee" className="select" value={assignee} onChange={(e) => set('assignee', e.target.value)}>
                        <option value="">Anyone</option>
                        <option value="me">Assigned to me</option>
                        <option value="unassigned">Unassigned</option>
                        {staff.status === 'ready' &&
                            staff.data
                                .filter((s) => s.id !== me.id)
                                .map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.display_name}
                                    </option>
                                ))}
                    </select>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="q-age">
                        Waiting at least
                    </label>
                    <select id="q-age" className="select" value={age} onChange={(e) => set('age', e.target.value)}>
                        <option value="">Any time</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                    </select>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="q-from">
                        Submitted from
                    </label>
                    <input id="q-from" className="input" type="date" value={from} onChange={(e) => set('from', e.target.value)} />
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="q-to">
                        Submitted to
                    </label>
                    <input id="q-to" className="input" type="date" value={to} onChange={(e) => set('to', e.target.value)} />
                </div>
            </form>

            {state.status === 'loading' && (
                <div className="stack" aria-busy="true">
                    <Skeleton height="3rem" />
                    <Skeleton height="3rem" />
                    <Skeleton height="3rem" />
                </div>
            )}
            {state.status === 'error' && <ErrorState message={state.error.message} onRetry={state.retry} />}
            {state.status === 'ready' && (
                <>
                    <p className="muted" role="status" aria-live="polite">
                        {state.data.length} {state.data.length === 1 ? 'article' : 'articles'}
                    </p>
                    {state.data.length === 0 ? (
                        <EmptyState title="Nothing here" headingLevel={2}>
                            <p>No articles match these filters.</p>
                        </EmptyState>
                    ) : (
                        <div className="table-wrap">
                            <table className="table">
                                <caption className="visually-hidden">Articles in the selected queue</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Article</th>
                                        <th scope="col">Stage</th>
                                        <th scope="col">Waiting</th>
                                        <th scope="col">Submitted</th>
                                        <th scope="col">Assignee</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {state.data.map((a) => (
                                        <tr key={a.id}>
                                            <td>
                                                <Link to={`/admin/articles/${a.id}`}>{a.title}</Link>
                                                <div className="subtle">
                                                    {a.author_name} · <code>{a.reference_code}</code>
                                                </div>
                                            </td>
                                            <td>
                                                <StatusBadge status={a.status} />
                                            </td>
                                            <td className={daysSince(a.stage_entered_at) > 7 ? 'text-warning' : ''}>{ageLabel(a.stage_entered_at)}</td>
                                            <td>{formatDate(a.created_at, 'short')}</td>
                                            <td>{a.assignee_id ? (names.get(a.assignee_id) ?? 'Assigned') : <span className="subtle">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
