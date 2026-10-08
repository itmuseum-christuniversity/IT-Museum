export function Skeleton({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
    return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function CardSkeletons({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
    return (
        <div className="grid" role="status" aria-live="polite">
            <span className="visually-hidden">{label}…</span>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="card archive-card" aria-hidden="true">
                    <Skeleton height="10rem" className="skeleton--media" />
                    <div className="archive-card__body">
                        <Skeleton width="40%" height="0.8rem" />
                        <Skeleton width="90%" height="1.4rem" />
                        <Skeleton width="100%" height="0.8rem" />
                        <Skeleton width="70%" height="0.8rem" />
                    </div>
                </div>
            ))}
        </div>
    );
}
