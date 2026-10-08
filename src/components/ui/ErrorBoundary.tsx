import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface Props {
    children: ReactNode;
    /** When this value changes (e.g. the route), a shown error is cleared and the children render again. */
    resetKey?: string;
}

interface State {
    error: Error | null;
}

/** Lazy route chunks that fail to download (offline, or a new deploy removed the old file). */
function isChunkError(error: Error): boolean {
    return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(`${error.name} ${error.message}`);
}

/**
 * Catches render-time and lazy-chunk errors so a failure shows a recoverable
 * message instead of a blank page. Uses plain links/buttons (full page loads)
 * so it also works above the router.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled UI error:', error, info.componentStack);
    }

    componentDidUpdate(prev: Props) {
        if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        const chunk = isChunkError(error);
        return (
            <section className="section" role="alert">
                <div className="container container--narrow">
                    <EmptyState
                        title={chunk ? 'This page could not be loaded' : 'Something went wrong'}
                        headingLevel={1}
                        icon={<TriangleAlert size={36} aria-hidden="true" />}
                        action={
                            <div className="cluster" style={{ justifyContent: 'center' }}>
                                <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                                    Reload the page
                                </button>
                                <a className="btn" href="/">
                                    Go to the home page
                                </a>
                            </div>
                        }
                    >
                        <p>
                            {chunk
                                ? 'We could not download this part of the site. Check your connection, or the site may have just been updated — reload to get the latest version.'
                                : 'An unexpected error stopped this page from displaying. Reloading usually fixes it.'}
                        </p>
                    </EmptyState>
                </div>
            </section>
        );
    }
}
