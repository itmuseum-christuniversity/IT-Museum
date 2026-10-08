import { Route, Routes } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './toast';
import Login from './Login';
import VerifyEmail from './VerifyEmail';
import AdminLayout from './AdminLayout';
import Overview from './Overview';
import Queue from './Queue';
import Workspace from './Workspace';
import ArchiveManager from './ArchiveManager';
import StaffManager from './StaffManager';
import { EmptyState } from '../components/ui/EmptyState';
import { isFirebaseConfigured, isSupabaseConfigured } from '../lib/config';
import NotFound from '../pages/NotFound';

function Gate() {
    const { state, signOut, refreshMe } = useAuth();
    if (state.status === 'loading') {
        return (
            <main id="main" className="admin-auth" aria-busy="true">
                <p role="status" className="cluster">
                    <span className="spinner" aria-hidden="true" /> Checking your access…
                </p>
            </main>
        );
    }
    if (state.status === 'signed-out') return <Login />;
    if (state.status === 'unverified') return <VerifyEmail email={state.email} />;
    if (state.status === 'denied' || state.status === 'error') {
        return (
            <main id="main" className="admin-auth">
                <div className="admin-auth__card">
                    <EmptyState
                        title={state.status === 'denied' ? 'No access to the review portal' : 'The portal could not load'}
                        icon={<ShieldAlert size={32} aria-hidden="true" />}
                        action={
                            <div className="cluster" style={{ justifyContent: 'center' }}>
                                {state.status === 'error' && (
                                    <button type="button" className="btn btn--primary" onClick={refreshMe}>
                                        Try again
                                    </button>
                                )}
                                <button type="button" className="btn" onClick={signOut}>
                                    Sign out
                                </button>
                            </div>
                        }
                    >
                        <p>
                            {state.status === 'denied'
                                ? `${state.email ?? 'This account'} is signed in but is not an active staff member. Ask an IT Museum admin to grant you a role.`
                                : state.message}
                        </p>
                    </EmptyState>
                </div>
            </main>
        );
    }
    return (
        <Routes>
            <Route element={<AdminLayout />}>
                <Route index element={<Overview />} />
                <Route path="queue" element={<Queue />} />
                <Route path="articles/:id" element={<Workspace />} />
                <Route path="archive" element={state.me.role === 'admin' ? <ArchiveManager /> : <NotFound />} />
                <Route path="staff" element={state.me.role === 'admin' ? <StaffManager /> : <NotFound />} />
                <Route path="*" element={<NotFound />} />
            </Route>
        </Routes>
    );
}

export default function AdminApp() {
    if (!isFirebaseConfigured || !isSupabaseConfigured) {
        return (
            <main id="main" className="admin-auth">
                <div className="admin-auth__card">
                    <EmptyState title="Review portal not configured" icon={<ShieldAlert size={32} aria-hidden="true" />}>
                        <p>Set the Firebase and Supabase variables listed in .env.example, then reload.</p>
                    </EmptyState>
                </div>
            </main>
        );
    }
    return (
        <AuthProvider>
            <ToastProvider>
                <Gate />
            </ToastProvider>
        </AuthProvider>
    );
}
