import { Link } from 'react-router-dom';
import christLogo from '../assets/christ-logo.png';
import museumLogo from '../assets/dataart-museum-logo.jpg';

export default function Footer() {
    return (
        <footer className="footer-professional">
            <div className="footer-content">
                {/* Brand Column */}
                <div className="footer-col brand-col">
                    <div className="footer-logo">
                        <img src={christLogo} alt="Christ University" style={{ height: '50px', objectFit: 'contain', background: 'white', padding: '5px', borderRadius: '4px' }} />
                        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.3)', margin: '0 15px' }}></div>
                        <img src={museumLogo} alt="DataArt" style={{ height: '50px', objectFit: 'contain', borderRadius: '4px' }} />
                    </div>
                    <p className="footer-tagline">
                        Where Tradition Meets Computation.<br />
                        Preserving the algorithmic beauty of Indian heritage.
                    </p>
                </div>

                {/* Navigation Column */}
                <div className="footer-col">
                    <h3>Explore</h3>
                    <Link to="/">Home</Link>
                    <Link to="/collection">Digital Archive</Link>
                    <Link to="/team">Curators</Link>
                    <Link to="/submission">Submit Research</Link>
                </div>

                {/* Contact Column */}
                <div className="footer-col">
                    <h3>Contact</h3>
                    <div className="contact-item">
                        <span>📍</span>
                        <p>Yeshwanthpur Campus, Bangalore</p>
                    </div>
                    <div className="contact-item">
                        <span>📧</span>
                        <p>itmuseum@christuniversity.in</p>
                    </div>
                    <div className="contact-item">
                        <span>📞</span>
                        <p>+91-80-4012-9100</p>
                    </div>
                </div>

                {/* Legal / Admin Column */}
                <div className="footer-col">
                    <h3>Legal & Admin</h3>
                    <Link to="/admin">Admin Portal</Link>
                    <span className="disabled-link">Privacy Policy</span>
                    <span className="disabled-link">Terms of Service</span>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} IT Museum. All rights reserved.</p>
                <div className="social-links-placeholder">
                    {/* Placeholders for social icons */}
                    <div className="social-dot"></div>
                    <div className="social-dot"></div>
                    <div className="social-dot"></div>
                </div>
            </div>
        </footer>
    );
}

