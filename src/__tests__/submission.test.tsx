import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import Submission from '../pages/Submission';
import { ApiError } from '../lib/api';

const submitArticle = vi.fn();
vi.mock('../services/submissions', () => ({ submitArticle: (...args: unknown[]) => submitArticle(...args) }));

const pdf = (name: string) => new File(['%PDF-1.7 test'], name, { type: 'application/pdf' });

async function fillToReview(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /start submission/i }));
    await user.type(screen.getByLabelText(/your email for updates/i), 'author@christuniversity.in');
    await user.type(screen.getByLabelText(/full name/i), 'Asha Rao');
    await user.type(screen.getByLabelText(/institutional email/i), 'asha@christuniversity.in');
    await user.type(screen.getByLabelText(/designation/i), 'Associate Professor');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(screen.getByLabelText(/article title/i), 'The TIFRAC and Indian computing');
    await user.type(
        screen.getByLabelText(/description/i),
        'This article traces the design and construction of TIFRAC and its influence on computing education and engineering practice across India in the following decades.',
    );
    await user.type(screen.getByLabelText(/keywords/i), 'TIFRAC, computing history');
    await user.type(screen.getByLabelText(/google doc or drive link/i), 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.upload(screen.getByLabelText(/similarity/i), pdf('sim.pdf'));
    await user.upload(screen.getByLabelText(/ai content detection/i), pdf('ai.pdf'));
    await user.click(screen.getByRole('button', { name: /continue/i }));
}

/** After a reload the text fields come back from the saved draft; only the files must be chosen again. */
async function fillToReviewFromDraft(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /start submission/i }));
    expect(screen.getByLabelText(/your email for updates/i)).toHaveValue('author@christuniversity.in');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.upload(screen.getByLabelText(/similarity/i), pdf('sim.pdf'));
    await user.upload(screen.getByLabelText(/ai content detection/i), pdf('ai.pdf'));
    await user.click(screen.getByRole('button', { name: /continue/i }));
}

beforeEach(() => {
    submitArticle.mockReset();
    sessionStorage.clear();
});

