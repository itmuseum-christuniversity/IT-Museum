import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { filterArchive, topTags } from '../pages/Collection';
import { fromPublished, type ArchiveItem } from '../services/archive';
import { mapSection } from '../services/sections';

const fetchDetail = vi.fn();
const fetchArchive = vi.fn();
vi.mock('../services/archive', async (orig) => ({
    ...(await orig<typeof import('../services/archive')>()),
    fetchDetail: (...a: unknown[]) => fetchDetail(...a),
    fetchArchive: (...a: unknown[]) => fetchArchive(...a),
}));

const item = (over: Partial<ArchiveItem>): ArchiveItem => ({
    id: 'id',
    kind: 'article',
    title: 'Untitled',
    summary: '',
    authors: [],
    tags: [],
    date: null,
    dateLabel: 'Published',
    ...over,
});

describe('archive discovery', () => {
    const items = [
        item({ id: 'a', title: 'TIFRAC and early machines', tags: ['Mainframes'], date: '2025-01-01' }),
        item({ id: 'b', title: 'Software exports in the 1990s', tags: ['Industry'], date: '2026-03-01' }),
        item({ id: 'kolam', kind: 'exhibit', title: 'The Art of Kolam', tags: ['Ethnomathematics'] }),
    ];

    it('searches titles fuzzily', () => {
        expect(filterArchive(items, { q: 'tifrak', kind: '', tag: '', sort: 'newest' }).map((i) => i.id)).toEqual(['a']);
    });
    it('filters by type and tag, case-insensitively', () => {
        expect(filterArchive(items, { q: '', kind: 'exhibit', tag: '', sort: 'newest' }).map((i) => i.id)).toEqual(['kolam']);
        expect(filterArchive(items, { q: '', kind: '', tag: 'industry', sort: 'newest' }).map((i) => i.id)).toEqual(['b']);
    });
    it('sorts newest first with exhibits leading, or by title', () => {
        expect(filterArchive(items, { q: '', kind: '', tag: '', sort: 'newest' }).map((i) => i.id)).toEqual(['kolam', 'b', 'a']);
        expect(filterArchive(items, { q: '', kind: '', tag: '', sort: 'title' }).map((i) => i.id)).toEqual(['b', 'kolam', 'a']);
    });
    it('lists top tags', () => {
        expect(topTags(items)).toEqual(['Ethnomathematics', 'Industry', 'Mainframes']);
    });
    it('labels legacy records without a publication date honestly', () => {
        const legacy = fromPublished({
            id: '1', reference_code: 'ITM-LEGACY-1', title: 't', author_name: 'A, B', authors: null, description: 'd', tags: null,
            created_at: '2025-05-01T00:00:00Z', published_at: null, pdf_url: 'javascript:alert(1)', external_document_url: null,
        });
        expect(legacy.dateLabel).toBe('Added');
        expect(legacy.authors.map((a) => a.name)).toEqual(['A', 'B']);
        expect(legacy.pdfUrl).toBeNull(); // unsafe URL dropped
    });
});

describe('public article route', () => {
    it('shows not-found (not the draft) when a record is not in the published view', async () => {
        fetchDetail.mockResolvedValueOnce({ kind: 'missing' });
        const Article = (await import('../pages/Article')).default;
        render(
            <MemoryRouter initialEntries={['/article/2b1c7a52-3f0e-4c4e-9a9b-2d8b0f1e9a11']}>
                <Routes>
                    <Route path="/article/:id" element={<Article />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByRole('heading', { name: 'Record not found' })).toBeInTheDocument();
        expect(screen.getByText(/not be published yet/i)).toBeInTheDocument();
    });

    it('renders a published article with citation, metadata and a download link', async () => {
        fetchDetail.mockResolvedValueOnce({
            kind: 'item',
            item: item({ id: 'p1', title: 'Published work', summary: 'Abstract text', authors: [{ name: 'Asha Rao', designation: 'Professor' }], tags: ['History'], date: '2026-02-01T00:00:00Z', reference: 'ITM-2026-AAAAAA', pdfUrl: 'https://x.supabase.co/storage/v1/object/public/articles/p.pdf' }),
        });
        fetchArchive.mockResolvedValue({ items: [], errors: [] });
        const Article = (await import('../pages/Article')).default;
        render(
            <MemoryRouter initialEntries={['/article/p1']}>
                <Routes>
                    <Route path="/article/:id" element={<Article />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByRole('heading', { level: 1, name: 'Published work' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /download pdf/i })).toHaveAttribute('href', expect.stringContaining('/public/articles/'));
        expect(screen.getByText(/Asha Rao \(2026\)\. Published work\./)).toBeInTheDocument();
        expect(screen.queryByText(/secure view/i)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/collection?tag=History');
    });

    it('archive page reports partial failures but still lists other sources', async () => {
        fetchArchive.mockResolvedValueOnce({ items: [item({ id: 'kolam', kind: 'exhibit', title: 'The Art of Kolam' })], errors: [{ source: 'articles', message: 'Research articles could not be loaded.' }] });
        const Collection = (await import('../pages/Collection')).default;
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/collection']}>
                <Routes>
                    <Route path="/collection" element={<Collection />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(await screen.findByText(/research articles could not be loaded/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'The Art of Kolam' })).toHaveAttribute('href', '/article/kolam');
        await user.type(screen.getByLabelText(/search the archive/i), 'zzzz');
        expect(await screen.findByText(/no matching records/i)).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('0 results for “zzzz”');
    });
});

describe('homepage CMS sections', () => {
    it('maps snake_case columns and strips scripts and unsafe links', () => {
        const s = mapSection({ id: '1', title: 'T', content: '<p onclick="x()">Hi<script>alert(1)</script><a href="javascript:x">l</a></p>', image_url: 'https://img/x.png', pdf_url: 'https://f/x.pdf' });
        expect(s.imageUrl).toBe('https://img/x.png');
        expect(s.pdfUrl).toBe('https://f/x.pdf');
        expect(s.html).not.toMatch(/script|onclick|javascript/);
        expect(s.html).toContain('Hi');
    });
});
