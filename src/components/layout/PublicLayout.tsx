import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

/** Moves focus to <main> on route changes so screen-reader users hear the new page. */
export function useRouteFocus() {
    const ref = useRef<HTMLElement>(null);
    const { pathname } = useLocation();
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        window.scrollTo(0, 0);
        ref.current?.focus({ preventScroll: true });
    }, [pathname]);
    return ref;
}

export default function PublicLayout() {
    const mainRef = useRouteFocus();
    return (
        <>
            <a className="skip-link" href="#main">
                Skip to main content
            </a>
            <SiteHeader />
            <main id="main" ref={mainRef} tabIndex={-1}>
                <Outlet />
            </main>
            <SiteFooter />
        </>
    );
}
