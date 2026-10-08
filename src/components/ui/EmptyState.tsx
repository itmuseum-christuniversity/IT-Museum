import type { ReactNode } from 'react';
import { Archive } from 'lucide-react';

export function EmptyState({ title, children, action, icon, headingLevel = 2 }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode; headingLevel?: 1 | 2 | 3 }) {
    const H = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3';
    return (
        <div className="empty">
            {icon ?? <Archive size={32} aria-hidden="true" />}
            <H>{title}</H>
            {children && <div className="muted">{children}</div>}
            {action}
        </div>
    );
}
