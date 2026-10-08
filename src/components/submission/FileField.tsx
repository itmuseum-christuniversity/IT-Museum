import { CheckCircle2 } from 'lucide-react';
import { FieldShell } from '../ui/Field';

/** PDF picker that keeps the chosen file in parent state (survives failed submits). */
export function FileField({
    id,
    label,
    hint,
    file,
    error,
    required,
    onChange,
}: {
    id: string;
    label: string;
    hint?: string;
    file: File | null;
    error?: string;
    required?: boolean;
    onChange: (f: File | null) => void;
}) {
    return (
        <FieldShell id={id} label={label} hint={hint} error={error} required={required} optional={!required}>
            {({ id: controlId, describedBy, invalid }) => (
                <div className="file-drop" data-has-file={Boolean(file)}>
                    <input
                        id={controlId}
                        type="file"
                        accept="application/pdf,.pdf"
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                    />
                    {file && (
                        <p className="cluster subtle" style={{ margin: 0, ['--cluster-gap' as string]: '0.4rem' }}>
                            <CheckCircle2 size={16} aria-hidden="true" color="var(--success-fg)" />
                            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                        </p>
                    )}
                </div>
            )}
        </FieldShell>
    );
}
