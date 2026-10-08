import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal built on the native <dialog> element (focus trapping,
 * Escape to close and inert background are provided by the browser).
 */
export function Dialog({ open, onClose, title, children, footer, describedBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; describedBy?: string }) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            if (typeof d.showModal === 'function') d.showModal();
            else d.setAttribute('open', '');
        } else if (!open && d.open) {
            if (typeof d.close === 'function') d.close();
            else d.removeAttribute('open');
        }
    }, [open]);
    return (
        <dialog
            ref={ref}
            className="dialog"
            aria-labelledby={titleId}
            aria-describedby={describedBy}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div className="dialog__header">
                <h2 id={titleId}>{title}</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close dialog">
                    <X size={18} aria-hidden="true" />
                </button>
            </div>
            <div className="dialog__body">{children}</div>
            {footer && <div className="dialog__footer">{footer}</div>}
        </dialog>
    );
}
