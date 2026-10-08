import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileDown, Plus, Send, Trash2, UploadCloud } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { PageIntro } from '../components/ui/PageIntro';
import { TextArea, TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { CopyButton } from '../components/ui/CopyButton';
import { FileField } from '../components/submission/FileField';
import { ErrorSummary } from '../components/submission/ErrorSummary';
import { ApiError } from '../lib/api';
import { submitArticle, type SubmitResult } from '../services/submissions';
import { AI_POLICY_TEXT, CONTACT, TEMPLATE_PDF_URL } from '../content/site';
import {
    checkPdfFile,
    countWords,
    MAX_ABSTRACT_WORDS,
    MAX_AUTHORS,
    validateAuthors,
    validateDetails,
    validateSubmission,
    type AuthorInput,
    type FieldErrors,
    type SubmissionInput,
} from '../../supabase/functions/_shared/validation.ts';

const STEPS = ['Prepare', 'Authors', 'Research details', 'Reports', 'Review & submit'] as const;
const DRAFT_KEY = 'itm-submission-draft-v1';
/**
 * Idempotency key for the current form attempt. Kept (in this tab only) across
 * failed attempts and reloads so "Try again" after a lost response returns the
 * first submission instead of creating a second one; cleared on success.
 */
const ATTEMPT_KEY = 'itm-submission-attempt-v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newAttemptId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // randomUUID needs a secure context; build a v4 UUID from getRandomValues otherwise.
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function storedAttemptId(): string | null {
    try {
        const v = sessionStorage.getItem(ATTEMPT_KEY);
        return v && UUID_RE.test(v) ? v : null;
    } catch {
        return null;
    }
}

function storeAttemptId(id: string | null) {
    try {
        if (id) sessionStorage.setItem(ATTEMPT_KEY, id);
        else sessionStorage.removeItem(ATTEMPT_KEY);
    } catch {
        /* storage unavailable: the in-memory key still covers retries on this page */
    }
}

type SubmitFailure = { kind: 'rate_limited' | 'unconfirmed' | 'other'; message: string };
const emptyAuthor = (): AuthorInput => ({ name: '', email: '', designation: '' });

type Draft = Omit<SubmissionInput, 'originalityConfirmed'>;
const emptyDraft: Draft = { title: '', description: '', keywords: '', submitterEmail: '', authors: [emptyAuthor()], manuscriptUrl: '' };

function loadDraft(): Draft {
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) return { ...emptyDraft, ...JSON.parse(raw) };
    } catch {
        /* storage unavailable */
    }
    return emptyDraft;
}

/** Field key → element id, for error-summary links. */
function fieldIds(authors: number): Record<string, string> {
    const ids: Record<string, string> = {
        submitterEmail: 'f-submitter',
        title: 'f-title',
        description: 'f-description',
        keywords: 'f-keywords',
        manuscriptUrl: 'f-manuscript',
        similarity: 'f-similarity',
        ai: 'f-ai',
        originalityConfirmed: 'f-originality',
    };
    for (let i = 0; i < authors; i++) {
        ids[`authors.${i}.name`] = `f-a${i}-name`;
        ids[`authors.${i}.email`] = `f-a${i}-email`;
        ids[`authors.${i}.designation`] = `f-a${i}-designation`;
    }
    return ids;
}

const STEP_OF_FIELD = (key: string): number => {
    if (key === 'submitterEmail' || key.startsWith('authors')) return 1;
    if (['title', 'description', 'keywords', 'manuscriptUrl'].includes(key)) return 2;
    if (key === 'similarity' || key === 'ai') return 3;
    return 4;
};

