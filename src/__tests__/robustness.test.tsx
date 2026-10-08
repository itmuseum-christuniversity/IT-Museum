import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { mailtoHref } from '../lib/format';
import { fetchArchiveCached, primeArchiveCache, type ArchiveResult } from '../services/archive';
import SubmissionStatus from '../pages/SubmissionStatus';

const lookupStatus = vi.fn();
const resubmitRevision = vi.fn();
vi.mock('../services/submissions', () => ({
    lookupStatus: (...a: unknown[]) => lookupStatus(...a),
    resubmitRevision: (...a: unknown[]) => resubmitRevision(...a),
}));

function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('useAsync stale-while-revalidate', () => {
    it('keeps the previous data while retry() reloads, and only shows loading on the first load', async () => {
        const second = deferred<string>();
        const loader = vi.fn().mockResolvedValueOnce('first').mockReturnValueOnce(second.promise);
        const { result } = renderHook(() => useAsync(loader, ['a']));
        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('ready'));

        act(() => result.current.retry());
        expect(result.current).toMatchObject({ status: 'ready', data: 'first', refreshing: true });

        await act(async () => second.resolve('second'));
        expect(result.current).toMatchObject({ status: 'ready', data: 'second' });
        expect((result.current as { refreshing?: boolean }).refreshing).toBeUndefined();
    });

    it('still starts from loading when the deps change (a different resource)', async () => {
        const next = deferred<string>();
        const loader = vi.fn((id: string) => (id === 'a' ? Promise.resolve('A') : next.promise));
        const { result, rerender } = renderHook(({ id }) => useAsync(() => loader(id), [id]), { initialProps: { id: 'a' } });
        await waitFor(() => expect(result.current.status).toBe('ready'));
        rerender({ id: 'b' });
        expect(result.current.status).toBe('loading');
        await act(async () => next.resolve('B'));
        expect(result.current).toMatchObject({ status: 'ready', data: 'B' });
    });

    it('surfaces a failed revalidation as an error and recovers through loading on retry', async () => {
        const loader = vi.fn().mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('again');
        const { result } = renderHook(() => useAsync(loader, []));
        await waitFor(() => expect(result.current.status).toBe('ready'));
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.status).toBe('error'));
        act(() => result.current.retry());
        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', data: 'again' }));
    });
});

describe('ErrorBoundary', () => {
    it('shows an accessible recovery message instead of a blank page', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        function Boom(): never {
            throw new Error('render failed');
        }
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: /something went wrong/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload the page/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /home page/i })).toHaveAttribute('href', '/');
        spy.mockRestore();
    });

    it('explains a failed lazy chunk and clears when the route key changes', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let fail = true;
        function Maybe() {
            if (fail) throw new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
            return <p>Recovered</p>;
        }
        const { rerender } = render(
            <ErrorBoundary resetKey="/a">
                <Maybe />
            </ErrorBoundary>,
        );
        expect(screen.getByRole('heading', { name: /could not be loaded/i })).toBeInTheDocument();
        fail = false;
        rerender(
            <ErrorBoundary resetKey="/b">
                <Maybe />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Recovered')).toBeInTheDocument();
        spy.mockRestore();
    });
});

describe('mailtoHref', () => {
    it('links exactly one valid address, encoded', () => {
        expect(mailtoHref('asha@christuniversity.in')).toBe('mailto:asha@christuniversity.in');
        expect(mailtoHref('a+b@example.com')).toBe('mailto:a%2Bb@example.com');
    });
    it('refuses lists, query strings and junk', () => {
        for (const bad of ['a@b.co,c@d.co', 'a@b.co?subject=x&bcc=evil@x.co', 'a@b.co;c@d.co', '', null, undefined]) {
            expect(mailtoHref(bad)).toBeNull();
        }
    });
});

describe('archive cache', () => {
    const result = (id: string): ArchiveResult => ({ items: [{ id, kind: 'article', title: id, summary: '', authors: [], tags: [], date: null, dateLabel: 'Published' }], errors: [] });

    it('serves repeated article views from one load', async () => {
        primeArchiveCache(result('seed'));
        const load = vi.fn().mockResolvedValue(result('a'));
        expect((await fetchArchiveCached(load)).items[0].id).toBe('seed');
        expect((await fetchArchiveCached(load)).items[0].id).toBe('seed');
        expect(load).not.toHaveBeenCalled();
    });

    it('does not keep a partial or rejected load', async () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(Date.now() + 10 * 60 * 1000); // expire the seeded entry
            const partial = vi.fn().mockResolvedValue({ items: [], errors: [{ source: 'articles', message: 'down' }] });
            await fetchArchiveCached(partial);
            const retry = vi.fn().mockResolvedValue(result('b'));
            expect((await fetchArchiveCached(retry)).items[0].id).toBe('b');
            expect(retry).toHaveBeenCalledTimes(1);

            vi.setSystemTime(Date.now() + 10 * 60 * 1000);
            const failing = vi.fn().mockRejectedValue(new Error('net'));
            await expect(fetchArchiveCached(failing)).rejects.toThrow('net');
            const ok = vi.fn().mockResolvedValue(result('c'));
            expect((await fetchArchiveCached(ok)).items[0].id).toBe('c');
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('SubmissionStatus revision key', () => {
    it('sends the revision with the key that was looked up, not whatever is in the input now', async () => {
        lookupStatus.mockResolvedValueOnce({
            reference: 'ITM-2026-ABC123',
            title: 'T',
            status: 'CHANGES_REQUESTED',
            label: 'Changes requested',
            description: 'd',
            reason: 'Please fix the references.',
            submittedAt: '2026-01-01T00:00:00Z',
            canResubmit: true,
            publishedId: null,
            history: [],
        });
        resubmitRevision.mockResolvedValueOnce({ reference: 'ITM-2026-ABC123', title: 'T', status: 'SUBMITTED', label: 'Submitted', description: 'd', reason: null, submittedAt: '2026-01-01T00:00:00Z', canResubmit: false, publishedId: null, history: [] });
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/submission/status?ref=ITM-2026-ABC123']}>
                <SubmissionStatus />
            </MemoryRouter>,
        );
        await user.type(screen.getByLabelText(/access key/i), 'right-key');
        await user.click(screen.getByRole('button', { name: /check status/i }));
        const note = await screen.findByLabelText(/what did you change/i);

        await user.type(screen.getByLabelText(/access key/i), '-typo');
        await user.type(note, 'Fixed the references and the intro.');
        await user.click(screen.getByRole('button', { name: /send revision/i }));

        await waitFor(() => expect(resubmitRevision).toHaveBeenCalled());
        expect(resubmitRevision.mock.calls[0][1]).toBe('right-key');
    });
});
