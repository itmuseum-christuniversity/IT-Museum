
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
                        <Link className="cta-button secondary" style={{ background: 'white', border: 'none', boxShadow: 'var(--shadow-soft)' }} to="/team">Meet the Curators</Link>
                    </div>
                </div>
            </section>

            {/* Core Philosophy */}
            <section className="section">
                <h2>Our Core Mission</h2>
                <div className="team-grid">
                    <div className="profile-card" style={{ borderTop: '4px solid var(--primary)', position: 'relative' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Vision</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            To serve as a global beacon for the digital preservation of <strong>intangible cultural heritage</strong>. We aim to bridge the gap between ancient artistic traditions and modern computational science through the innovative lens of ethnomathematics.
                        </p>
                    </div>
                    <div className="profile-card" style={{ borderTop: '4px solid var(--accent)', position: 'relative' }}>
                        <div style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Mission</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            We are dedicated to meticulously archiving, analyzing, and modeling the intricate logic of <strong>traditional geometric art</strong> using Array Grammars. Our goal is to foster a vibrant interdisciplinary dialogue that unites art historians, mathematicians, and computer scientists.
                        </p>
                    </div>
                    <div className="profile-card" style={{ borderTop: '4px solid var(--primary)', position: 'relative' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Values</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            Our work is grounded in an unwavering commitment to <strong>integrity</strong> in preservation and <strong>inclusivity</strong> in access. We believe in the power of technology to democratize culture, ensuring that the wisdom of rural artisans is celebrated and preserved for future generations.
                        </p>
                    </div>
                </div>
            </section>



            <DynamicHomeSections />
        </div>
    );
}
