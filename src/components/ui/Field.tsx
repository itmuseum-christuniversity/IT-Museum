import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

interface FieldShellProps {
    id?: string;
    label: ReactNode;
    hint?: ReactNode;
    error?: string;
    required?: boolean;
    optional?: boolean;
    className?: string;
    children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint + error, wired with aria-describedby / aria-invalid. */
export function FieldShell({ id: idProp, label, hint, error, required, optional, className = '', children }: FieldShellProps) {
    const generated = useId();
    const id = idProp ?? generated;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
    return (
        <div className={`field ${className}`}>
            <label className="field__label" htmlFor={id}>
                {label}
                {required && (
                    <span className="field__required" aria-hidden="true">
                        *
                    </span>
                )}
                {optional && <span className="field__optional">(optional)</span>}
            </label>
            {hint && (
                <p className="field__hint" id={hintId}>
                    {hint}
                </p>
            )}
            {children({ id, describedBy, invalid: Boolean(error) })}
            {error && (
                <p className="field__error" id={errorId}>
                    <AlertCircle size={16} aria-hidden="true" style={{ marginTop: 2 }} />
                    {error}
                </p>
            )}
        </div>
    );
}

type Common = { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; fieldClassName?: string };

export function TextField({ id, label, hint, error, optional, fieldClassName, required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
            {({ id: controlId, describedBy, invalid }) => (
                <input id={controlId} className="input" aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...rest} />
            )}
        </FieldShell>
    );
}

export function TextArea({ id, label, hint, error, optional, fieldClassName, required, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
            {({ id: controlId, describedBy, invalid }) => (
                <textarea id={controlId} className="textarea" aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...rest} />
            )}
        </FieldShell>
    );
}

export function SelectField({ id, label, hint, error, optional, fieldClassName, required, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={optional} className={fieldClassName}>
            {({ id: controlId, describedBy, invalid }) => (
                <select id={controlId} className="select" aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...rest}>
                    {children}
                </select>
            )}
        </FieldShell>
    );
}