export default function Submission() {
    usePageMeta('Contribute research', 'Submit original research on the history of computing in India for review by the IT Museum editorial panel.');
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<Draft>(loadDraft);
    const [similarity, setSimilarity] = useState<File | null>(null);
    const [ai, setAi] = useState<File | null>(null);
    const [originality, setOriginality] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [phase, setPhase] = useState<'editing' | 'submitting' | 'done'>('editing');
    const [progress, setProgress] = useState(0);
    const [submitError, setSubmitError] = useState<SubmitFailure | null>(null);
    const attemptRef = useRef<string | null>(null);
    const attemptId = () => {
        attemptRef.current ??= storedAttemptId() ?? newAttemptId();
        storeAttemptId(attemptRef.current);
        return attemptRef.current;
    };
    const resetAttempt = () => {
        attemptRef.current = null;
        storeAttemptId(null);
    };
    const [result, setResult] = useState<SubmitResult | null>(null);
    const summaryRef = useRef<HTMLDivElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    // Focus is moved right after the render that needs it (not in a later frame,
    // which could steal focus from a field the user has already started typing in).
    const [focusRequest, setFocusRequest] = useState<{ target: 'heading' | 'summary'; n: number } | null>(null);
    const requestFocus = (target: 'heading' | 'summary') => setFocusRequest((r) => ({ target, n: (r?.n ?? 0) + 1 }));
    useLayoutEffect(() => {
        if (!focusRequest) return;
        (focusRequest.target === 'heading' ? headingRef.current : summaryRef.current)?.focus();
    }, [focusRequest]);

    useEffect(() => {
        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* ignore */
        }
    }, [draft]);

    const ids = fieldIds(draft.authors.length);
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
    const setAuthor = (i: number, field: keyof AuthorInput, value: string) =>
        setDraft((d) => ({ ...d, authors: d.authors.map((a, j) => (j === i ? { ...a, [field]: value } : a)) }));

    const goTo = (n: number) => {
        setStep(n);
        setErrors({});
        requestFocus('heading');
    };

    const showErrors = (e: FieldErrors) => {
        setErrors(e);
        requestFocus('summary');
    };

    const validateStep = (n: number): FieldErrors => {
        if (n === 1) {
            const e = validateAuthors(draft.authors);
            const full = validateSubmission({ ...draft, originalityConfirmed: true });
            if (full.submitterEmail) e.submitterEmail = full.submitterEmail;
            return e;
        }
        if (n === 2) return validateDetails(draft);
        if (n === 3) {
            const e: FieldErrors = {};
            const s = checkPdfFile(similarity);
            const a = checkPdfFile(ai);
            if (s) e.similarity = `Similarity report: ${s}`;
            if (a) e.ai = `AI detection report: ${a}`;
            return e;
        }
        return {};
    };

    const next = () => {
        const e = validateStep(step);
        if (Object.keys(e).length) return showErrors(e);
        goTo(step + 1);
    };

    const submit = async () => {
        const all: FieldErrors = { ...validateSubmission({ ...draft, originalityConfirmed: originality }), ...validateStep(3) };
        if (Object.keys(all).length) {
            const first = Math.min(...Object.keys(all).map(STEP_OF_FIELD));
            if (first < 4) {
                setStep(first);
                showErrors(all);
                return;
            }
            return showErrors(all);
        }
        setPhase('submitting');
        setSubmitError(null);
        setProgress(0);
        try {
            const res = await submitArticle({ ...draft, originalityConfirmed: originality }, { similarity: similarity!, ai: ai! }, attemptId(), setProgress);
            resetAttempt();
            setResult(res);
            setPhase('done');
            try {
                sessionStorage.removeItem(DRAFT_KEY);
            } catch {
                /* ignore */
            }
            requestFocus('heading');
        } catch (err) {
            setPhase('editing');
            if (err instanceof ApiError && err.fields && Object.keys(err.fields).length) {
                const first = Math.min(...Object.keys(err.fields).map(STEP_OF_FIELD));
                setStep(first);
                showErrors(err.fields);
            } else {
                // The server says this attempt id already belongs to a submission with other
                // details: the next try is a new attempt.
                if (err instanceof ApiError && err.code === 'IDEMPOTENCY_MISMATCH') resetAttempt();
                const message = err instanceof Error ? err.message : 'The submission failed. Please try again.';
                const kind = err instanceof ApiError && err.status === 429 ? 'rate_limited' : err instanceof ApiError && err.code === 'NETWORK' ? 'unconfirmed' : 'other';
                setSubmitError({ kind, message });
                requestFocus('summary');
            }
        }
    };

    if (phase === 'done' && result) {
        return (
            <>
                <PageIntro eyebrow="Submission received" title="Thank you — your article has been submitted" />
                <section className="section section--tight">
                    <div className="container container--narrow stack">
                        <h2 ref={headingRef} tabIndex={-1} className="h3">
                            Keep these details
                        </h2>
                        {result.duplicate && (
                            <Alert tone="info" title="We already had this submission" role="status">
                                <p>Your earlier attempt reached us, so nothing was sent twice. These are the details of that submission.</p>
                            </Alert>
                        )}
                        <p>You need both the reference and the access key to check progress or send a revision. The access key is shown only once.</p>
                        <dl className="meta-list card">
                            <div>
                                <dt>Reference</dt>
                                <dd className="cluster">
                                    <code className="big-code">{result.reference}</code>
                                    <CopyButton text={result.reference} label="Copy reference" />
                                </dd>
                            </div>
                            {result.accessKey && (
                                <div>
                                    <dt>Access key</dt>
                                    <dd className="cluster">
                                        <code className="big-code">{result.accessKey}</code>
                                        <CopyButton text={result.accessKey} label="Copy access key" />
                                    </dd>
                                </div>
                            )}
                        </dl>
                        {!result.accessKey && (
                            <Alert tone="warning" title="Your access key was shown on the first attempt">
                                <p>
                                    For security, the access key is shown only when a submission is first received, and we do not keep a copy of it. If you saved it, use it
                                    with the reference above.
                                </p>
                                <p>
                                    If you did not save it, email <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`Access key for ${result.reference}`)}`}>{CONTACT.email}</a>{' '}
                                    from {draft.submitterEmail || 'the address you submitted with'} and include the reference. We will reply by email.
                                </p>
                            </Alert>
                        )}
                        <Alert tone="info" title="What happens next">
                            <ol>
                                <li>The editorial admin checks that the submission is complete.</li>
                                <li>The IT, technical and literature panels review it in turn, commenting in your Google Doc.</li>
                                <li>The editorial admin makes the final publication decision.</li>
                            </ol>
                            <p>We email {draft.submitterEmail || 'you'} when a decision is made or if changes are requested.</p>
                        </Alert>
                        <div className="cluster">
                            <Link className="btn btn--primary" to={`/submission/status?ref=${encodeURIComponent(result.reference)}`}>
                                Check status
                            </Link>
                            <Link className="btn" to="/collection">
                                Browse the archive
                            </Link>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    const words = countWords(draft.description);
    const err = (k: string) => errors[k];

    return (
        <>
            <PageIntro eyebrow="Contribute" title="Submit your research">
                <p>Share original research on the history of computing in India. Submissions are reviewed by the IT, technical and literature panels before final editorial approval.</p>
            </PageIntro>

            <section className="section section--tight">
                <div className="container container--narrow">
                    <nav aria-label="Submission progress">
                        <ol className="steps">
                            {STEPS.map((s, i) => (
                                <li key={s} aria-current={i === step ? 'step' : undefined} data-state={i < step ? 'done' : undefined}>
                                    <span className="steps__label">{s}</span>
                                    {i < step && <span className="visually-hidden"> (completed)</span>}
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <h2 ref={headingRef} tabIndex={-1}>
                        <span className="visually-hidden">Step {step + 1} of {STEPS.length}: </span>
                        {STEPS[step]}
                    </h2>

                    <ErrorSummary ref={summaryRef} errors={errors} fieldIds={ids} />
                    {submitError && (
                        <div ref={Object.keys(errors).length ? undefined : summaryRef} tabIndex={-1} className="mb-5">
                            {submitError.kind === 'rate_limited' ? (
                                <Alert tone="warning" title="Please wait before trying again" role="alert">
                                    <p>{submitError.message}</p>
                                    <p>Nothing was submitted. Your answers and selected files are kept, so you can try again later from this page.</p>
                                </Alert>
                            ) : (
                                <Alert tone="danger" title={submitError.kind === 'unconfirmed' ? 'We could not confirm your submission' : 'Your submission was not sent'} role="alert">
                                    <p>{submitError.message}</p>
                                    <p>Your answers and selected files are kept — you can try again. If an earlier attempt did reach us, trying again will not send it twice.</p>
                                </Alert>
                            )}
                        </div>
                    )}

                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (step < 4) next();
                            else submit();
                        }}
                    >
                        {step === 0 && (
                            <div className="stack">
                                <p>Before you start, make sure you have:</p>
                                <ul className="checklist">
                                    <li>An original manuscript, not published elsewhere, written in Google Docs using the museum template.</li>
                                    <li>A description (abstract) of up to {MAX_ABSTRACT_WORDS} words and a few keywords.</li>
                                    <li>Names, institutional emails and designations for up to {MAX_AUTHORS} authors.</li>
                                    <li>A similarity (plagiarism) report and an AI-content detection report, each as a PDF under 10 MB.</li>
                                </ul>
                                <a className="btn" href={TEMPLATE_PDF_URL} target="_blank" rel="noopener noreferrer">
                                    <FileDown size={16} aria-hidden="true" /> View the research paper template (PDF)
                                    <span className="visually-hidden"> (opens in a new tab)</span>
                                </a>

                                <div className="card card--sunken stack">
                                    <h3>Give the editorial team commenter access</h3>
                                    <p>Reviewers comment directly in your document, so it must be shared before you submit:</p>
                                    <ol>
                                        <li>
                                            In Google Docs, select <strong>Share</strong>.
                                        </li>
                                        <li>
                                            Under <strong>General access</strong>, choose <strong>Anyone with the link</strong> (or add the reviewers’ emails if your institution restricts
                                            sharing).
                                        </li>
                                        <li>
                                            Set the role to <strong>Commenter</strong>, then select <strong>Copy link</strong>.
                                        </li>
                                    </ol>
                                    <p className="subtle">We check that the link points to a Google Doc or Drive file, but we cannot check its sharing settings. If reviewers cannot open it, we will ask you to fix access.</p>
                                </div>

                                <Alert tone="info" title="Content guidelines">
                                    <ul>
                                        <li>All submissions must be original and not previously published elsewhere.</li>
                                        <li>{AI_POLICY_TEXT}</li>
                                        <li>You can add relevant pictures and videos within your document.</li>
                                    </ul>
                                </Alert>
                            </div>
                        )}

                        {step === 1 && (
                            <>
                                <TextField
                                    id={ids.submitterEmail}
                                    label="Your email for updates"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    hint="We send the confirmation and every decision to this address."
                                    value={draft.submitterEmail}
                                    error={err('submitterEmail')}
                                    onChange={(e) => set('submitterEmail', e.target.value)}
                                />
                                {err('authors') && <Alert tone="danger">{err('authors')}</Alert>}
                                {draft.authors.map((a, i) => (
                                    <fieldset key={i} className="author-fieldset">
                                        <legend>{i === 0 ? 'Primary author' : `Author ${i + 1}`}</legend>
                                        <div className="form-grid form-grid--2">
                                            <TextField
                                                id={ids[`authors.${i}.name`]}
                                                fieldClassName="span-all"
                                                label="Full name"
                                                required
                                                autoComplete={i === 0 ? 'name' : 'off'}
                                                value={a.name}
                                                error={err(`authors.${i}.name`)}
                                                onChange={(e) => setAuthor(i, 'name', e.target.value)}
                                            />
                                            <TextField
                                                id={ids[`authors.${i}.email`]}
                                                label="Institutional email"
                                                type="email"
                                                required
                                                value={a.email}
                                                error={err(`authors.${i}.email`)}
                                                onChange={(e) => setAuthor(i, 'email', e.target.value)}
                                            />
                                            <TextField
                                                id={ids[`authors.${i}.designation`]}
                                                label="Designation"
                                                required
                                                placeholder="e.g. Associate Professor"
                                                value={a.designation}
                                                error={err(`authors.${i}.designation`)}
                                                onChange={(e) => setAuthor(i, 'designation', e.target.value)}
                                            />
                                        </div>
                                        {i > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn--ghost btn--sm"
                                                onClick={() => setDraft((d) => ({ ...d, authors: d.authors.filter((_, j) => j !== i) }))}
                                            >
                                                <Trash2 size={16} aria-hidden="true" /> Remove author {i + 1}
                                            </button>
                                        )}
                                    </fieldset>
                                ))}
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={draft.authors.length >= MAX_AUTHORS}
                                    onClick={() => setDraft((d) => ({ ...d, authors: [...d.authors, emptyAuthor()] }))}
                                >
                                    <Plus size={16} aria-hidden="true" /> Add another author
                                </button>
                                <p className="subtle" aria-live="polite">
                                    {draft.authors.length} of {MAX_AUTHORS} authors
                                </p>
                            </>
                        )}

                        {step === 2 && (
                            <>
                                <TextField id={ids.title} label="Article title" required value={draft.title} error={err('title')} onChange={(e) => set('title', e.target.value)} />
                                <TextArea
                                    id={ids.description}
                                    label="Description (abstract)"
                                    required
                                    rows={8}
                                    hint={`Summarise the research in 20–${MAX_ABSTRACT_WORDS} words.`}
                                    value={draft.description}
                                    error={err('description')}
                                    onChange={(e) => set('description', e.target.value)}
                                />
                                <p className={`word-count ${words > MAX_ABSTRACT_WORDS ? 'word-count--over' : ''}`} aria-live="polite">
                                    {words} / {MAX_ABSTRACT_WORDS} words
                                </p>
                                <TextField
                                    id={ids.keywords}
                                    label="Keywords"
                                    required
                                    hint="Separate with commas, e.g. computing history, mainframes, ISRO"
                                    value={draft.keywords}
                                    error={err('keywords')}
                                    onChange={(e) => set('keywords', e.target.value)}
                                />
                                <TextField
                                    id={ids.manuscriptUrl}
                                    label="Google Doc or Drive link to your manuscript"
                                    type="url"
                                    inputMode="url"
                                    required
                                    hint="Paste the link copied from Share → Copy link. It must allow commenter access."
                                    placeholder="https://docs.google.com/document/d/…"
                                    value={draft.manuscriptUrl}
                                    error={err('manuscriptUrl')}
                                    onChange={(e) => set('manuscriptUrl', e.target.value)}
                                />
                            </>
                        )}

                        {step === 3 && (
                            <>
                                <p>Upload both reports as PDFs (10 MB maximum each). They are stored privately and only the review panel can open them.</p>
                                <FileField id={ids.similarity} label="Similarity (plagiarism) report" required file={similarity} error={err('similarity')} onChange={setSimilarity} />
                                <FileField
                                    id={ids.ai}
                                    label="AI content detection report"
                                    hint={AI_POLICY_TEXT}
                                    required
                                    file={ai}
                                    error={err('ai')}
                                    onChange={setAi}
                                />
                            </>
                        )}

                        {step === 4 && (
                            <div className="stack">
                                <dl className="meta-list card review-summary">
                                    <SummaryRow label="Title" value={draft.title} onEdit={() => goTo(2)} />
                                    <SummaryRow label="Authors" value={draft.authors.map((a) => `${a.name} (${a.designation})`).join('; ')} onEdit={() => goTo(1)} />
                                    <SummaryRow label="Updates sent to" value={draft.submitterEmail} onEdit={() => goTo(1)} />
                                    <SummaryRow label="Keywords" value={draft.keywords} onEdit={() => goTo(2)} />
                                    <SummaryRow label="Manuscript" value={draft.manuscriptUrl} onEdit={() => goTo(2)} />
                                    <SummaryRow label="Reports" value={[similarity?.name, ai?.name].filter(Boolean).join(', ') || '—'} onEdit={() => goTo(3)} />
                                </dl>
                                <div className="field">
                                    <label className="check" htmlFor={ids.originalityConfirmed}>
                                        <input
                                            id={ids.originalityConfirmed}
                                            type="checkbox"
                                            checked={originality}
                                            aria-invalid={Boolean(err('originalityConfirmed')) || undefined}
                                            aria-describedby={err('originalityConfirmed') ? 'originality-error' : undefined}
                                            onChange={(e) => setOriginality(e.target.checked)}
                                        />
                                        <span>
                                            I confirm that this article is original work and has not been published elsewhere. I understand that plagiarism or non-original work will
                                            result in rejection.
                                        </span>
                                    </label>
                                    {err('originalityConfirmed') && (
                                        <p className="field__error" id="originality-error">
                                            {err('originalityConfirmed')}
                                        </p>
                                    )}
                                </div>
                                {phase === 'submitting' && (
                                    <div className="stack" role="status" aria-live="polite">
                                        <p style={{ margin: 0 }}>{progress < 1 ? `Uploading reports… ${Math.round(progress * 100)}%` : 'Saving your submission…'}</p>
                                        <div className="progress" aria-hidden="true">
                                            <div className="progress__bar" style={{ width: `${Math.round(progress * 100)}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-nav">
                            {step > 0 && (
                                <button type="button" className="btn" onClick={() => goTo(step - 1)} disabled={phase === 'submitting'}>
                                    <ArrowLeft size={16} aria-hidden="true" /> Back
                                </button>
                            )}
                            {step === 0 && (
                                <button type="submit" className="btn btn--primary">
                                    Start submission <ArrowRight size={16} aria-hidden="true" />
                                </button>
                            )}
                            {step > 0 && step < 4 && (
                                <button type="submit" className="btn btn--primary">
                                    Continue <ArrowRight size={16} aria-hidden="true" />
                                </button>
                            )}
                            {step === 4 && (
                                <button type="submit" className="btn btn--primary btn--lg" disabled={phase === 'submitting'} aria-disabled={phase === 'submitting'}>
                                    {phase === 'submitting' ? (
                                        <>
                                            <span className="spinner" aria-hidden="true" /> Submitting…
                                        </>
                                    ) : submitError ? (
                                        <>
                                            <UploadCloud size={18} aria-hidden="true" /> Try again
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} aria-hidden="true" /> Submit article
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </section>
        </>
    );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
    return (
        <div className="review-summary__row">
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
            <dd>
                <button type="button" className="link-button" onClick={onEdit}>
                    Change<span className="visually-hidden"> {label.toLowerCase()}</span>
                </button>
            </dd>
        </div>
    );
}
