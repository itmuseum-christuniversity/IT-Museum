import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type Tone = 'info' | 'success' | 'warning' | 'danger';
const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export function Alert({ tone = 'info', title, children, role, className = '' }: { tone?: Tone; title?: string; children?: ReactNode; role?: 'alert' | 'status'; className?: string }) {
    const Icon = ICONS[tone];
    return (
        <div className={`alert alert--${tone} ${className}`} role={role}>
            <Icon size={20} aria-hidden="true" />
            <div>
                {title && <strong className="alert__title">{title}</strong>}
                {children}
            </div>
        </div>
    );
}
