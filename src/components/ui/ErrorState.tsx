import { RotateCcw, CloudOff } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function ErrorState({ title = 'Something went wrong', message, onRetry, headingLevel }: { title?: string; message?: string; onRetry?: () => void; headingLevel?: 2 | 3 }) {
    return (
        <div role="alert">
            <EmptyState
                title={title}
                headingLevel={headingLevel}
                icon={<CloudOff size={32} aria-hidden="true" />}
                action={
                    onRetry && (
                        <button type="button" className="btn" onClick={onRetry}>
                            <RotateCcw size={16} aria-hidden="true" /> Try again
                        </button>
                    )
                }
            >
                <p>{message ?? 'We could not load this content. Check your connection and try again.'}</p>
            </EmptyState>
        </div>
    );
}
