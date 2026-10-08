import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import christLogo from '../../assets/christ-logo.png';
import dataArtLogo from '../../assets/dataart-museum-logo.png';
import { NAV } from '../../content/site';

export default function SiteHeader() {
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const location = useLocation();
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close the mobile menu after navigating.
    useEffect(() => setOpen(false), [location.pathname]);

    // Escape closes the menu and returns focus to the toggle.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return (
        <header className="site-header">
            <div className="container site-header__inner">
                <Link to="/" className="brand" aria-label="IT Museum — India, home">
                    <img src={christLogo} alt="CHRIST (Deemed to be University)" className="brand__christ" width={180} height={61} />
                    <span className="brand__divider" aria-hidden="true" />
                    <img src={dataArtLogo} alt="DataArt IT Museum" className="brand__dataart" width={128} height={48} />
                </Link>

                <button
                    ref={buttonRef}
                    type="button"
                    className="nav-toggle btn btn--ghost"
                    aria-expanded={open}
                    aria-controls={menuId}
                    onClick={() => setOpen((o) => !o)}
                >
                    {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
                    <span>Menu</span>
                </button>

                <nav id={menuId} className="site-nav" data-open={open} aria-label="Main">
                    <ul className="site-nav__list">
                        {NAV.map((item) => (
                            <li key={item.to}>
                                <NavLink to={item.to} end={item.end} className="site-nav__link">
                                    {item.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                    <div className="site-nav__actions">
                        <Link to="/submission" className="btn btn--primary">
                            Contribute research
                        </Link>
                        <Link to="/admin" className="site-nav__link site-nav__staff">
                            Staff sign-in
                        </Link>
                    </div>
                </nav>
            </div>
        </header>
    );
}
