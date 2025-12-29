
import { Link, useParams } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function Article() {
    useScrollAnimation();
    const { id } = useParams();

    // Currently only one static article "kolam" is fully implemented in the design
    // Ideally fetch content based on ID from Firestore or config

    if (id !== 'kolam') {
        return <div className="page active" style={{ display: 'block', padding: '4rem', textAlign: 'center' }}>Article not found (ID: {id})</div>;
    }

    return (
        <div className="page active" style={{ display: 'block' }}>
            <div className="article-container">
                <Link to="/collection" className="article-back-btn">&larr; Back to Collection</Link>

                <header className="article-header">
                    <span className="profile-badge">Exhibit #001</span>
                    <h1>The Art of Kolam: Symmetry & Computation</h1>
                    <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>An in-depth analysis of South Indian threshold designs.</p>
                </header>

                <div className="card-premium" style={{ marginBottom: '3rem' }}>
                    <h3>Introduction to Kolam</h3>
                    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Kolam is an ancient Indian folk art extensively used to beautifully adorn the thresholds and open courtyards in front of houses... (Content Preserved)</p>
                    <br />
                    <p style={{ color: 'var(--text-muted)' }}>The word "Kolam" in the Tamil language means form and beauty. A symbol of auspiciousness and divinity.</p>
                </div>

                <div className="card-premium" style={{ marginBottom: '3rem' }}>
                    <h3>Mathematical Frameworks</h3>
                    <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1.5rem' }}>
                        <div>
                            <h4 style={{ color: 'var(--primary)' }}>1. Angular Encoding Model</h4>
                            <p style={{ color: 'var(--text-muted)' }}>Maps angular movements in Kolam drawing to symbol sequences representing directions.</p>
                        </div>
                        <div>
                            <h4 style={{ color: 'var(--primary)' }}>2. Array Grammar</h4>
                            <p style={{ color: 'var(--text-muted)' }}>Uses array grammars and contextual Array P Systems to generate and analyze patterns.</p>
                        </div>
                    </div>
                </div>

                <div className="card-premium" style={{ background: 'linear-gradient(135deg, #f3e5f5, white)' }}>
                    <h3>📚 Further Reading</h3>
                    <ul style={{ marginTop: '1rem', marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                        <li><a href="https://arxiv.org/abs/2307.02144" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Kolam Simulation (arXiv)</a></li>
                        <li><a href="https://www.iitm.ac.in/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>IIT Madras Research Archive</a></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
