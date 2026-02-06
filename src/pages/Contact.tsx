
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function Contact() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>Get in Touch</h1>
                    <p>Visit us at the Bangalore Yeshwanthpur Campus or reach out online.</p>
                </div>
            </section>

            <section className="section">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
                    <div className="card-premium">
                        <h3 style={{ marginBottom: '2rem' }}>Contact Information</h3>

                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>📍 Location</h4>
                            <p style={{ color: 'var(--text-muted)' }}>Christ University, Bangalore Yeshwanthpur Campus<br />Bangalore, Karnataka 560022</p>
                        </div>

                        <div>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>📞 Contact</h4>
                            <p style={{ color: 'var(--text-muted)' }}>080 6989 6666<br />itmuseum@christuniversity.in</p>
                        </div>
                    </div>

                    {/* Google Map Embed */}
                    <div style={{ borderRadius: '24px', overflow: 'hidden', height: '400px', boxShadow: 'var(--shadow-soft)' }}>
                        <iframe
                            src="https://maps.google.com/maps?q=Christ+University+Yeshwanthpur+Campus+Bangalore&t=&z=15&ie=UTF8&iwloc=&output=embed"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Christ University Yeshwantpur Campus Map"
                        ></iframe>
                    </div>
                </div>
            </section>
        </div>
    );
}
