import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { ApiError } from '../lib/api';
import { staffApi, type Me, type StaffApi } from './api';

type AuthState =
    | { status: 'loading' }
    | { status: 'signed-out' }
    | { status: 'denied'; email: string | null; message: string }
    /** Signed in, but the server will not link an unverified email to a staff record. */
    | { status: 'unverified'; email: string | null }
    | { status: 'error'; message: string }
    | { status: 'ready'; user: User; me: Me };

interface AuthContextValue {
    state: AuthState;
    api: StaffApi;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    refreshMe: () => void;
    /** Send (or re-send) Firebase's verification email to the signed-in user. */
    sendVerificationEmail: () => Promise<void>;
    /** Reload the Firebase user and force a fresh ID token (new email_verified claim), then re-check access. */
    recheckVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyAuthError(code: string): string {
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
            return 'The email or password is incorrect.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Wait a few minutes, or reset your password.';
        case 'auth/network-request-failed':
            return 'We could not reach the sign-in service. Check your connection.';
        default:
            return 'Sign-in failed. Please try again.';
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ status: 'loading' });
    const [user, setUser] = useState<User | null>(null);
    const [attempt, setAttempt] = useState(0);

    const getToken = useCallback(async () => {
        const { auth } = await firebaseAuth();
        const u = auth.currentUser;
        if (!u) throw new ApiError('Your session has ended. Sign in again.', 401, 'UNAUTHENTICATED');
        return u.getIdToken();
    }, []);
    const api = useMemo(() => staffApi(getToken), [getToken]);

    useEffect(() => {
        let unsub: (() => void) | undefined;
        let alive = true;
        firebaseAuth()
            .then(({ auth, mod }) => {
                if (!alive) return;
                unsub = mod.onAuthStateChanged(auth, (u) => {
                    setUser(u);
                    if (!u) setState({ status: 'signed-out' });
                });
            })
            .catch((e: Error) => setState({ status: 'error', message: e.message }));
        return () => {
            alive = false;
            unsub?.();
        };
    }, []);

    // Resolve the explicit staff record (role) from the server — never from the email text.
    useEffect(() => {
        if (!user) return;
        let alive = true;
        setState({ status: 'loading' });
        api.me().then(
            (me) => alive && setState({ status: 'ready', user, me }),
            (e: unknown) => {
                if (!alive) return;
                if (e instanceof ApiError && e.code === 'EMAIL_UNVERIFIED') setState({ status: 'unverified', email: user.email });
                else if (e instanceof ApiError && (e.status === 403 || e.status === 401)) setState({ status: 'denied', email: user.email, message: e.message });
                else setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load your profile.' });
            },
        );
        return () => {
            alive = false;
        };
    }, [user, api, attempt]);

    const value = useMemo<AuthContextValue>(
        () => ({
            state,
            api,
            async signIn(email, password) {
                const { auth, mod } = await firebaseAuth();
                try {
                    await mod.signInWithEmailAndPassword(auth, email.trim(), password);
                } catch (e) {
                    throw new Error(friendlyAuthError((e as { code?: string }).code ?? ''), { cause: e });
                }
            },
            async signOut() {
                const { auth, mod } = await firebaseAuth();
                await mod.signOut(auth);
            },
            async resetPassword(email) {
                const { auth, mod } = await firebaseAuth();
                await mod.sendPasswordResetEmail(auth, email.trim());
            },
            refreshMe: () => setAttempt((a) => a + 1),
            async sendVerificationEmail() {
                const { auth, mod } = await firebaseAuth();
                const u = auth.currentUser;
                if (!u) throw new Error('Your session has ended. Sign in again.');
                try {
                    await mod.sendEmailVerification(u);
                } catch (e) {
                    const code = (e as { code?: string }).code ?? '';
                    const message =
                        code === 'auth/too-many-requests'
                            ? 'A verification email was sent recently. Check your inbox (and spam folder), or wait a few minutes before asking again.'
                            : code === 'auth/network-request-failed'
                              ? friendlyAuthError(code)
                              : 'We could not send the verification email. Please try again.';
                    throw new Error(message, { cause: e });
                }
            },
            async recheckVerification() {
                const { auth } = await firebaseAuth();
                const u = auth.currentUser;
                if (!u) throw new Error('Your session has ended. Sign in again.');
                await u.reload();
                if (!u.emailVerified) throw new Error('Your email address is not verified yet. Open the link in the verification email, then try again.');
                // The old token still carries email_verified=false until it is refreshed.
                await u.getIdToken(true);
                setAttempt((a) => a + 1);
            },
        }),
        [state, api],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}

/** Narrowed helper for pages rendered only when signed in. */
export function useStaff() {
    const { state, api } = useAuth();
    if (state.status !== 'ready') throw new Error('useStaff used outside an authenticated area');
    return { me: state.me, api };
}
