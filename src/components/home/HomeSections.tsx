import { FileText } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { fetchSections } from '../../services/sections';
import { isSupabaseConfigured } from '../../lib/config';

/** Optional CMS sections from the `sections` table, rendered after sanitising. */
export function HomeSections() {
    const state = useAsync(() => (isSupabaseConfigured ? fetchSections() : Promise.resolve([])), []);
    // Sections are supplementary: on error or when empty, render nothing.
    if (state.status !== 'ready' || state.data.length === 0) return null;
    return (
        <>
            {state.data.map((s) => (
                <section key={s.id} className="section section--tight" aria-labelledby={s.title ? `section-${s.id}` : undefined}>
                    <div className="container container--narrow stack">
                        {s.title && <h2 id={`section-${s.id}`}>{s.title}</h2>}
                        {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" className="rounded" />}
                        {s.html && <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />}
                        {s.pdfUrl && (
                            <p>
                                <a className="btn" href={s.pdfUrl} target="_blank" rel="noopener noreferrer">
                                    <FileText size={16} aria-hidden="true" /> View PDF document<span className="visually-hidden"> (opens in a new tab)</span>
                                </a>
                            </p>
                        )}
                    </div>
                </section>
            ))}
        </>
    );
}
