import type { ReactNode } from 'react';

/** Standard page header for interior pages. */
export function PageIntro({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
    return (
        <header className="page-intro">
            <div className="container">
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h1>{title}</h1>
                {children && <div className="lede">{children}</div>}
                {actions && <div className="cluster page-intro__actions">{actions}</div>}
            </div>
        </header>
    );
}
