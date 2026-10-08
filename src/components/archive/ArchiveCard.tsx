import { Link } from 'react-router-dom';
import { BookOpen, FileText, Landmark } from 'lucide-react';
import { KIND_LABEL, type ArchiveItem } from '../../services/archive';
import { formatDate } from '../../lib/format';

const PLATE_ICON = { article: FileText, exhibit: Landmark, note: BookOpen };

export function ArchiveCard({ item, headingLevel = 3 }: { item: ArchiveItem; headingLevel?: 2 | 3 }) {
    const H = headingLevel === 2 ? 'h2' : 'h3';
    const Icon = PLATE_ICON[item.kind];
    const authors = item.authors.map((a) => a.name).join(', ');
    return (
        <article className="card archive-card">
            <div className="archive-card__media" aria-hidden="true">
                {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                    <div className={`archive-card__plate ${item.kind !== 'article' ? `archive-card__plate--${item.kind}` : ''}`}>
                        <Icon size={40} strokeWidth={1.25} />
                    </div>
                )}
            </div>
            <div className="archive-card__body">
                <div className="cluster" style={{ ['--cluster-gap' as string]: '0.5rem' }}>
                    <span className={`badge badge--plain ${item.kind === 'exhibit' ? 'badge--gold' : 'badge--blue'}`}>{KIND_LABEL[item.kind]}</span>
                    {item.tags.slice(0, 2).map((t) => (
                        <span key={t} className="badge badge--plain">
                            {t}
                        </span>
                    ))}
                </div>
                <H className="archive-card__title">
                    <Link to={`/article/${item.id}`}>{item.title}</Link>
                </H>
                {authors && <p className="subtle" style={{ margin: 0 }}>{authors}</p>}
                {item.summary && <p className="archive-card__summary">{item.summary}</p>}
                <p className="archive-card__meta">
                    {item.date ? `${item.dateLabel} ${formatDate(item.date)}` : 'Permanent exhibit'}
                    {item.reference && item.kind !== 'note' ? ` · ${item.reference}` : ''}
                </p>
            </div>
        </article>
    );
}
