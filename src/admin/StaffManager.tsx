import { useState } from 'react';
import { ROLE_LABEL, STAFF_ROLES, type StaffRole } from '../../supabase/functions/_shared/workflow.ts';
import { useAsync } from '../hooks/useAsync';
import { usePageMeta } from '../hooks/usePageMeta';
import { ApiError } from '../lib/api';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { Dialog } from '../components/ui/Dialog';
import { SelectField, TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Alert';
import { useStaff } from './auth';
import { useToast } from './toast';
import type { StaffListItem } from './api';

type Form = { id?: string; email: string; display_name: string; role: StaffRole; active: boolean };
const blank: Form = { email: '', display_name: '', role: 'it_reviewer', active: true };

export default function StaffManager() {
    usePageMeta('Staff & roles — review portal');
    const { api, me } = useStaff();
    const toast = useToast();
    const state = useAsync(() => api.staffList(), [api]);
    const [form, setForm] = useState<Form | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const edit = (s: StaffListItem) => {
        setErrors({});
        setError(null);
        setForm({ id: s.id, email: s.email ?? '', display_name: s.display_name, role: s.role, active: s.active !== false });
    };

    const save = async () => {
        if (!form) return;
        setBusy(true);
        setError(null);
        try {
            await api.staffUpsert(form);
            toast('success', form.id ? 'Staff member updated.' : 'Staff member added. They can now sign in with Firebase using this email.');
            setForm(null);
            state.retry();
        } catch (e) {
            if (e instanceof ApiError && e.fields) setErrors(e.fields);
            setError(e instanceof Error ? e.message : 'Could not save.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="admin-page">
            <header className="admin-page__head">
                <div>
                    <h1>Staff & roles</h1>
                    <p className="muted">
                        Access is granted only by these records — never by the wording of an email address. Create the person’s sign-in in Firebase Authentication, then add them
                        here with exactly one role.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => {
                        setErrors({});
                        setError(null);
                        setForm({ ...blank });
                    }}
                >
                    Add staff member
                </button>
            </header>

            {state.status === 'loading' && <Skeleton height="12rem" />}
            {state.status === 'error' && <ErrorState message={state.error.message} onRetry={state.retry} />}
            {state.status === 'ready' && (
                <div className="table-wrap">
                    <table className="table">
                        <caption className="visually-hidden">Staff members</caption>
                        <thead>
                            <tr>
                                <th scope="col">Name</th>
                                <th scope="col">Email</th>
                                <th scope="col">Role</th>
                                <th scope="col">Status</th>
                                <th scope="col">
                                    <span className="visually-hidden">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.data.map((s) => (
                                <tr key={s.id}>
                                    <td>
                                        {s.display_name}
                                        {s.id === me.id && <span className="subtle"> (you)</span>}
                                    </td>
                                    <td>{s.email}</td>
                                    <td>{ROLE_LABEL[s.role]}</td>
                                    <td>
                                        {s.active === false ? (
                                            <span className="badge">Inactive</span>
                                        ) : (
                                            <span className="badge badge--success">{s.linked ? 'Active' : 'Active · not signed in yet'}</span>
                                        )}
                                    </td>
                                    <td>
                                        <button type="button" className="btn btn--sm" onClick={() => edit(s)}>
                                            Edit<span className="visually-hidden"> {s.display_name}</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={Boolean(form)}
                onClose={() => setForm(null)}
                title={form?.id ? 'Edit staff member' : 'Add staff member'}
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setForm(null)}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn--primary" onClick={save} disabled={busy}>
                            {busy && <span className="spinner" aria-hidden="true" />} Save
                        </button>
                    </>
                }
            >
                {form && (
                    <>
                        {error && (
                            <Alert tone="danger" role="alert" className="mb-5">
                                <p>{error}</p>
                            </Alert>
                        )}
                        <TextField label="Name" required value={form.display_name} error={errors.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                        <TextField
                            label="Email"
                            type="email"
                            required
                            hint="Must match their Firebase sign-in email."
                            value={form.email}
                            error={errors.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                        <SelectField label="Role" required value={form.role} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}>
                            {STAFF_ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {ROLE_LABEL[r]}
                                </option>
                            ))}
                        </SelectField>
                        <label className="check">
                            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                            <span>Active (can sign in to the review portal)</span>
                        </label>
                    </>
                )}
            </Dialog>
        </div>
    );
}
