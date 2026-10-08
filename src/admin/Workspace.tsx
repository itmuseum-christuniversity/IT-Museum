import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import {
    ACTION_LABEL,
    availableActions,
    MAX_REASON_LENGTH,
    MIN_REASON_LENGTH,
    REASON_REQUIRED,
    ROLE_LABEL,
    STAGE_OWNER,
    STATUS_LABEL,
    isReviewStage,
    type Status,
    type WorkflowAction,
} from '../../supabase/functions/_shared/workflow.ts';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { ApiError } from '../lib/api';
import { ageLabel, formatDate, mailtoHref } from '../lib/format';
import { Alert } from '../components/ui/Alert';
import { Dialog } from '../components/ui/Dialog';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { TextArea } from '../components/ui/Field';
import NotFound from '../pages/NotFound';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';
import { PublishPanel } from './PublishPanel';
import { useStaff } from './auth';
import { useToast } from './toast';
import type { ArticleDetail } from './api';

const STAGE_CHECKLIST: Partial<Record<Status, string[]>> = {
    SUBMITTED: [
        'The manuscript link opens and reviewers have commenter access',
        'Both reports are present and readable',
        'Similarity and AI-content levels are within the guidelines',
        'Author names, emails and designations are complete',
        'The topic fits the museum’s scope',
    ],
    IT_REVIEW: ['Relevant to the history of IT in India', 'Historical claims are accurate and dated', 'Primary or reliable secondary sources are cited'],
    TECH_REVIEW: ['Technical descriptions are correct', 'Terminology is used accurately', 'Figures, data and diagrams are supported'],
    LIT_REVIEW: ['Clear structure and language', 'Citations are complete and consistently formatted', 'Follows the museum template', 'Suggest archive tags for the admin'],
    FINAL_APPROVAL: ['Final PDF matches the approved document', 'Title, author credit and abstract are final', 'Tags describe the article for archive search'],
};

function errorMessage(e: unknown): string {
    if (e instanceof ApiError && e.code === 'CONFLICT') return 'Someone else changed this article while you were viewing it. The latest version has been loaded — please review it before deciding.';
    return e instanceof Error ? e.message : 'The action failed.';
}

export default function Workspace() {
    const { id = '' } = useParams();
    const { api, me } = useStaff();
    const state = useAsync(() => api.article(id), [api, id]);
    usePageMeta(state.status === 'ready' ? `${state.data.article.title} — review` : 'Article — review portal');

    if (state.status === 'loading') {
        return (
            <div className="admin-page" aria-busy="true">
                <Skeleton width="40%" />
                <Skeleton width="80%" height="2.5rem" />
                <Skeleton height="16rem" />
            </div>
        );
    }
    if (state.status === 'error') {
        if (state.error instanceof ApiError && state.error.status === 404) {
            return <NotFound title="Article not in your queues" message="It may have moved to another stage, or the link is incorrect." />;
        }
        return (
            <div className="admin-page">
                <ErrorState message={state.error.message} onRetry={state.retry} />
            </div>
        );
    }
    return <WorkspaceView detail={state.data} reload={state.retry} refreshing={Boolean(state.refreshing)} isAdmin={me.role === 'admin'} />;
}

