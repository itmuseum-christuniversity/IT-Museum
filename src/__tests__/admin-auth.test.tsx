import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { ApiError } from '../lib/api';

vi.mock('../lib/config', () => ({
    config: { siteUrl: 'https://museum.test', functionsUrl: 'https://fn.test', supabaseAnonKey: 'anon', firebase: {} },
    isSupabaseConfigured: true,
    isFirebaseConfigured: true,
}));

// A fake Firebase user whose email starts unverified.
const user = {
    email: 'new.reviewer@christuniversity.in',
    emailVerified: false,
    reload: vi.fn(async () => {}),
    getIdToken: vi.fn(async (_force?: boolean) => 'token'),
};
const sendEmailVerification = vi.fn(async (_u: unknown) => {});
const auth = { currentUser: user };
vi.mock('../lib/firebase', () => ({
    firebaseAuth: async () => ({
        auth,
        mod: {
            onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
                cb(user);
                return () => {};
            },
            sendEmailVerification: (u: unknown) => sendEmailVerification(u),
            signOut: vi.fn(async () => {}),
        },
    }),
}));

const me = vi.fn();
vi.mock('../admin/api', () => ({ staffApi: () => ({ me: () => me() }) }));

const { default: AdminApp } = await import('../admin/AdminApp');

function renderAdmin() {
    return render(
        <MemoryRouter>
            <AdminApp />
        </MemoryRouter>,
    );
}

beforeEach(() => {
    user.emailVerified = false;
    user.reload.mockClear();
    user.getIdToken.mockClear();
    sendEmailVerification.mockClear();
    me.mockReset();
});

describe('staff sign-in with an unverified email', () => {
    it('explains the problem and sends a verification email instead of a generic failure', async () => {
        me.mockRejectedValue(new ApiError('Verify your email address before signing in to the review portal.', 403, 'EMAIL_UNVERIFIED'));
        const u = userEvent.setup();
        const { container } = renderAdmin();

        expect(await screen.findByRole('heading', { level: 1, name: /verify your email address/i })).toBeInTheDocument();
        expect(screen.queryByText(/not an active staff member/i)).not.toBeInTheDocument();

        await u.click(screen.getByRole('button', { name: /send verification email/i }));
        expect(sendEmailVerification).toHaveBeenCalledWith(user);
        expect(await screen.findByText(/verification email sent to new\.reviewer@christuniversity\.in/i)).toBeInTheDocument();
        expect(screen.getByText(/verification email sent/i).closest('[role="status"]')).not.toBeNull();

        const results = await axe.run(container, { rules: { region: { enabled: false } } });
        expect(results.violations).toEqual([]);
    });

    it('says so when the user re-checks before verifying, without calling the server again', async () => {
        me.mockRejectedValue(new ApiError('x', 403, 'EMAIL_UNVERIFIED'));
        const u = userEvent.setup();
        renderAdmin();
        await u.click(await screen.findByRole('button', { name: /i have verified my email/i }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/not verified yet/i);
        expect(user.reload).toHaveBeenCalled();
        expect(me).toHaveBeenCalledTimes(1);
    });

    it('refreshes the token and re-checks access once verified', async () => {
        me.mockRejectedValueOnce(new ApiError('x', 403, 'EMAIL_UNVERIFIED')).mockRejectedValueOnce(new ApiError('No access', 403, 'NOT_STAFF'));
        const u = userEvent.setup();
        renderAdmin();
        const button = await screen.findByRole('button', { name: /i have verified my email/i });
        user.emailVerified = true;
        await u.click(button);
        expect(user.getIdToken).toHaveBeenCalledWith(true);
        expect(await screen.findByRole('heading', { name: /no access to the review portal/i })).toBeInTheDocument();
        expect(me).toHaveBeenCalledTimes(2);
    });

    it('treats a 503 (sign-in check unavailable) as retryable, not as signed out or denied', async () => {
        me.mockRejectedValue(new ApiError('Sign-in could not be checked right now. Please try again in a moment.', 503, 'AUTH_UNAVAILABLE'));
        renderAdmin();
        expect(await screen.findByRole('heading', { name: /the portal could not load/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
});
