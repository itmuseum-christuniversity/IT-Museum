
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function Contact() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>Get in Touch</h1>
                    <p>Visit us at the Yeshwanthpur Campus or reach out online.</p>
                </div>
            </section>

            <section className="section">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
                    <div className="card-premium">
                        <h3 style={{ marginBottom: '2rem' }}>Contact Information</h3>

                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>📍 Location</h4>
                            <p style={{ color: 'var(--text-muted)' }}>Christ University, Yeshwanthpur Campus<br />Bangalore, Karnataka 560022</p>
                        </div>

                        <div>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>📞 Contact</h4>
                            <p style={{ color: 'var(--text-muted)' }}>+91-80-4012-9100<br />itmuseum@christuniversity.in</p>
                        </div>
                    </div>

                    {/* Abstract Visual for Map */}
                    <div style={{ background: 'var(--primary-light)', borderRadius: '24px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ opacity: 0.2, fontSize: '15rem', color: 'white' }}>🗺️</div>
                        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', background: 'white', padding: '1rem 2rem', borderRadius: '50px', fontWeight: 700 }}>Find us on Maps &nearr;</div>
                    </div>
                </div>
            </section>
        </div>
    );
}
