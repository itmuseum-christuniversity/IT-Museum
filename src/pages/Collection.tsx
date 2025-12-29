
import { useNavigate } from 'react-router-dom';
import DynamicCollections from '../components/DynamicCollections';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function Collection() {
    useScrollAnimation();
    const navigate = useNavigate();

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>Digital Archive</h1>
                    <p>Select an exhibit to explore detailed research and artifacts.</p>
                </div>
            </section>

            <section className="section" style={{ marginTop: '2rem' }}>
                <div className="gallery-grid">
                    {/* Exhibit 1: Kolam Art */}
                    <a onClick={() => navigate('/article/kolam')} className="gallery-item" style={{ cursor: 'pointer' }}>
                        <div className="gallery-thumb">
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #4A148C, #7B1FA2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>🥨</div>
                        </div>
                        <div className="gallery-content">
                            <span className="gallery-tag">Ethnomathematics</span>
                            <h3>The Art of Kolam</h3>
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Exploring the recursive geometry and array grammars hidden within traditional threshold patterns.</p>
                            <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginTop: '1rem', display: 'block' }}>Read Article &rarr;</span>
                        </div>
                    </a>

                    {/* Exhibit 2: Placeholder */}
                    <a className="gallery-item">
                        <div className="gallery-thumb">
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #263238, #546e7a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>💾</div>
                        </div>
                        <div className="gallery-content">
                            <span className="gallery-tag">Hardware History</span>
                            <h3>Evolution of Storage</h3>
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>(Coming Soon) From punch cards to DNA storage, a journey through data persistence.</p>
                        </div>
                    </a>

                    {/* Exhibit 3: Placeholder */}
                    <a className="gallery-item">
                        <div className="gallery-thumb">
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #006064, #0097A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>🕸️</div>
                        </div>
                        <div className="gallery-content">
                            <span className="gallery-tag">AI & Networks</span>
                            <h3>Neural Origins</h3>
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>(Coming Soon) Tracing the early mathematical models that paved the way for modern AI.</p>
                        </div>
                    </a>
                </div>

                <div style={{ marginTop: '3rem' }} className="gallery-grid">
                    <DynamicCollections />
                </div>
            </section>
        </div>
    );
}
