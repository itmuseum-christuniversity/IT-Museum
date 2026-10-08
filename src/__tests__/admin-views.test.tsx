import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import { MAX_REASON_LENGTH } from '../../supabase/functions/_shared/workflow';
import { MAX_AUTHOR_CREDIT_CHARS, MAX_DESCRIPTION_CHARS } from '../../supabase/functions/_shared/validation';
import type { ArticleDetail } from '../admin/api';

// The views are rendered directly (no Firebase / AuthProvider); `useStaff` is the only auth surface they use.
const api = {
    queue: vi.fn(),
    staffList: vi.fn(),
    article: vi.fn(),
    transition: vi.fn(),
    note: vi.fn(),
    stageFinalPdf: vi.fn(),
    updateMetadata: vi.fn(),
    assign: vi.fn(),
    suggestTags: vi.fn(),
};
const me = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@christuniversity.in', display_name: 'Admin', role: 'admin' as const };
vi.mock('../admin/auth', () => ({ useStaff: () => ({ me, api }) }));

const { default: Queue } = await import('../admin/Queue');
const { default: Workspace } = await import('../admin/Workspace');

function deferred<T>() {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function detail(over: Partial<ArticleDetail['article']> = {}, checklist: ArticleDetail['checklist'] = []): ArticleDetail {
    return {
        article: {
            id: 'a1',
            reference_code: 'ITM-2026-ABC123',
            status: 'SUBMITTED',
            version: 3,
            title: 'Early computing at Christ',
            description: 'A history of early computing.',
            author_name: 'Asha Rao',
            tags: [],
            suggested_tags: [],
            authors: null,
            institution_email: 'asha@christuniversity.in',
            author_designations: 'Student',
            created_at: '2026-01-01T00:00:00Z',
            stage_entered_at: '2026-01-02T00:00:00Z',
            ...over,
        } as unknown as ArticleDetail['article'],
        files: { similarityUrl: null, aiUrl: null, stagedPdfUrl: null, publishedPdfUrl: null },
        events: [],
        checklist,
    };
}

function renderWorkspace() {
    return render(
        <MemoryRouter initialEntries={['/admin/articles/a1']}>
            <Routes>
                <Route path="/admin/articles/:id" element={<Workspace />} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.queue.mockResolvedValue([]);
    api.staffList.mockResolvedValue([]);
});

describe('Queue URL filters', () => {
    function renderQueue(search: string) {
        return render(
            <MemoryRouter initialEntries={[`/admin/queue${search}`]}>
                <Queue />
            </MemoryRouter>,
        );
    }

    it('ignores garbage dates, ages and assignees instead of throwing a RangeError', async () => {
        const { container } = renderQueue('?from=garbage&to=nope&age=abc&minAgeDays=abc&assignee=not-a-uuid');
        expect(await screen.findByText(/no articles match these filters/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();

        const query = api.queue.mock.calls[0][0];
        expect(query.submittedFrom).toBeUndefined();
        expect(query.submittedTo).toBeUndefined();
        expect(query.minAgeDays).toBeUndefined();
        expect(query.assignee).toBeUndefined();

        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
        expect(results.violations).toEqual([]);
    });

    it('passes valid filters through', async () => {
        renderQueue('?from=2026-01-05&to=2026-01-10&age=7&assignee=me&status=IT_REVIEW');
        await screen.findByText(/no articles match these filters/i);
        expect(api.queue).toHaveBeenCalledWith({
            statuses: ['IT_REVIEW'],
            search: undefined,
            assignee: 'me',
            minAgeDays: 7,
            submittedFrom: new Date('2026-01-05').toISOString(),
            submittedTo: new Date('2026-01-10T23:59:59').toISOString(),
        });
    });
});

describe('Workspace', () => {
    it('shows Refreshing… on a disabled button and keeps typed input while the reload is pending', async () => {
        const reload = deferred<ArticleDetail>();
        api.article.mockResolvedValueOnce(detail()).mockReturnValueOnce(reload.promise);
        const u = userEvent.setup();
        renderWorkspace();

        const note = await screen.findByLabelText(/add a note for staff/i);
        await u.type(note, 'Draft note in progress');
        await u.click(screen.getByRole('button', { name: 'Refresh' }));

        const busy = await screen.findByRole('button', { name: /refreshing…/i });
        expect(busy).toBeDisabled();
        expect(screen.getByLabelText(/add a note for staff/i)).toHaveValue('Draft note in progress');
        expect(screen.getByRole('heading', { level: 1, name: 'Early computing at Christ' })).toBeInTheDocument();

        reload.resolve(detail());
        expect(await screen.findByRole('button', { name: 'Refresh' })).toBeEnabled();
        expect(screen.getByLabelText(/add a note for staff/i)).toHaveValue('Draft note in progress');
    });

    it('links an author email only when it is a single valid address', async () => {
        api.article.mockResolvedValue(
            detail({
                authors: [
                    { name: 'Asha Rao', email: 'asha@christuniversity.in', designation: 'Student' },
                    { name: 'Bad Entry', email: 'a@b.co,c.de', designation: '' },
                ],
            }),
        );
        renderWorkspace();
        const good = await screen.findByRole('link', { name: 'asha@christuniversity.in' });
        expect(good).toHaveAttribute('href', 'mailto:asha@christuniversity.in');
        expect(screen.getByText('a@b.co,c.de')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'a@b.co,c.de' })).not.toBeInTheDocument();
    });

    it('rejects a decision reason over the cap without submitting', async () => {
        api.article.mockResolvedValue(detail());
        const u = userEvent.setup();
        renderWorkspace();
        await u.click(await screen.findByRole('radio', { name: /^reject/i }));
        const reason = screen.getByLabelText(/reason for rejection/i);

        fireEvent.change(reason, { target: { value: 'x'.repeat(MAX_REASON_LENGTH + 1) } });
        await u.click(screen.getByRole('button', { name: /^reject…$/i }));
        expect(await screen.findByText(`Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`)).toBeInTheDocument();
        expect(api.transition).not.toHaveBeenCalled();

        // Exactly at the cap is accepted (the error clears and the confirmation step opens).
        fireEvent.change(reason, { target: { value: 'x'.repeat(MAX_REASON_LENGTH) } });
        await u.click(screen.getByRole('button', { name: /^reject…$/i }));
        await waitFor(() => expect(screen.queryByText(/characters or fewer/i)).not.toBeInTheDocument());
        expect(api.transition).not.toHaveBeenCalled();
    });
});

describe('PublishPanel (through Workspace, final approval)', () => {
    it('keeps unsaved public-detail edits when a PDF upload triggers a reload', async () => {
        const reload = deferred<ArticleDetail>();
        const final = detail({ status: 'FINAL_APPROVAL' });
        api.article.mockResolvedValueOnce(final).mockReturnValueOnce(reload.promise);
        api.stageFinalPdf.mockResolvedValue({});
        const u = userEvent.setup();
        renderWorkspace();

        const title = await screen.findByRole('textbox', { name: /^title/i });
        const abstract = screen.getByLabelText(/^abstract/i);
        await u.clear(title);
        await u.type(title, 'Edited title');
        await u.type(abstract, ' Extra sentence.');

        await u.upload(screen.getByLabelText(/upload the final pdf/i), new File(['%PDF-1.4'], 'final.pdf', { type: 'application/pdf' }));
        await u.click(screen.getByRole('button', { name: /upload pdf/i }));

        await waitFor(() => expect(api.stageFinalPdf).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(api.article).toHaveBeenCalledTimes(2));
        expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Edited title');
        expect(screen.getByLabelText(/^abstract/i)).toHaveValue('A history of early computing. Extra sentence.');

        reload.resolve({ ...final, files: { ...final.files, stagedPdfUrl: 'https://files.test/staged.pdf' } });
        expect(await screen.findByLabelText(/replace the final pdf/i)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Edited title');
        expect(screen.getByLabelText(/^abstract/i)).toHaveValue('A history of early computing. Extra sentence.');
    });

    it('enforces the length limits on the public detail fields', async () => {
        api.article.mockResolvedValue(detail({ status: 'FINAL_APPROVAL' }));
        const u = userEvent.setup();
        renderWorkspace();
        const title = await screen.findByRole('textbox', { name: /^title/i });
        expect(title).toHaveAttribute('maxlength', '300');
        expect(screen.getByLabelText(/^author credit/i)).toHaveAttribute('maxlength', String(MAX_AUTHOR_CREDIT_CHARS));
        expect(screen.getByLabelText(/^abstract/i)).toHaveAttribute('maxlength', String(MAX_DESCRIPTION_CHARS));

        await u.clear(title);
        await u.click(title);
        await u.paste('t'.repeat(400));
        expect((title as HTMLInputElement).value).toHaveLength(300);
    });
});
