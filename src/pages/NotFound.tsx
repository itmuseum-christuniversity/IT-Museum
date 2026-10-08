import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { EmptyState } from '../components/ui/EmptyState';

export default function NotFound({ title = 'Page not found', message }: { title?: string; message?: string }) {
    usePageMeta(title);
    return (
        <section className="section">
            <div className="container container--narrow">
                <EmptyState
                    title={title}
                    headingLevel={1}
                    icon={<Compass size={36} aria-hidden="true" />}
                    action={
                        <div className="cluster" style={{ justifyContent: 'center' }}>
                            <Link className="btn btn--primary" to="/collection">
                                Browse the archive
                            </Link>
                            <Link className="btn" to="/">
                                Go to the home page
                            </Link>
                        </div>
                    }
                >
                    <p>{message ?? 'The page you were looking for does not exist or has moved.'}</p>
                </EmptyState>
            </div>
        </section>
    );
}