describe('guided submission', () => {
    it('blocks progress with an accessible error summary and invalid fields', async () => {
        const user = userEvent.setup();
        render(<Submission />, { wrapper: MemoryRouter });
        await user.click(screen.getByRole('button', { name: /start submission/i }));
        await user.click(screen.getByRole('button', { name: /continue/i }));
        const summary = screen.getByRole('alert');
        expect(summary).toHaveTextContent(/problems to fix/i);
        expect(summary).toHaveFocus();
        expect(screen.getByLabelText(/your email for updates/i)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/full name/i)).toHaveAccessibleDescription(/full name/i);
    });

    it('rejects a lookalike Google Docs host', async () => {
        const user = userEvent.setup();
        render(<Submission />, { wrapper: MemoryRouter });
        await user.click(screen.getByRole('button', { name: /start submission/i }));
        await user.type(screen.getByLabelText(/your email for updates/i), 'a@b.in');
        await user.type(screen.getByLabelText(/full name/i), 'A');
        await user.type(screen.getByLabelText(/institutional email/i), 'a@b.in');
        await user.type(screen.getByLabelText(/designation/i), 'Prof');
        await user.click(screen.getByRole('button', { name: /continue/i }));
        await user.type(screen.getByLabelText(/google doc or drive link/i), 'https://docs.google.com.evil.example/document/d/1AbCdEfGhIjKlMnOp');
        await user.click(screen.getByRole('button', { name: /continue/i }));
        expect(screen.getByLabelText(/google doc or drive link/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('keeps everything after a failed upload and succeeds on retry with a reference', async () => {
        const user = userEvent.setup();
        render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));

        submitArticle.mockRejectedValueOnce(new ApiError('We could not reach the server.', 0, 'NETWORK'));
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        expect(await screen.findByText(/we could not confirm your submission/i)).toBeInTheDocument();
        expect(screen.getByText(/will not send it twice/i)).toBeInTheDocument();
        expect(screen.getByText(/sim\.pdf, ai\.pdf/)).toBeInTheDocument(); // files still selected

        submitArticle.mockResolvedValueOnce({ id: 'x', reference: 'ITM-2026-ABC234', accessKey: 'secret-key' });
        await user.click(screen.getByRole('button', { name: /try again/i }));
        expect(await screen.findByText('ITM-2026-ABC234')).toBeInTheDocument();
        expect(screen.getByText('secret-key')).toBeInTheDocument();
        const [input, files, key] = submitArticle.mock.calls[1];
        expect(input).toMatchObject({ title: 'The TIFRAC and Indian computing', originalityConfirmed: true, authors: [{ name: 'Asha Rao' }] });
        expect(files.similarity.name).toBe('sim.pdf');
        // "Try again" reuses the first attempt's idempotency key, so a lost response cannot create a duplicate.
        expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(submitArticle.mock.calls[0][2]).toBe(key);
        // Success ends the attempt.
        expect(sessionStorage.getItem('itm-submission-attempt-v1')).toBeNull();
    });

    it('keeps the attempt key across a reload of the page', async () => {
        const user = userEvent.setup();
        const first = render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockRejectedValueOnce(new ApiError('We could not reach the server.', 0, 'NETWORK'));
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        await screen.findByText(/we could not confirm your submission/i);
        const key = submitArticle.mock.calls[0][2];
        first.unmount();

        render(<Submission />, { wrapper: MemoryRouter });
        await fillToReviewFromDraft(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockResolvedValueOnce({ id: 'x', reference: 'ITM-2026-ABC234', accessKey: 'secret-key', duplicate: true });
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        expect(await screen.findByText(/we already had this submission/i)).toBeInTheDocument();
        expect(submitArticle.mock.calls[1][2]).toBe(key);
    });

    it('on a recognised retry without a recoverable key, shows the reference and how to recover access', async () => {
        const user = userEvent.setup();
        const { container } = render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockResolvedValueOnce({ id: 'x', reference: 'ITM-2026-ABC234', accessKey: null, duplicate: true });
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        expect(await screen.findByText('ITM-2026-ABC234')).toBeInTheDocument();
        expect(screen.queryByText(/^access key$/i)).not.toBeInTheDocument();
        expect(screen.getByText(/your access key was shown on the first attempt/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'itmuseum@christuniversity.in' })).toHaveAttribute('href', expect.stringContaining('ITM-2026-ABC234'));
        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });

    it('explains a rate limit accessibly and keeps the form for later', async () => {
        const user = userEvent.setup();
        const { container } = render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockRejectedValueOnce(
            new ApiError('Too many submissions have been sent from your network recently. Please try again in about 12 minutes.', 429, 'RATE_LIMITED', null, 700),
        );
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/please wait before trying again/i);
        expect(alert).toHaveTextContent(/about 12 minutes/);
        expect(alert).toHaveTextContent(/nothing was submitted/i);
        expect(alert.parentElement).toHaveFocus();
        expect(screen.getByText(/sim\.pdf, ai\.pdf/)).toBeInTheDocument();
        const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
        // The attempt key is kept: nothing was created, so a later try is the same attempt.
        submitArticle.mockResolvedValueOnce({ id: 'x', reference: 'ITM-2026-ABC234', accessKey: 'k', duplicate: false });
        await user.click(screen.getByRole('button', { name: /try again/i }));
        await screen.findByText('ITM-2026-ABC234');
        expect(submitArticle.mock.calls[1][2]).toBe(submitArticle.mock.calls[0][2]);
    });

    it('starts a new attempt when the server says the details changed since the first one', async () => {
        const user = userEvent.setup();
        render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockRejectedValueOnce(new ApiError('This form was already submitted (reference ITM-2026-ABC234).', 409, 'IDEMPOTENCY_MISMATCH'));
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        expect(await screen.findByText(/ITM-2026-ABC234/)).toBeInTheDocument();
        submitArticle.mockResolvedValueOnce({ id: 'y', reference: 'ITM-2026-XYZ789', accessKey: 'k2', duplicate: false });
        await user.click(screen.getByRole('button', { name: /try again/i }));
        await screen.findByText('ITM-2026-XYZ789');
        expect(submitArticle.mock.calls[1][2]).not.toBe(submitArticle.mock.calls[0][2]);
    });

    it('sends server field errors back to the right step', async () => {
        const user = userEvent.setup();
        render(<Submission />, { wrapper: MemoryRouter });
        await fillToReview(user);
        await user.click(screen.getByLabelText(/i confirm that this article is original/i));
        submitArticle.mockRejectedValueOnce(new ApiError('Some fields need attention.', 422, 'VALIDATION', { title: 'Title already used.' }));
        await user.click(screen.getByRole('button', { name: /submit article/i }));
        expect(await screen.findByRole('heading', { name: /research details/i })).toBeInTheDocument();
        expect(screen.getAllByText('Title already used.').length).toBeGreaterThan(0);
    });
});
