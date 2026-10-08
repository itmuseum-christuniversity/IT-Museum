/**
 * Unified, read-only archive model. Three sources feed the public archive:
 *   1. Supabase `published_articles` view — peer-reviewed research articles.
 *      Only PUBLISHED rows exist in the view, so drafts can never be fetched.
 *   2. Curated exhibits authored in code (src/content/exhibits.ts).
 *   3. Legacy Firestore `collections` documents ("collection notes"), kept
 *      read-only until they are migrated (see README → Content sources).
 * A failure in one source does not hide the others.
 */
import { publicDb } from '../lib/supabase';
import { firestore } from '../lib/firebase';
import { safeUrl } from '../lib/sanitize';
import { EXHIBITS, findExhibit } from '../content/exhibits';

export type ArchiveKind = 'article' | 'exhibit' | 'note';

export interface ArchiveAuthor {
    name: string;
    designation?: string | null;
}

export interface ArchiveItem {
    id: string; // route id
    kind: ArchiveKind;
    title: string;
    summary: string;
    authors: ArchiveAuthor[];
    tags: string[];
    date: string | null; // ISO
    dateLabel: 'Published' | 'Added' | 'Dated';
    reference?: string | null;
    pdfUrl?: string | null;
    externalUrl?: string | null;
    imageUrl?: string | null;
    body?: string | null;
}

export const KIND_LABEL: Record<ArchiveKind, string> = {
    article: 'Research article',
    exhibit: 'Exhibit',
    note: 'Collection note',
};

interface PublishedRow {
    id: string;
    reference_code: string | null;
    title: string;
    author_name: string;
    authors: { name: string; designation?: string }[] | null;
    description: string;
    tags: string[] | null;
    created_at: string;
    published_at: string | null;
    pdf_url: string | null;
    external_document_url: string | null;
}

const COLUMNS = 'id, reference_code, title, author_name, authors, description, tags, created_at, published_at, pdf_url, external_document_url';

export function fromPublished(r: PublishedRow): ArchiveItem {
    const authors: ArchiveAuthor[] = r.authors?.length
        ? r.authors.filter((a) => a?.name).map((a) => ({ name: a.name, designation: a.designation ?? null }))
        : r.author_name
              .split(',')
              .map((n) => n.trim())
              .filter(Boolean)
              .map((name) => ({ name }));
    return {
        id: r.id,
        kind: 'article',
        title: r.title,
        summary: r.description,
        authors,
        tags: r.tags ?? [],
        // Legacy records have no recorded publication date; show when they entered the archive.
        date: r.published_at ?? r.created_at,
        dateLabel: r.published_at ? 'Published' : 'Added',
        reference: r.reference_code,
        pdfUrl: safeUrl(r.pdf_url),
        externalUrl: safeUrl(r.external_document_url),
    };
}

function fromExhibit(e: (typeof EXHIBITS)[number]): ArchiveItem {
    return {
        id: e.id,
        kind: 'exhibit',
        title: e.title,
        summary: e.summary,
        authors: [{ name: 'IT Museum curatorial team' }],
        tags: e.tags,
        date: null,
        dateLabel: 'Dated',
        reference: e.number,
    };
}

interface FirestoreCollection {
    title?: string;
    subtitle?: string;
    summary?: string;
    content?: string;
    imageUrl?: string;
    pdfUrl?: string;
    date?: string | { toDate?: () => Date };
}

function fsDate(d: FirestoreCollection['date']): string | null {
    if (!d) return null;
    if (typeof d === 'string') return Number.isNaN(Date.parse(d)) ? null : new Date(d).toISOString();
    return d.toDate ? d.toDate().toISOString() : null;
}

export const NOTE_PREFIX = 'note-';

function fromFirestore(id: string, d: FirestoreCollection): ArchiveItem {
    const content = typeof d.content === 'string' ? d.content : '';
    return {
        id: `${NOTE_PREFIX}${id}`,
        kind: 'note',
        title: d.title?.trim() || 'Untitled collection note',
        summary: d.summary?.trim() || d.subtitle?.trim() || content.slice(0, 220),
        authors: [],
        tags: d.subtitle ? [d.subtitle] : [],
        date: fsDate(d.date),
        dateLabel: 'Dated',
        pdfUrl: safeUrl(d.pdfUrl),
        imageUrl: safeUrl(d.imageUrl),
        body: content || null,
    };
}

