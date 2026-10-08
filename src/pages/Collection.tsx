import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Search, X } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAsync } from '../hooks/useAsync';
import { fetchArchive, KIND_LABEL, primeArchiveCache, type ArchiveItem, type ArchiveKind } from '../services/archive';
import { ArchiveCard } from '../components/archive/ArchiveCard';
import { CardSkeletons } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Alert } from '../components/ui/Alert';
import { PageIntro } from '../components/ui/PageIntro';

type Sort = 'newest' | 'oldest' | 'title';
const KINDS: ArchiveKind[] = ['article', 'exhibit', 'note'];

/** Pure filtering so it can be unit-tested and reused. */
export function filterArchive(items: ArchiveItem[], opts: { q: string; kind: ArchiveKind | ''; tag: string; sort: Sort }): ArchiveItem[] {
    let list = items;
    if (opts.kind) list = list.filter((i) => i.kind === opts.kind);
    if (opts.tag) list = list.filter((i) => i.tags.some((t) => t.toLowerCase() === opts.tag.toLowerCase()));
    const q = opts.q.trim();
    if (q) {
        const fuse = new Fuse(list, {
            keys: [
                { name: 'title', weight: 3 },
                { name: 'tags', weight: 2 },
                { name: 'authors.name', weight: 2 },
                { name: 'summary', weight: 1 },
            ],
            threshold: 0.35,
            ignoreLocation: true,
        });
        return fuse.search(q).map((r) => r.item); // relevance order when searching
    }
    const time = (i: ArchiveItem) => (i.date ? new Date(i.date).getTime() : opts.sort === 'oldest' ? Infinity : -Infinity);
    const sorted = [...list];
    if (opts.sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (opts.sort === 'oldest') sorted.sort((a, b) => time(a) - time(b));
    else sorted.sort((a, b) => time(b) - time(a));
    // Exhibits (undated) lead the default view.
    if (opts.sort === 'newest') sorted.sort((a, b) => Number(b.kind === 'exhibit') - Number(a.kind === 'exhibit'));
    return sorted;
}

export function topTags(items: ArchiveItem[], max = 12): string[] {
    const counts = new Map<string, { label: string; n: number }>();
    for (const i of items)
        for (const t of i.tags) {
            const k = t.toLowerCase();
            const c = counts.get(k) ?? { label: t, n: 0 };
            c.n++;
            counts.set(k, c);
        }
    return [...counts.values()]
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
        .slice(0, max)
        .map((c) => c.label);
}

export default function Collection() {
    usePageMeta('Digital archive', 'Search peer-reviewed research articles, exhibits and collection notes on the history of computing in India.');
    const [params, setParams] = useSearchParams();
    const q = params.get('q') ?? '';
    const kind = (KINDS.includes(params.get('type') as ArchiveKind) ? params.get('type') : '') as ArchiveKind | '';
    const tag = params.get('tag') ?? '';
    const sort = (['newest', 'oldest', 'title'].includes(params.get('sort') ?? '') ? params.get('sort') : 'newest') as Sort;

    const state = useAsync(() => fetchArchive().then(primeArchiveCache), []);

    const update = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: key === 'q' });
    };
    const clearAll = () => setParams(new URLSearchParams());

    const data = state.status === 'ready' ? state.data : null;
    const items = useMemo(() => data?.items ?? [], [data]);
    const results = useMemo(() => filterArchive(items, { q, kind, tag, sort }), [items, q, kind, tag, sort]);
    const tags = useMemo(() => topTags(items), [items]);
    const filtered = Boolean(q || kind || tag);

    return (
        <>
            <PageIntro eyebrow="Collection" title="Digital archive">
                <p>Peer-reviewed research articles, curated exhibits and collection notes on the history of computing in India.</p>
            </PageIntro>

            <section className="section section--tight" aria-label="Archive search and results">
                <div className="container">
                    <form className="archive-controls" role="search" onSubmit={(e) => e.preventDefault()}>
                        <div className="field archive-controls__search">
                            <label className="field__label" htmlFor="archive-q">
                                Search the archive
                            </label>
                            <div className="input-icon">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    id="archive-q"
                                    className="input input--search"
                                    type="search"
                                    value={q}
                                    placeholder="Title, author or topic — e.g. TIFRAC, mainframes"
                                    onChange={(e) => update('q', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="field">
                            <label className="field__label" htmlFor="archive-type">
                                Type
                            </label>
                            <select id="archive-type" className="select" value={kind} onChange={(e) => update('type', e.target.value)}>
                                <option value="">All types</option>
                                {KINDS.map((k) => (
                                    <option key={k} value={k}>
                                        {KIND_LABEL[k]}s
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label className="field__label" htmlFor="archive-sort">
                                Sort by
                            </label>
                            <select id="archive-sort" className="select" value={sort} onChange={(e) => update('sort', e.target.value)} disabled={Boolean(q)} aria-describedby={q ? 'sort-note' : undefined}>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="title">Title A–Z</option>
                            </select>
                            {q && (
                                <p id="sort-note" className="field__hint">
                                    Sorted by relevance while searching.
                                </p>
                            )}
                        </div>
                    </form>

                    {tags.length > 0 && (
                        <div className="archive-tags" role="group" aria-label="Filter by topic">
                            <span className="subtle">Topics:</span>
                            <ul className="tag-list">
                                {tags.map((t) => {
                                    const active = t.toLowerCase() === tag.toLowerCase();
                                    return (
                                        <li key={t}>
                                            <button type="button" className="tag" aria-pressed={active} onClick={() => update('tag', active ? '' : t)}>
                                                {t}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    <div className="archive-summary">
                        <p role="status" aria-live="polite" className="muted" style={{ margin: 0 }}>
                            {state.status === 'loading'
                                ? 'Loading the archive…'
                                : state.status === 'ready'
                                  ? `${results.length} ${results.length === 1 ? 'result' : 'results'}${q ? ` for “${q}”` : ''}${tag ? ` tagged “${tag}”` : ''}${kind ? ` in ${KIND_LABEL[kind].toLowerCase()}s` : ''}`
                                  : ''}
                        </p>
                        {filtered && (
                            <button type="button" className="btn btn--ghost btn--sm" onClick={clearAll}>
                                <X size={16} aria-hidden="true" /> Clear filters
                            </button>
                        )}
                    </div>

                    {state.status === 'ready' &&
                        state.data.errors.map((e) => (
                            <Alert key={e.source} tone="warning" className="mb-5">
                                <p>
                                    {e.message} Other parts of the archive are shown.{' '}
                                    <button type="button" className="link-button" onClick={state.retry}>
                                        Try again
                                    </button>
                                </p>
                            </Alert>
                        ))}

                    {state.status === 'loading' && <CardSkeletons count={6} label="Loading the archive" />}
                    {state.status === 'error' && <ErrorState title="The archive could not be loaded" onRetry={state.retry} />}
                    {state.status === 'ready' &&
                        (results.length === 0 ? (
                            <EmptyState
                                title={filtered ? 'No matching records' : 'The archive is being prepared'}
                                action={
                                    filtered ? (
                                        <button type="button" className="btn" onClick={clearAll}>
                                            Clear search and filters
                                        </button>
                                    ) : undefined
                                }
                            >
                                <p>{filtered ? 'Try a different spelling, a broader term, or remove a filter.' : 'Published research will appear here after review.'}</p>
                            </EmptyState>
                        ) : (
                            <ul className="grid archive-grid" aria-label="Archive records">
                                {results.map((item) => (
                                    <li key={item.id}>
                                        <ArchiveCard item={item} headingLevel={2} />
                                    </li>
                                ))}
                            </ul>
                        ))}
                </div>
            </section>
        </>
    );
}
