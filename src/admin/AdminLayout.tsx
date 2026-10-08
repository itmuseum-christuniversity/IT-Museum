import { Link, NavLink, Outlet } from 'react-router-dom';
import { Archive, Inbox, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { ROLE_LABEL } from '../../supabase/functions/_shared/workflow.ts';
import { useRouteFocus } from '../components/layout/PublicLayout';
import { useAuth, useStaff } from './auth';

export default function AdminLayout() {
    const { me } = useStaff();
    const { signOut } = useAuth();
    const mainRef = useRouteFocus();
    const isAdmin = me.role === 'admin';
    return (
        <div className="admin">
            <a className="skip-link" href="#main">
                Skip to main content
            </a>
            <header className="admin-top">
                <Link to="/admin" className="admin-top__brand">
                    IT Museum <span>Review portal</span>
                </Link>
                <div className="admin-top__user">
                    <span className="admin-top__who">
                        {me.display_name} <span className="badge badge--gold badge--plain">{ROLE_LABEL[me.role]}</span>
                    </span>
                    <button type="button" className="btn btn--sm btn--on-dark" onClick={signOut}>
                        <LogOut size={16} aria-hidden="true" /> Sign out
                    </button>
                </div>
            </header>
            <div className="admin-body">
                <nav className="admin-nav" aria-label="Review portal">
                    <ul>
                        <li>
                            <NavLink to="/admin" end>
                                <LayoutDashboard size={18} aria-hidden="true" /> Overview
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/admin/queue">
                                <Inbox size={18} aria-hidden="true" /> {isAdmin ? 'Inbox' : 'My queue'}
                            </NavLink>
                        </li>
                        {isAdmin && (
                            <>
                                <li>
                                    <NavLink to="/admin/archive">
                                        <Archive size={18} aria-hidden="true" /> Archive
                                    </NavLink>
                                </li>
                                <li>
                                    <NavLink to="/admin/staff">
                                        <Users size={18} aria-hidden="true" /> Staff & roles
                                    </NavLink>
                                </li>
                            </>
                        )}
                    </ul>
                    <Link className="admin-nav__site" to="/">
                        View public site
                    </Link>
                </nav>
                <main id="main" ref={mainRef} tabIndex={-1} className="admin-main">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
