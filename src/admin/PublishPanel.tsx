import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Rocket, ScanText, X } from 'lucide-react';
import { MAX_AUTHOR_CREDIT_CHARS, MAX_DESCRIPTION_CHARS, parseKeywords } from '../../supabase/functions/_shared/validation.ts';
import type { ChecklistItem } from '../../supabase/functions/_shared/workflow.ts';
import { ApiError } from '../lib/api';
import { Alert } from '../components/ui/Alert';
import { Dialog } from '../components/ui/Dialog';
import { TextArea, TextField } from '../components/ui/Field';
import { FileField } from '../components/submission/FileField';
import { useStaff } from './auth';
import { useToast } from './toast';
import type { ArticleDetail } from './api';

function msg(e: unknown) {
    if (e instanceof ApiError && e.code === 'CONFLICT') return 'This article changed in another session. It has been reloaded — check the latest version and try again.';
    return e instanceof Error ? e.message : 'The action failed.';
}

/**
 * Final publication workspace (admin only): stage the final PDF, edit public
 * metadata and tags, check the publication checklist, then publish with an
 * explicit confirmation.
 */
export function PublishPanel({ detail, checklist, onChanged }: { detail: ArticleDetail; checklist: ChecklistItem[]; onChanged: () => void }) {
    const { api } = useStaff();
    const toast = useToast();
    const a = detail.article;

    const [title, setTitle] = useState(a.title);
    const [authorCredit, setAuthorCredit] = useState(a.author_name);
    const [description, setDescription] = useState(a.description);
    const [tags, setTags] = useState<string[]>(a.tags ?? []);
    const [newTag, setNewTag] = useState('');
    const [scanned, setScanned] = useState<string[]>([]);
    const [scanProgress, setScanProgress] = useState<number | null>(null);
    const [savingMeta, setSavingMeta] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const dirty = title !== a.title || authorCredit !== a.author_name || description !== a.description || JSON.stringify(tags) !== JSON.stringify(a.tags ?? []);
    const suggestions = useMemo(() => {
        const have = new Set(tags.map((t) => t.toLowerCase()));
        const pool = [...(a.suggested_tags ?? []), ...parseKeywords(a.keywords ?? ''), ...scanned];
        const seen = new Set<string>();
        return pool.filter((t) => {
            const k = t.toLowerCase();
            if (have.has(k) || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [tags, a.suggested_tags, a.keywords, scanned]);

    const addTag = (t: string) => {
        const clean = t.trim();
        if (clean && !tags.some((x) => x.toLowerCase() === clean.toLowerCase())) setTags([...tags, clean]);
    };

    const saveMeta = async () => {
        setSavingMeta(true);
        setError(null);
        try {
            await api.updateMetadata(a.id, a.version, { title, author_name: authorCredit, description, tags });
            toast('success', 'Publication details saved.');
            onChanged();
        } catch (e) {
            setError(msg(e));
            if (e instanceof ApiError && e.code === 'CONFLICT') onChanged();
        } finally {
            setSavingMeta(false);
        }
    };

    const upload = async () => {
        if (!file) return;
        setError(null);
        setUploadProgress(0);
        try {
            await api.stageFinalPdf(a.id, a.version, file, setUploadProgress);
            toast('success', 'Final PDF uploaded. Check the preview before publishing.');
            setFile(null);
            onChanged();
        } catch (e) {
            setError(msg(e));
        } finally {
            setUploadProgress(null);
        }
    };

    const scan = async () => {
        if (!file) return;
        setScanProgress(0);
        try {
            const { suggestKeywordsFromPdf } = await import('./keywords');
            setScanned(await suggestKeywordsFromPdf(file, setScanProgress));
        } catch {
            toast('warning', 'Could not read text from this PDF. Add tags manually.');
        } finally {
            setScanProgress(null);
        }
    };

    const publish = async () => {
        setPublishing(true);
        setError(null);
        try {
            await api.transition(a.id, 'publish', a.version);
            setConfirm(false);
            toast('success', 'Published. The article is now live in the archive and the contributor has been notified.');
            onChanged();
        } catch (e) {
            setConfirm(false);
            setError(msg(e));
            if (e instanceof ApiError && e.code === 'CONFLICT') onChanged();
        } finally {
            setPublishing(false);
        }
    };

    const ready = checklist.every((c) => c.ok);
    const pdfUrl = detail.files.stagedPdfUrl;

    return (
        <section className="card publish" aria-labelledby="publish-title">
            <span className="eyebrow">Admin · final approval</span>
            <h2 id="publish-title" className="h3">
                Prepare publication
            </h2>
            <p className="muted">Download the approved Google Doc as a PDF, upload it here, finalise the public details, then publish.</p>
            {error && (
                <Alert tone="danger" role="alert" className="mb-5">
                    <p>{error}</p>
                </Alert>
            )}

            <h3 className="h4">1. Final PDF</h3>
            {pdfUrl ? (
                <div className="publish__preview">
                    <object data={pdfUrl} type="application/pdf" aria-label="Preview of the final PDF">
                        <div className="doc-viewer__fallback">
                            <p>This browser cannot preview PDFs inline.</p>
                            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                                Open the staged PDF
                            </a>
                        </div>
                    </object>
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="subtle">
                        Open the staged PDF in a new tab
                    </a>
                </div>
            ) : (
                <p className="subtle">No final PDF uploaded yet.</p>
            )}
            <FileField id="final-pdf" label={pdfUrl ? 'Replace the final PDF' : 'Upload the final PDF'} hint="PDF, 25 MB maximum. Stored privately until you publish." file={file} onChange={setFile} />
            {uploadProgress !== null && (
                <div className="progress mb-4" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round(uploadProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress__bar" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
                </div>
            )}
            <div className="cluster mb-5">
                <button type="button" className="btn btn--primary" disabled={!file || uploadProgress !== null} onClick={upload}>
                    Upload PDF
                </button>
                <button type="button" className="btn" disabled={!file || scanProgress !== null} onClick={scan}>
                    <ScanText size={16} aria-hidden="true" /> {scanProgress !== null ? `Reading… ${Math.round(scanProgress * 100)}%` : 'Suggest tags from this PDF'}
                </button>
            </div>

            <h3 className="h4">2. Public details</h3>
            <TextField label="Title" required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Author credit" required hint="As it should appear in the archive and citation." maxLength={MAX_AUTHOR_CREDIT_CHARS} value={authorCredit} onChange={(e) => setAuthorCredit(e.target.value)} />
            <TextArea label="Abstract" required rows={6} maxLength={MAX_DESCRIPTION_CHARS} value={description} onChange={(e) => setDescription(e.target.value)} />

            <div className="field">
                <span className="field__label" id="tags-label">
                    Archive tags
                </span>
                <ul className="tag-list" aria-labelledby="tags-label">
                    {tags.length === 0 && <li className="subtle">No tags yet.</li>}
                    {tags.map((t) => (
                        <li key={t}>
                            <button type="button" className="tag" onClick={() => setTags(tags.filter((x) => x !== t))}>
                                {t} <X size={14} aria-hidden="true" />
                                <span className="visually-hidden">(remove)</span>
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="cluster">
                    <label className="visually-hidden" htmlFor="new-tag">
                        New tag
                    </label>
                    <input
                        id="new-tag"
                        className="input"
                        style={{ maxWidth: '18rem' }}
                        placeholder="Add a tag"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag(newTag);
                                setNewTag('');
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => {
                            addTag(newTag);
                            setNewTag('');
                        }}
                    >
                        <Plus size={16} aria-hidden="true" /> Add
                    </button>
                </div>
                {suggestions.length > 0 && (
                    <>
                        <p className="field__hint">Suggestions (from the submitter, literature review and PDF scan):</p>
                        <ul className="tag-list">
                            {suggestions.slice(0, 20).map((t) => (
                                <li key={t}>
                                    <button type="button" className="tag" onClick={() => addTag(t)}>
                                        <Plus size={14} aria-hidden="true" /> {t}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
            <button type="button" className="btn mb-5" disabled={!dirty || savingMeta} onClick={saveMeta}>
                {savingMeta && <span className="spinner" aria-hidden="true" />} Save details
            </button>

            <h3 className="h4">3. Checklist</h3>
            <ul className="checklist-status">
                {checklist.map((c) => (
                    <li key={c.id} data-ok={c.ok}>
                        {c.ok ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                        <span>
                            {c.label}
                            <span className="visually-hidden">{c.ok ? ' — done' : ' — not done'}</span>
                        </span>
                    </li>
                ))}
            </ul>
            {dirty && <Alert tone="warning">Save your edits to the public details before publishing.</Alert>}

            <button
                type="button"
                className="btn btn--primary btn--lg"
                style={{ marginTop: 'var(--space-4)' }}
                disabled={!ready || dirty}
                onClick={() => {
                    setAcknowledged(false);
                    setConfirm(true);
                }}
            >
                <Rocket size={18} aria-hidden="true" /> {a.status === 'UNPUBLISHED' ? 'Republish…' : 'Publish…'}
            </button>
            {!ready && <p className="subtle">Complete the checklist to enable publishing.</p>}

            <Dialog
                open={confirm}
                onClose={() => setConfirm(false)}
                title="Publish to the public archive?"
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setConfirm(false)} disabled={publishing}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn--primary" onClick={publish} disabled={!acknowledged || publishing}>
                            {publishing && <span className="spinner" aria-hidden="true" />} Publish now
                        </button>
                    </>
                }
            >
                <p>
                    <strong>{a.title}</strong> — {a.author_name}
                </p>
                <ul>
                    <li>The final PDF becomes publicly downloadable.</li>
                    <li>The article appears in the archive, search and featured research.</li>
                    {a.status === 'FINAL_APPROVAL' && <li>The contributor is emailed that the article is published.</li>}
                </ul>
                <label className="check">
                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                    <span>I have checked the PDF preview and the public details.</span>
                </label>
            </Dialog>
        </section>
    );
}
