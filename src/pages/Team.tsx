
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function Team() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>The Curators</h1>
                    <p>Meet the researchers bridging the gap between art and algorithms.</p>
                </div>
            </section>

            <section className="section">
                <div className="team-grid">
                    <div className="profile-card">
                        <div className="profile-img"></div>
                        <span className="profile-badge">The Pioneer</span>
                        <h3>Mr. A</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Renowned mathematician who first applied formal grammar and automata theory to Kolam patterns.</p>
                    </div>

                    <div className="profile-card">
                        <div className="profile-img"></div>
                        <span className="profile-badge">AI Research</span>
                        <h3>Mr. B</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Leading researcher in AI-based pattern recognition and digitization of Kolam designs.</p>
                    </div>

                    <div className="profile-card">
                        <div className="profile-img"></div>
                        <span className="profile-badge">Algorithms</span>
                        <h3>Mr. C</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Focusing on recursive structures and AI applications at VIT University.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
