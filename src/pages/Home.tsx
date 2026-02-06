import { Link } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import DynamicHomeSections from '../components/DynamicHomeSections';
import HeroSlideshow from '../components/HeroSlideshow';
import indianITImg from '../assets/hero-images/hero1.jpg';

export default function Home() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            {/* Hero Section */}
            <section className="hero">
                <HeroSlideshow />
                <div className="hero-content">
                    <h1 className="fade-in" style={{ textTransform: 'uppercase', letterSpacing: '2px' }}>IT Museum - India</h1>
                    <p className="fade-in" style={{ animationDelay: '0.2s' }}>
                        Tracing the remarkable evolution of technology in India, from the first indigenous computers to becoming a global digital powerhouse.
                    </p>
                    <div className="btn-group fade-in" style={{ animationDelay: '0.4s' }}>
                        <Link className="cta-button" to="/collection">Explore the Archive</Link>
                        <Link className="cta-button secondary" style={{ background: 'white', border: 'none', boxShadow: 'var(--shadow-soft)' }} to="/team">Meet the Curators</Link>
                    </div>
                </div>
            </section>

            {/* Partnership Announcement Section */}
            <section className="section fade-in" style={{ background: 'rgba(13, 71, 161, 0.03)', borderRadius: '24px', margin: '4rem auto', padding: '4rem 2.5rem', maxWidth: '1200px', border: '1px solid rgba(13, 71, 161, 0.1)' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '2.5rem', color: 'var(--primary)', position: 'relative', display: 'inline-block', left: '50%', transform: 'translateX(-50%)' }}>
                        IT Museum - India
                        <span style={{ content: '""', position: 'absolute', bottom: '-10px', left: '25%', width: '50%', height: '3px', background: 'var(--accent)', borderRadius: '2px' }}></span>
                    </h2>
                    <p style={{ fontSize: '1.15rem', lineHeight: '1.9', color: '#444', marginBottom: '1.5rem', textAlign: 'justify' }}>
                        <a href="https://museum.dataart.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none', borderBottom: '2px solid rgba(13, 71, 161, 0.2)' }}>DataArt</a>, a multinational IT firm, has established a collaborative partnership with the Department of Computer Science at <a href="https://christuniversity.in/bangalore-yeshwanthpur-campus" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none', borderBottom: '2px solid rgba(13, 71, 161, 0.2)' }}>Christ University</a>, Bangalore Yeshwantpur Campus.
                        Through their "<a href="https://museum.dataart.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'none', borderBottom: '2px solid rgba(13, 71, 161, 0.2)' }}>IT Museum</a>" project, DataArt documents the IT innovation contributions of countries across Eastern and Central Europe, Latin America, and Asia.
                        As part of this Memorandum of Understanding (MoU), the DataArt IT Museum team seeks to collaborate with our University to document and showcase India's contributions to IT innovations.
                    </p>
                    <p style={{ fontSize: '1.15rem', lineHeight: '1.9', color: '#444', textAlign: 'justify' }}>
                        This strategic partnership will facilitate the curation of case studies, research articles, and historical narratives that illuminate the intersection of Indian traditions and IT advancements.
                        The Departments of Computer Science, Media Studies, and the Centre for Digital Learning (CDL) at Bangalore Yeshwantpur Campus are actively engaged in this collaborative initiative.
                    </p>
                </div>
            </section>

            {/* Discovery Spotlight Section */}
            <section className="spotlight-section fade-in">
                <div className="spotlight-grid">
                    <div className="spotlight-image-container">
                        <img src={indianITImg} alt="Indian IT History - Early Mainframes" />
                    </div>
                    <div className="spotlight-content">
                        <h2>The Dawn of Indian Computing</h2>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.2rem', lineHeight: '1.8', marginBottom: '2rem' }}>
                            In 1955, the <strong>HEC-2M</strong> arrived at the Indian Statistical Institute, marking India's entry into the digital age.
                            This was soon followed by the <strong>TIFRAC</strong> in Mumbai—the first computer designed and built indigenously in India.
                            These machines, housed in massive cooling halls, were the architectural blueprints for India's future as a global technology powerhouse.
                        </p>
                        <Link to="/collection" className="cta-button">Explore the IT Origins</Link>
                    </div>
                </div>
            </section>

            {/* Discovery Timeline Ribbon: Chapters of Computing History */}
            <div style={{ textAlign: 'center', marginTop: '6rem', marginBottom: '-2rem' }}>
                <h3 style={{ textTransform: 'uppercase', letterSpacing: '4px', color: 'var(--text-muted)', fontSize: '1rem', opacity: 0.8 }}>Discovery of Global Timeline with DataArt IT Museum</h3>
            </div>
            <div className="milestone-ribbon">
                <div className="ribbon-track">
                    <a href="https://museum.dataart.com/history/chapter-1-from-military-to-civil-computing" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter I. From Military to Civil Computing</a>
                    <a href="https://museum.dataart.com/history/chapter-2-computers-for-business-and-industry" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter II. Computers for Business and Industry</a>
                    <a href="https://museum.dataart.com/history/chapter-3-computer-globalization" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter III. Computer Globalization</a>
                    <a href="https://museum.dataart.com/history/chapter-4-early-networks-and-proto-internet" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter IV. Early Networks and Proto-Internet</a>
                    <a href="https://museum.dataart.com/history/chapter-5-mass-computerization" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter V. Mass Computerization</a>
                    <a href="https://museum.dataart.com/history/chapter-6-computer-footprint-on-culture" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter VI. Computer Footprint on Culture</a>

                    {/* Duplicate for seamless scrolling */}
                    <a href="https://museum.dataart.com/history/chapter-1-from-military-to-civil-computing" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter I. From Military to Civil Computing</a>
                    <a href="https://museum.dataart.com/history/chapter-2-computers-for-business-and-industry" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter II. Computers for Business and Industry</a>
                    <a href="https://museum.dataart.com/history/chapter-3-computer-globalization" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter III. Computer Globalization</a>
                    <a href="https://museum.dataart.com/history/chapter-4-early-networks-and-proto-internet" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter IV. Early Networks and Proto-Internet</a>
                    <a href="https://museum.dataart.com/history/chapter-5-mass-computerization" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter V. Mass Computerization</a>
                    <a href="https://museum.dataart.com/history/chapter-6-computer-footprint-on-culture" target="_blank" rel="noopener noreferrer" className="ribbon-item">Chapter VI. Computer Footprint on Culture</a>
                </div>
            </div>

            {/* Core Philosophy */}
            <section className="section">
                <h2 style={{ textAlign: 'center' }}>Our Core Mission</h2>
                <div className="team-grid">
                    <div className="profile-card" style={{ borderTop: '4px solid var(--primary)', position: 'relative' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Vision</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            To serve as a global beacon for the digital preservation of <strong>intangible cultural heritage</strong>. We aim to bridge the gap between ancient artistic traditions and modern computational science.
                        </p>
                    </div>
                    <div className="profile-card" style={{ borderTop: '4px solid var(--accent)', position: 'relative' }}>
                        <div style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Mission</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            We are dedicated to meticulously archiving and modeling the intricate logic of <strong>traditional geometric art</strong>. Our goal is to foster a vibrant interdisciplinary dialogue.
                        </p>
                    </div>
                    <div className="profile-card" style={{ borderTop: '4px solid var(--primary)', position: 'relative' }}>
                        <div style={{ color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /></svg>
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Values</h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>
                            Grounded in an unwavering commitment to <strong>integrity</strong> in preservation and <strong>inclusivity</strong> in access. We believe technology democratizes culture.
                        </p>
                    </div>
                </div>
            </section>


            {/* Curator Quote Section */}
            <section className="quote-section fade-in">
                <blockquote className="quote-text">
                    "History is not a record of the past, but the blueprints for the future."
                </blockquote>
                <div className="quote-author">— The Christ University IT Museum Board</div>
            </section>

            <DynamicHomeSections />
        </div>
    );
}
