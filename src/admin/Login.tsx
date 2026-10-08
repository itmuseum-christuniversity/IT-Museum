import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuth } from './auth';

export default function Login() {
    usePageMeta('Staff sign-in');
    const { signIn, resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    return (
        <main id="main" className="admin-auth">
            <div className="admin-auth__card card">
                <LockKeyhole size={28} aria-hidden="true" color="var(--gold-700)" />
                <h1 className="h2">Staff sign-in</h1>
                <p className="muted">For the IT Museum editorial admin and review panels.</p>
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setError(null);
                        setInfo(null);
                        setBusy(true);
                        try {
                            await signIn(email, password);
                        } catch (err) {
                            setError((err as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <TextField label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
                    <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
                        {busy && <span className="spinner" aria-hidden="true" />} Sign in
                    </button>
                </form>
                <button
                    type="button"
                    className="link-button"
                    style={{ marginTop: 'var(--space-4)' }}
                    onClick={async () => {
                        setError(null);
                        if (!email.trim()) return setError('Enter your email above, then choose “Forgot password”.');
                        try {
                            await resetPassword(email);
                        } catch {
                            /* Do not reveal whether the account exists. */
                        }
                        setInfo('If that address has a staff account, a password-reset email is on its way.');
                    }}
                >
                    Forgot password?
                </button>
                <p className="subtle" style={{ marginTop: 'var(--space-5)' }}>
                    <Link to="/">← Back to the museum website</Link>
                </p>
            </div>
        </main>
    );
}