export interface ArchiveResult {
    items: ArchiveItem[];
    errors: { source: 'articles' | 'notes'; message: string }[];
}

export async function fetchPublishedArticles(limit?: number): Promise<ArchiveItem[]> {
    let q = publicDb().from('published_articles').select(COLUMNS).order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as PublishedRow[]).map(fromPublished);
}

async function fetchNotes(): Promise<ArchiveItem[]> {
    const { db, mod } = await firestore();
    const snap = await mod.getDocs(mod.collection(db, 'collections'));
    return snap.docs.map((doc) => fromFirestore(doc.id, doc.data() as FirestoreCollection));
}

export async function fetchArchive(): Promise<ArchiveResult> {
    const [articles, notes] = await Promise.allSettled([fetchPublishedArticles(), fetchNotes()]);
    const errors: ArchiveResult['errors'] = [];
    if (articles.status === 'rejected') errors.push({ source: 'articles', message: 'Research articles could not be loaded.' });
    if (notes.status === 'rejected') errors.push({ source: 'notes', message: 'Collection notes could not be loaded.' });
    const items = [
        ...EXHIBITS.map(fromExhibit),
        ...(articles.status === 'fulfilled' ? articles.value : []),
        ...(notes.status === 'fulfilled' ? notes.value : []),
    ];
    return { items, errors };
}

const ARCHIVE_CACHE_MS = 5 * 60 * 1000;
let archiveCache: { at: number; result: Promise<ArchiveResult> } | null = null;

/**
 * Module-level memo of the full archive, so views that only need it for a
 * secondary purpose (e.g. "related items" on every article page) share one load
 * instead of re-reading every published row and Firestore collection per view.
 * Partial failures and rejections are never cached.
 */
export function fetchArchiveCached(load: () => Promise<ArchiveResult> = fetchArchive): Promise<ArchiveResult> {
    if (archiveCache && Date.now() - archiveCache.at < ARCHIVE_CACHE_MS) return archiveCache.result;
    const result: Promise<ArchiveResult> = load().then(
        (r) => {
            if (r.errors.length && archiveCache?.result === result) archiveCache = null;
            return r;
        },
        (e: unknown) => {
            if (archiveCache?.result === result) archiveCache = null;
            throw e;
        },
    );
    archiveCache = { at: Date.now(), result };
    return result;
}

/** Seed the memo with a fresh, fully successful load (e.g. from the archive page). */
export function primeArchiveCache(result: ArchiveResult): ArchiveResult {
    if (!result.errors.length) archiveCache = { at: Date.now(), result: Promise.resolve(result) };
    return result;
}

export type DetailResult = { kind: 'exhibit'; exhibitId: string } | { kind: 'item'; item: ArchiveItem } | { kind: 'missing' };

export async function fetchDetail(id: string): Promise<DetailResult> {
    if (findExhibit(id)) return { kind: 'exhibit', exhibitId: id };
    if (id.startsWith(NOTE_PREFIX)) {
        const { db, mod } = await firestore();
        const snap = await mod.getDoc(mod.doc(db, 'collections', id.slice(NOTE_PREFIX.length)));
        return snap.exists() ? { kind: 'item', item: fromFirestore(snap.id, snap.data() as FirestoreCollection) } : { kind: 'missing' };
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { kind: 'missing' };
    const { data, error } = await publicDb().from('published_articles').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { kind: 'item', item: fromPublished(data as PublishedRow) } : { kind: 'missing' };
}

export function citationFor(item: ArchiveItem, siteUrl: string): string {
    const names = item.authors.map((a) => a.name).join(', ') || 'IT Museum';
    const year = item.date ? new Date(item.date).getFullYear() : 'n.d.';
    return `${names} (${year}). ${item.title}. IT Museum — India, CHRIST (Deemed to be University) & DataArt. ${siteUrl}/article/${item.id}`;
}

export function relatedItems(all: ArchiveItem[], item: ArchiveItem, max = 3): ArchiveItem[] {
    const tags = new Set(item.tags.map((t) => t.toLowerCase()));
    return all
        .filter((x) => x.id !== item.id)
        .map((x) => ({ x, score: x.tags.filter((t) => tags.has(t.toLowerCase())).length + (x.kind === item.kind ? 0.5 : 0) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, max)
        .map((s) => s.x);
}
