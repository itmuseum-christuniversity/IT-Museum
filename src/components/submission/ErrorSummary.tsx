import { forwardRef } from 'react';

/** GOV.UK-style error summary: focusable, links jump to each invalid field. */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: Record<string, string>; fieldIds: Record<string, string> }>(function ErrorSummary({ errors, fieldIds }, ref) {
    const entries = Object.entries(errors);
    if (!entries.length) return null;
    return (
        <div ref={ref} className="alert alert--danger error-summary" role="alert" tabIndex={-1} aria-labelledby="error-summary-title">
            <div>
                <strong id="error-summary-title" className="alert__title">
                    {entries.length === 1 ? 'There is 1 problem to fix' : `There are ${entries.length} problems to fix`}
                </strong>
                <ul>
                    {entries.map(([key, message]) => (
                        <li key={key}>
                            {fieldIds[key] ? (
                                <a
                                    href={`#${fieldIds[key]}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        document.getElementById(fieldIds[key])?.focus();
                                    }}
                                >
                                    {message}
                                </a>
                            ) : (
                                message
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});
