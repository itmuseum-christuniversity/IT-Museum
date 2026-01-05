
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import DynamicHomeSections from '../components/DynamicHomeSections';
import HeroSlideshow from '../components/HeroSlideshow';

export default function Home() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            {/* Hero Section */}
            <section className="hero">
                <HeroSlideshow />
                <div className="hero-content">
                    <h1 className="fade-in">Converging Tradition <br /> & Computation.</h1>
                    <p className="fade-in" style={{ animationDelay: '0.2s' }}>
                        Discover the mathematical elegance of active Indian art forms and their profound connection to modern computer science.
                    </p>
                    <div className="btn-group fade-in" style={{ animationDelay: '0.4s' }}>
                        <Link className="cta-button" to="/collection">Explore the Archive</Link>
                        <Link className="cta-button secondary" to="/team">Meet the Curators</Link>
                    </div>
                </div>
            </section>

            {/* Core Philosophy */}
            <section className="section">
                <h2>Our Core Mission</h2>
                <div className="team-grid">
                    <div className="profile-card">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👁️</div>
                        <h3>Vision</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>To digitally preserve intangible cultural heritage through the lens of ethnomathematics and array grammars.</p>
                    </div>
                    <div className="profile-card">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                        <h3>Mission</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Archiving and modeling Kolam art to foster interdisciplinary research between art, culture, and algorithms.</p>
                    </div>
                    <div className="profile-card">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💎</div>
                        <h3>Values</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Integrity in preservation, innovation in technology, and inclusivity in bringing rural arts to the global stage.</p>
                    </div>
                </div>
            </section>

            {/* Timeline Journey */}
            <section className="section">
                <h2>The Journey of Kolam Research</h2>
                <div className="timeline-modern">
                    <div className="timeline-track"></div>

                    <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <span className="profile-badge">1954</span>
                            <h3>Foundations at MCC</h3>
                            <p>Dr. Gift Siromoney initiates academic interest in traditional Tamil art forms.</p>
                        </div>
                    </div>

                    <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <span className="profile-badge">1974</span>
                            <h3>Formal Grammar Defined</h3>
                            <p>Publication connecting Kolam art with Array Grammars, establishing the syntax.</p>
                        </div>
                    </div>

                    <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <span className="profile-badge">2024</span>
                            <h3>Digital IT Museum</h3>
                            <p>Christ University & DataArt launch this digital museum to future-proof the research.</p>
                        </div>
                    </div>
                </div>
            </section>

            <DynamicHomeSections />
        </div>
    );
}