function WorkspaceView({ detail, reload, refreshing, isAdmin }: { detail: ArticleDetail; reload: () => void; refreshing: boolean; isAdmin: boolean }) {
    const { api, me } = useStaff();
    const { article: a, files, events, checklist } = detail;
    const actions = availableActions(a.status, me.role);
    const authors = a.authors?.length ? a.authors : [{ name: a.author_name, email: a.institution_email ?? '', designation: a.author_designations ?? '' }];
    const stageChecklist = STAGE_CHECKLIST[a.status];
    const showPublish = isAdmin && (a.status === 'FINAL_APPROVAL' || a.status === 'UNPUBLISHED');

    return (
        <div className="admin-page">
            <Link to="/admin/queue" className="arrow-link back-link">
                <ArrowLeft size={16} aria-hidden="true" /> Back to {isAdmin ? 'inbox' : 'my queue'}
            </Link>
            <header className="workspace-head">
                <div>
                    <div className="cluster">
                        <StatusBadge status={a.status} />
                        <code>{a.reference_code}</code>
                        <span className="subtle">In this stage for {ageLabel(a.stage_entered_at ?? a.created_at)}</span>
                    </div>
                    <h1 className="h2">{a.title}</h1>
                    <p className="muted" style={{ margin: 0 }}>
                        {a.author_name} · submitted {formatDate(a.created_at)}
                    </p>
                </div>
                <button type="button" className="btn btn--sm" onClick={reload} disabled={refreshing} aria-busy={refreshing || undefined}>
                    <RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </header>

            {a.status === 'CHANGES_REQUESTED' && (
                <Alert tone="warning" title="Waiting for the contributor">
                    <p>
                        Changes were requested at {a.return_to_stage ? STATUS_LABEL[a.return_to_stage] : 'review'}. The revision returns to that stage automatically.
                    </p>
                </Alert>
            )}
            {a.status === 'REJECTED' && (
                <Alert tone="danger" title="Rejected">
                    <p>
                        {a.rejected_at_stage ? `Rejected at ${STATUS_LABEL[a.rejected_at_stage]}.` : 'Rejected under the previous workflow (stage not recorded).'}
                        {a.public_reason && ` Reason: ${a.public_reason}`}
                    </p>
                </Alert>
            )}
            {a.legacy_status && a.legacy_status !== a.status && (
                <p className="subtle">Imported from the previous system with status {a.legacy_status}.</p>
            )}

            <div className="workspace">
                <div className="workspace__main stack" style={{ ['--stack-gap' as string]: 'var(--space-5)' }}>
                    <section className="card" aria-labelledby="files-title">
                        <h2 id="files-title" className="h3">
                            Manuscript & reports
                        </h2>
                        <ul className="file-links">
                            <li>
                                {a.manuscript_url ? (
                                    <a href={a.manuscript_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink size={16} aria-hidden="true" /> Open manuscript (Google Docs/Drive)<span className="visually-hidden"> in a new tab</span>
                                    </a>
                                ) : (
                                    <span className="subtle">No manuscript link recorded</span>
                                )}
                            </li>
                            <li>
                                {files.similarityUrl ? (
                                    <a href={files.similarityUrl} target="_blank" rel="noopener noreferrer">
                                        <FileText size={16} aria-hidden="true" /> Similarity report (private)
                                    </a>
                                ) : (
                                    <span className="subtle">Similarity report not available</span>
                                )}
                            </li>
                            <li>
                                {files.aiUrl ? (
                                    <a href={files.aiUrl} target="_blank" rel="noopener noreferrer">
                                        <FileText size={16} aria-hidden="true" /> AI detection report (private)
                                    </a>
                                ) : (
                                    <span className="subtle">AI detection report not available</span>
                                )}
                            </li>
                            {files.publishedPdfUrl && (
                                <li>
                                    <a href={files.publishedPdfUrl} target="_blank" rel="noopener noreferrer">
                                        <FileText size={16} aria-hidden="true" /> Published PDF (public)
                                    </a>
                                </li>
                            )}
                        </ul>
                        <p className="subtle" style={{ margin: 0 }}>
                            Report links are signed and expire after 10 minutes — use Refresh to get new ones.
                        </p>
                    </section>

                    <section className="card" aria-labelledby="details-title">
                        <h2 id="details-title" className="h3">
                            Submission details
                        </h2>
                        <div className="table-wrap" style={{ marginBottom: 'var(--space-4)' }}>
                            <table className="table">
                                <caption className="visually-hidden">Authors</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Author</th>
                                        <th scope="col">Designation</th>
                                        <th scope="col">Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {authors.map((au, i) => (
                                        <tr key={i}>
                                            <td>{au.name}</td>
                                            <td>{au.designation || '—'}</td>
                                            <td>{au.email ? (mailtoHref(au.email) ? <a href={mailtoHref(au.email)!}>{au.email}</a> : au.email) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <dl className="meta-list">
                            <div>
                                <dt>Description</dt>
                                <dd className="preserve-lines">{a.description}</dd>
                            </div>
                            <div>
                                <dt>Submitter keywords</dt>
                                <dd>{a.keywords || '—'}</dd>
                            </div>
                            <div>
                                <dt>Archive tags</dt>
                                <dd>{a.tags?.length ? a.tags.join(', ') : '—'}</dd>
                            </div>
                            {a.suggested_tags?.length ? (
                                <div>
                                    <dt>Tags suggested in literature review</dt>
                                    <dd>{a.suggested_tags.join(', ')}</dd>
                                </div>
                            ) : null}
                            <div>
                                <dt>Updates sent to</dt>
                                <dd>{a.submitted_email ?? '—'}</dd>
                            </div>
                            <div>
                                <dt>Originality confirmed</dt>
                                <dd>{a.originality_confirmed ? 'Yes' : 'Not recorded'}</dd>
                            </div>
                        </dl>
                    </section>

                    {showPublish && <PublishPanel detail={detail} checklist={checklist} onChanged={reload} />}

                    <NotesPanel id={a.id} onAdded={reload} />

                    <section className="card" aria-labelledby="timeline-title">
                        <h2 id="timeline-title" className="h3">
                            Activity
                        </h2>
                        <Timeline events={events} />
                    </section>
                </div>

                <aside className="workspace__side stack" aria-label="Decision" style={{ ['--stack-gap' as string]: 'var(--space-5)' }}>
                    {stageChecklist && isReviewStage(a.status) && STAGE_OWNER[a.status] === me.role && (
                        <section className="card" aria-labelledby="check-title">
                            <h2 id="check-title" className="h4">
                                {STATUS_LABEL[a.status]} checklist
                            </h2>
                            <p className="subtle">A guide for your review; it is not saved.</p>
                            <ul className="plain-checks">
                                {stageChecklist.map((c) => (
                                    <li key={c}>
                                        <label className="check">
                                            <input type="checkbox" /> <span>{c}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <DecisionPanel detail={detail} actions={actions} onDone={reload} />

                    {isAdmin && ['SUBMITTED', 'IT_REVIEW', 'TECH_REVIEW', 'LIT_REVIEW', 'FINAL_APPROVAL'].includes(a.status) && (
                        <AssignPanel id={a.id} version={a.version} assigneeId={a.assignee_id} status={a.status} onDone={reload} />
                    )}

                    {((me.role === 'lit_reviewer' && a.status === 'LIT_REVIEW') || (isAdmin && a.status === 'LIT_REVIEW')) && (
                        <SuggestTagsPanel id={a.id} version={a.version} initial={a.suggested_tags ?? []} onDone={reload} api={api} />
                    )}
                </aside>
            </div>
        </div>
    );
}

const DECISION_COPY: Partial<Record<WorkflowAction, { help: string; confirm: string; tone: 'primary' | 'danger' | 'default' }>> = {
    advance: { help: 'Send the article to the next review stage.', confirm: 'Approve and advance', tone: 'primary' },
    request_changes: { help: 'Pause review and ask the contributor for a revision. It returns to this stage when resubmitted. Your reason is sent to the contributor.', confirm: 'Request changes', tone: 'default' },
    reject: { help: 'End the review. The contributor is notified with your reason. Only an admin can reopen it.', confirm: 'Reject article', tone: 'danger' },
    unpublish: { help: 'Hide the article from the public archive. The record and audit trail are kept; the reason is internal.', confirm: 'Unpublish', tone: 'danger' },
    reopen: { help: 'Return a rejected article to the stage where it was rejected.', confirm: 'Reopen', tone: 'primary' },
};

function DecisionPanel({ detail, actions, onDone }: { detail: ArticleDetail; actions: WorkflowAction[]; onDone: () => void }) {
    const { api, me } = useStaff();
    const toast = useToast();
    const navigate = useNavigate();
    const a = detail.article;
    const choices = actions.filter((x) => x !== 'publish'); // publish lives in the publication panel
    const [choice, setChoice] = useState<WorkflowAction | null>(null);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState<string | undefined>();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (choices.length === 0) {
        const owner = isReviewStage(a.status) ? ROLE_LABEL[STAGE_OWNER[a.status]] : null;
        return (
            <section className="card" aria-labelledby="decision-title">
                <h2 id="decision-title" className="h4">
                    Decision
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                    {a.status === 'FINAL_APPROVAL' && me.role === 'admin'
                        ? 'Use the publication panel to publish, or request changes / reject below.'
                        : owner
                          ? `Waiting for the ${owner}.`
                          : `No decision is available while the article is ${STATUS_LABEL[a.status].toLowerCase()}.`}
                </p>
            </section>
        );
    }

    const needsReason = choice ? REASON_REQUIRED.has(choice) : false;
    const start = () => {
        if (!choice) return;
        if (needsReason && reason.trim().length < MIN_REASON_LENGTH) {
            setReasonError(`Write a reason of at least ${MIN_REASON_LENGTH} characters.`);
            return;
        }
        if (needsReason && reason.trim().length > MAX_REASON_LENGTH) {
            setReasonError(`Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`);
            return;
        }
        setReasonError(undefined);
        setConfirming(true);
    };
    const run = async () => {
        if (!choice || busy) return;
        setBusy(true);
        setError(null);
        try {
            const result = await api.transition(a.id, choice, a.version, needsReason ? reason.trim() : undefined);
            setConfirming(false);
            toast('success', `${ACTION_LABEL[choice]}: done. Now in ${STATUS_LABEL[result.status]}.`);
            if (me.role !== 'admin') navigate('/admin/queue');
            else onDone();
        } catch (e) {
            setConfirming(false);
            setError(errorMessage(e));
            if (e instanceof ApiError && e.code === 'CONFLICT') onDone();
        } finally {
            setBusy(false);
        }
    };

    const copy = choice ? DECISION_COPY[choice] : undefined;
    return (
        <section className="card decision" aria-labelledby="decision-title">
            <h2 id="decision-title" className="h4">
                Your decision
            </h2>
            <fieldset>
                <legend className="visually-hidden">Choose a decision</legend>
                {choices.map((c) => (
                    <label key={c} className={`decision__option decision__option--${c}`}>
                        <input type="radio" name="decision" value={c} checked={choice === c} onChange={() => setChoice(c)} />
                        <span>
                            <strong>{ACTION_LABEL[c]}</strong>
                            <span className="subtle">{DECISION_COPY[c]?.help}</span>
                        </span>
                    </label>
                ))}
            </fieldset>
            {needsReason && (
                <TextArea
                    label={choice === 'request_changes' ? 'What should the contributor change?' : choice === 'reject' ? 'Reason for rejection' : 'Reason'}
                    hint={choice === 'request_changes' || choice === 'reject' ? 'Sent to the contributor by email.' : 'Kept in the internal audit log.'}
                    required
                    rows={5}
                    value={reason}
                    error={reasonError}
                    onChange={(e) => setReason(e.target.value)}
                />
            )}
            {error && (
                <Alert tone="danger" role="alert" className="mb-5">
                    <p>{error}</p>
                </Alert>
            )}
            <button type="button" className={`btn btn--block ${copy?.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} disabled={!choice || busy} onClick={start}>
                {choice ? `${ACTION_LABEL[choice]}…` : 'Choose a decision'}
            </button>

            <Dialog
                open={confirming}
                onClose={() => setConfirming(false)}
                title={choice ? `${ACTION_LABEL[choice]}?` : 'Confirm'}
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
                            Cancel
                        </button>
                        <button type="button" className={`btn ${copy?.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} onClick={run} disabled={busy}>
                            {busy && <span className="spinner" aria-hidden="true" />} {copy?.confirm}
                        </button>
                    </>
                }
            >
                <p>
                    <strong>{a.title}</strong>
                </p>
                <p>{copy?.help}</p>
                {needsReason && <blockquote className="quote-box preserve-lines">{reason}</blockquote>}
            </Dialog>
        </section>
    );
}

function NotesPanel({ id, onAdded }: { id: string; onAdded: () => void }) {
    const { api } = useStaff();
    const toast = useToast();
    const [body, setBody] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | undefined>();
    return (
        <section className="card" aria-labelledby="notes-title">
            <h2 id="notes-title" className="h3">
                Internal note
            </h2>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (body.trim().length < 2) return setError('Write a note first.');
                    setBusy(true);
                    setError(undefined);
                    try {
                        await api.note(id, body);
                        setBody('');
                        toast('success', 'Note added to the activity log.');
                        onAdded();
                    } catch (err) {
                        setError(errorMessage(err));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <TextArea
                    label="Add a note for staff"
                    hint="Visible to staff who can open this article. Never shown to the contributor. Notes cannot be edited or deleted."
                    rows={3}
                    value={body}
                    error={error}
                    onChange={(e) => setBody(e.target.value)}
                />
                <button type="submit" className="btn" disabled={busy}>
                    {busy && <span className="spinner" aria-hidden="true" />} Add note
                </button>
            </form>
        </section>
    );
}

function AssignPanel({ id, version, assigneeId, status, onDone }: { id: string; version: number; assigneeId: string | null; status: Status; onDone: () => void }) {
    const { api } = useStaff();
    const toast = useToast();
    const staff = useAsync(() => api.staffList(), [api]);
    const [busy, setBusy] = useState(false);
    const owner = isReviewStage(status) ? STAGE_OWNER[status] : null;
    const options = staff.status === 'ready' ? staff.data.filter((s) => s.active !== false && (!owner || s.role === owner)) : [];
    return (
        <section className="card" aria-labelledby="assign-title">
            <h2 id="assign-title" className="h4">
                Assignment
            </h2>
            <label className="field__label" htmlFor="assign-select">
                Assigned {owner ? ROLE_LABEL[owner].toLowerCase() : 'staff member'}
            </label>
            <select
                id="assign-select"
                className="select"
                value={assigneeId ?? ''}
                disabled={busy || staff.status !== 'ready'}
                onChange={async (e) => {
                    setBusy(true);
                    try {
                        await api.assign(id, e.target.value || null, version);
                        toast('success', 'Assignment updated.');
                        onDone();
                    } catch (err) {
                        toast('danger', errorMessage(err));
                        onDone();
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <option value="">Unassigned</option>
                {options.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.display_name}
                    </option>
                ))}
            </select>
        </section>
    );
}

function SuggestTagsPanel({ id, version, initial, onDone, api }: { id: string; version: number; initial: string[]; onDone: () => void; api: ReturnType<typeof useStaff>['api'] }) {
    const toast = useToast();
    const [value, setValue] = useState(initial.join(', '));
    const [busy, setBusy] = useState(false);
    return (
        <section className="card" aria-labelledby="suggest-title">
            <h2 id="suggest-title" className="h4">
                Suggest archive tags
            </h2>
            <p className="subtle">The admin decides the final tags at publication.</p>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                        await api.suggestTags(
                            id,
                            value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            version,
                        );
                        toast('success', 'Tag suggestions saved.');
                        onDone();
                    } catch (err) {
                        toast('danger', errorMessage(err));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label className="field__label" htmlFor="suggest-tags">
                    Tags (comma-separated)
                </label>
                <input id="suggest-tags" className="input mb-4" value={value} onChange={(e) => setValue(e.target.value)} />
                <button type="submit" className="btn btn--sm" disabled={busy}>
                    Save suggestions
                </button>
            </form>
        </section>
    );
}
