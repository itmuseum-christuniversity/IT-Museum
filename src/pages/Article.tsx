import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAsync } from '../hooks/useAsync';
import { citationFor, fetchArchive, fetchArchiveCached, fetchDetail, KIND_LABEL, relatedItems, type ArchiveItem } from '../services/archive';
import { findExhibit, type Exhibit } from '../content/exhibits';
import { config } from '../lib/config';
import { formatDate } from '../lib/format';
import { DocumentViewer } from '../components/archive/DocumentViewer';
import { ArchiveCard } from '../components/archive/ArchiveCard';
import { CopyButton } from '../components/ui/CopyButton';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import NotFound from './NotFound';

function BackLink() {
    return (
        <Link to="/collection" className="arrow-link back-link">
            <ArrowLeft size={16} aria-hidden="true" /> Back to the archive
        </Link>
    );
}

function Related({ item }: { item: ArchiveItem }) {
    const all = useAsync(() => fetchArchiveCached(fetchArchive), []);
    if (all.status !== 'ready') return null;
    const related = relatedItems(all.data.items, item);
    if (!related.length) return null;
    return (
        <section className="section section--sunken" aria-labelledby="related-title">
            <div className="container">
                <h2 id="related-title">Related in the archive</h2>
                <div className="grid">
                    {related.map((r) => (
                        <ArchiveCard key={r.id} item={r} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function ExhibitView({ exhibit }: { exhibit: Exhibit }) {
    usePageMeta(exhibit.title, exhibit.summary);
    const item: ArchiveItem = {
        id: exhibit.id,
        kind: 'exhibit',
        title: exhibit.title,
        summary: exhibit.summary,
        authors: [{ name: 'IT Museum curatorial team' }],
        tags: exhibit.tags,
        date: null,
        dateLabel: 'Dated',
        reference: exhibit.number,
    };
    return (
        <>
            <article className="section article">
                <div className="container article__layout">
                    <header className="article__header">
                        <BackLink />
                        <span className="eyebrow">{exhibit.number} · Exhibit</span>
                        <h1>{exhibit.title}</h1>
                        <p className="lede">{exhibit.subtitle}</p>
                    </header>
                    <div className="article__main prose">
                        {exhibit.sections.map((s) => (
                            <section key={s.heading}>
                                <h2>{s.heading}</h2>
                                {s.body && <p>{s.body}</p>}
                                {s.items && (
                                    <ol className="numbered">
                                        {s.items.map((i) => (
                                            <li key={i.title}>
                                                <strong>{i.title}.</strong> {i.body}
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </section>
                        ))}
                        <section>
                            <h2>Further reading</h2>
                            <ul>
                                {exhibit.furtherReading.map((r) => (
                                    <li key={r.href}>
                                        <a href={r.href} target="_blank" rel="noopener noreferrer">
                                            {r.label}
                                            <span className="visually-hidden"> (opens in a new tab)</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                    <aside className="article__aside" aria-label="About this exhibit">
                        <dl className="meta-list card card--flat">
                            <div>
                                <dt>Type</dt>
                                <dd>Permanent exhibit</dd>
                            </div>
                            <div>
                                <dt>Curated by</dt>
                                <dd>IT Museum curatorial team</dd>
                            </div>
                            <div>
                                <dt>Topics</dt>
                                <dd>
                                    <TagLinks tags={exhibit.tags} />
                                </dd>
                            </div>
                        </dl>
                    </aside>
                </div>
            </article>
            <Related item={item} />
        </>
    );
}

function TagLinks({ tags }: { tags: string[] }) {
    if (!tags.length) return <>—</>;
    return (
        <ul className="tag-list">
            {tags.map((t) => (
                <li key={t}>
                    <Link className="tag" to={`/collection?tag=${encodeURIComponent(t)}`}>
                        {t}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function ItemView({ item }: { item: ArchiveItem }) {
    usePageMeta(item.title, item.summary.slice(0, 160));
    const citation = citationFor(item, config.siteUrl);
    const isNote = item.kind === 'note';
    return (
        <>
            <article className="section article">
                <div className="container article__layout">
                    <header className="article__header">
                        <BackLink />
                        <span className="eyebrow">{KIND_LABEL[item.kind]}</span>
                        <h1>{item.title}</h1>
                        {item.authors.length > 0 && (
                            <ul className="author-list" aria-label="Authors">
                                {item.authors.map((a) => (
                                    <li key={a.name}>
                                        <span className="author-list__name">{a.name}</span>
                                        {a.designation && <span className="subtle">{a.designation}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </header>

                    <div className="article__main">
                        {item.imageUrl && <img className="article__image" src={item.imageUrl} alt="" loading="lazy" />}
                        <section aria-labelledby="abstract-title" className="prose">
                            <h2 id="abstract-title">{isNote ? 'Summary' : 'Abstract'}</h2>
                            <p className="preserve-lines">{item.summary || 'No summary available.'}</p>
                            {isNote && item.body && item.body !== item.summary && <p className="preserve-lines">{item.body}</p>}
                        </section>

                        <section aria-labelledby="document-title" className="article__document">
                            <h2 id="document-title">Full document</h2>
                            <DocumentViewer pdfUrl={item.pdfUrl} externalUrl={item.externalUrl} title={item.title} />
                        </section>

                        {!isNote && (
                            <section aria-labelledby="cite-title">
                                <h2 id="cite-title">Cite this {item.kind === 'article' ? 'article' : 'record'}</h2>
                                <div className="copy-block">
                                    <p style={{ margin: 0 }}>{citation}</p>
                                    <CopyButton text={citation} label="Copy citation" />
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="article__aside" aria-label="Record details">
                        <dl className="meta-list card card--flat">
                            <div>
                                <dt>{item.dateLabel === 'Added' ? 'Added to archive' : item.dateLabel}</dt>
                                <dd>{item.date ? formatDate(item.date) : '—'}</dd>
                            </div>
                            {item.reference && (
                                <div>
                                    <dt>Reference</dt>
                                    <dd>
                                        <code>{item.reference}</code>
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt>Format</dt>
                                <dd>{item.pdfUrl ? 'PDF' : item.externalUrl ? 'Shared document (external)' : 'Text record'}</dd>
                            </div>
                            <div>
                                <dt>Topics</dt>
                                <dd>
                                    <TagLinks tags={item.tags} />
                                </dd>
                            </div>
                            {item.pdfUrl && (
                                <div>
                                    <dt>Access</dt>
                                    <dd>
                                        Openly available.{' '}
                                        <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
                                            Open PDF <ExternalLink size={12} aria-hidden="true" style={{ display: 'inline' }} />
                                            <span className="visually-hidden"> (opens in a new tab)</span>
                                        </a>
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </aside>
                </div>
            </article>
            <Related item={item} />
        </>
    );
}

export default function Article() {
    const { id = '' } = useParams();
    const exhibit = findExhibit(id);
    const state = useAsync(() => (exhibit ? Promise.resolve(null) : fetchDetail(id)), [id]);

    if (exhibit) return <ExhibitView exhibit={exhibit} />;
    if (state.status === 'loading') {
        return (
            <section className="section" role="status" aria-live="polite">
                <div className="container container--narrow stack">
                    <span className="visually-hidden">Loading the record…</span>
                    <Skeleton width="30%" />
                    <Skeleton width="85%" height="2.5rem" />
                    <Skeleton width="60%" />
                    <Skeleton height="12rem" />
                </div>
            </section>
        );
    }
    if (state.status === 'error') {
        return (
            <section className="section">
                <div className="container container--narrow">
                    <ErrorState title="This record could not be loaded" onRetry={state.retry} />
                </div>
            </section>
        );
    }
    const result = state.data;
    if (!result || result.kind === 'missing') {
        return <NotFound title="Record not found" message="This record is not in the public archive. It may not be published yet, or the link may be incorrect." />;
    }
    if (result.kind === 'exhibit') return <NotFound />;
    return <ItemView item={result.item} />;
}
