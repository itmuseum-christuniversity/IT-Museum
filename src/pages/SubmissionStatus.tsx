import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Send } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageIntro } from '../components/ui/PageIntro';
import { TextArea, TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { FileField } from '../components/submission/FileField';
import { ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { lookupStatus, resubmitRevision, type ContributorView } from '../services/submissions';
import { checkManuscriptUrl, checkPdfFile } from '../../supabase/functions/_shared/validation.ts';

const TONE: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
    PUBLISHED: 'success',
    CHANGES_REQUESTED: 'warning',
    REJECTED: 'danger',
};

export default function SubmissionStatus() {
    usePageMeta('Check a submission', 'Check the review status of a research submission to the IT Museum, and send a requested revision.');
    const [params] = useSearchParams();
    const [reference, setReference] = useState(params.get('ref') ?? '');
    // The access key is never placed in the URL (it would end up in browser history).
    const [accessKey, setAccessKey] = useState('');
    // The key that was actually looked up; later edits to the input must not change what a revision is sent with.
    const [lookedUpKey, setLookedUpKey] = useState('');
    const [view, setView] = useState<ContributorView | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);
    // Move focus to the result once it has rendered.
    useEffect(() => {
        if (view) resultRef.current?.focus();
    }, [view]);

    const lookup = async () => {
        setError(null);
        if (!reference.trim() || !accessKey.trim()) {
            setError('Enter both the reference and the access key from your confirmation.');
            return;
        }
        setLoading(true);
        try {
            const key = accessKey.trim();
            setView(await lookupStatus(reference.trim(), key));
            setLookedUpKey(key);
        } catch (e) {
            setView(null);
            setLookedUpKey('');
            setError(e instanceof Error ? e.message : 'Lookup failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <PageIntro eyebrow="Contributors" title="Check a submission">
                <p>Enter the reference and access key shown when you submitted. Only you can see this information.</p>
            </PageIntro>
            <section className="section section--tight">
                <div className="container container--narrow stack" style={{ ['--stack-gap' as string]: 'var(--space-6)' }}>
                    <form
                        className="card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            lookup();
                        }}
                        noValidate
                    >
                        <div className="form-grid form-grid--2">
                            <TextField label="Reference" required placeholder="ITM-2026-ABC123" autoComplete="off" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} />
                            <TextField label="Access key" required autoComplete="off" spellCheck={false} value={accessKey} onChange={(e) => setAccessKey(e.target.value)} />
                        </div>
                        {error && (
                            <Alert tone="danger" role="alert" className="mb-5">
                                <p>{error}</p>
                            </Alert>
                        )}
                        <button type="submit" className="btn btn--primary" disabled={loading}>
                            {loading ? <span className="spinner" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />} Check status
                        </button>
                        <p className="subtle" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
                            Lost your access key? Email the museum with your reference and the submitter email address. Submissions made before October 2026 do not have an access
                            key; we will reply by email.
                        </p>
                    </form>

                    {view && (
                        <div ref={resultRef} tabIndex={-1} className="stack" aria-live="polite">
                            <div className="card">
                                <p className="subtle" style={{ margin: 0 }}>
                                    {view.reference} · submitted {formatDate(view.submittedAt)}
                                </p>
                                <h2 className="h3" style={{ marginTop: 'var(--space-2)' }}>
                                    {view.title}
                                </h2>
                                <Alert tone={TONE[view.status] ?? 'info'} title={view.label}>
                                    <p>{view.description}</p>
                                    {view.reason && (
                                        <>
                                            <p className="alert__title" style={{ marginTop: 'var(--space-3)' }}>
                                                Note from the review panel
                                            </p>
                                            <p className="preserve-lines">{view.reason}</p>
                                        </>
                                    )}
                                    {view.publishedId && (
                                        <p>
                                            <Link to={`/article/${view.publishedId}`}>Read the published article</Link>
                                        </p>
                                    )}
                                </Alert>
                                {view.history.length > 0 && (
                                    <>
                                        <h3 className="h4" style={{ marginTop: 'var(--space-5)' }}>
                                            History
                                        </h3>
                                        <ol className="timeline">
                                            {view.history.map((h, i) => (
                                                <li key={i}>
                                                    <strong>{h.label}</strong>
                                                    <br />
                                                    <span className="subtle">{formatDate(h.at)}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </>
                                )}
                            </div>
                            {view.canResubmit && <RevisionForm reference={view.reference} accessKey={lookedUpKey} onDone={setView} />}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}

function RevisionForm({ reference, accessKey, onDone }: { reference: string; accessKey: string; onDone: (v: ContributorView) => void }) {
    const [note, setNote] = useState('');
    const [url, setUrl] = useState('');
    const [similarity, setSimilarity] = useState<File | null>(null);
    const [ai, setAi] = useState<File | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [failure, setFailure] = useState<string | null>(null);

    const send = async () => {
        const e: Record<string, string> = {};
        if (note.trim().length < 10) e.note = 'Describe what you changed (at least 10 characters).';
        if (url.trim()) {
            const c = checkManuscriptUrl(url);
            if (!c.ok) e.manuscriptUrl = c.message;
        }
        if (similarity) {
            const p = checkPdfFile(similarity);
            if (p) e.similarity = p;
        }
        if (ai) {
            const p = checkPdfFile(ai);
            if (p) e.ai = p;
        }
        setErrors(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        setFailure(null);
        try {
            onDone(await resubmitRevision(reference, accessKey, { note, manuscriptUrl: url.trim() || undefined, similarity, ai }, setProgress));
        } catch (err) {
            if (err instanceof ApiError && err.fields) setErrors(err.fields);
            setFailure(err instanceof Error ? err.message : 'The revision could not be sent.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            className="card"
            noValidate
            onSubmit={(e) => {
                e.preventDefault();
                send();
            }}
        >
            <h2 className="h3">Send your revision</h2>
            <p className="muted">Update your Google Doc first. Your revision returns to the panel that requested the changes.</p>
            <TextArea label="What did you change?" required rows={5} value={note} error={errors.note} onChange={(e) => setNote(e.target.value)} />
            <TextField
                label="New document link"
                optional
                type="url"
                hint="Only if you moved the manuscript to a different document."
                value={url}
                error={errors.manuscriptUrl}
                onChange={(e) => setUrl(e.target.value)}
            />
            <FileField id="rev-sim" label="Updated similarity report" file={similarity} error={errors.similarity} onChange={setSimilarity} />
            <FileField id="rev-ai" label="Updated AI detection report" file={ai} error={errors.ai} onChange={setAi} />
            {failure && (
                <Alert tone="danger" role="alert" className="mb-5">
                    <p>{failure} Your changes are kept — try again.</p>
                </Alert>
            )}
            {busy && (similarity || ai) && (
                <div className="progress mb-5" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                    <div className="progress__bar" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
            )}
            <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? <span className="spinner" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} Send revision
            </button>
        </form>
    );
}
