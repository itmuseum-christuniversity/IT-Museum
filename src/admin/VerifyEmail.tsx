import { useState, type CSSProperties } from 'react';
import { MailCheck } from 'lucide-react';
import { Alert } from '../components/ui/Alert';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from './auth';

/**
 * Shown when the signed-in Firebase account has not verified its email.
 * The server will not link an unverified address to a staff record, so the
 * user must verify first; this screen lets them send the email and re-check.
 */
export default function VerifyEmail({ email }: { email: string | null }) {
    usePageMeta('Verify your email');
    const { sendVerificationEmail, recheckVerification, signOut } = useAuth();
    const [busy, setBusy] = useState<'send' | 'check' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    async function run(kind: 'send' | 'check', fn: () => Promise<void>, success?: string) {
        setBusy(kind);
        setError(null);
        setInfo(null);
        try {
            await fn();
            if (success) setInfo(success);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        } finally {
            setBusy(null);
        }
    }

    return (
        <main id="main" className="admin-auth">
            <div className="admin-auth__card card">
                <MailCheck size={28} aria-hidden="true" color="var(--gold-700)" />
                <h1 className="h2">Verify your email address</h1>
                <p className="muted">
                    Before {email ?? 'this account'} can be connected to the review portal, confirm that you own the address. Send yourself a verification
                    email, open the link in it, then choose “I have verified my email”.
                </p>
                {error && (
                    <Alert tone="danger" role="alert" className="mb-5">
                        <p>{error}</p>
                    </Alert>
                )}
                {info && (
                    <Alert tone="success" role="status" className="mb-5">
                        <p>{info}</p>
                    </Alert>
                )}
                <div className="stack" style={{ '--stack-gap': 'var(--space-3)' } as CSSProperties}>
                    <button
                        type="button"
                        className="btn btn--primary btn--block"
                        disabled={busy !== null}
                        onClick={() => run('send', sendVerificationEmail, `Verification email sent to ${email ?? 'your address'}. Check your inbox (and spam folder).`)}
                    >
                        {busy === 'send' && <span className="spinner" aria-hidden="true" />} Send verification email
                    </button>
                    <button type="button" className="btn btn--block" disabled={busy !== null} onClick={() => run('check', recheckVerification)}>
                        {busy === 'check' && <span className="spinner" aria-hidden="true" />} I have verified my email
                    </button>
                    <button type="button" className="link-button" onClick={signOut}>
                        Sign out
                    </button>
                </div>
            </div>
        </main>
    );
}
