import { Link } from 'react-router-dom';
import christLogo from '../assets/christ-logo.png';
import museumLogo from '../assets/dataart-museum-logo.jpg';

export default function Footer() {
    return (
        <footer className="footer-retrospect">
            <div className="footer-content">
                {/* Column 1: Navigation / Credits style */}
                <div className="footer-col">
                    <h3>About the Project</h3>
                    <Link to="/" className="footer-link">Home</Link>
                    <Link to="/collection" className="footer-link">Digital Archive</Link>
                    <Link to="/team" className="footer-link">Curators</Link>
                    <Link to="/submission" className="footer-link">Submit Research</Link>
                    <Link to="/admin" className="footer-link">Admin Portal</Link>
                </div>

                {/* Column 2: Museum Info */}
                <div className="footer-col">
                    <h3>About the Museum</h3>
                    <p className="footer-text">
                        The Christ University IT Museum is a historical project dedicated to exploring and promoting the IT engineering heritage in India.
                        We aim to reconstruct the historical landscape surrounding significant engineering achievements and preserve the algorithmic beauty of Indian heritage.
                    </p>
                    <p className="footer-text">
                        Where Tradition Meets Computation.
                    </p>

                    <a href="https://retrospect.dataart.com" target="_blank" rel="noopener noreferrer" className="retrospect-link">
                        Explore the history of data and computing at DataArt IT Museum
                    </a>
                </div>

                {/* Column 3: Brand & Partners */}
                <div className="footer-col">
                    <h3>About Partners</h3>
                    <div className="footer-logo-container">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                            <img src={christLogo} alt="Christ University" className="footer-logo-img" style={{ background: 'white', padding: '5px', borderRadius: '4px', filter: 'none' }} />
                            <img src={museumLogo} alt="DataArt" className="footer-logo-img" style={{ borderRadius: '4px' }} />
                        </div>
                    </div>

                    <div className="footer-text" style={{ fontSize: '0.9rem' }}>
                        📍 Bangalore Yeshwanthpur Campus<br />
                        📧 itmuseum@christuniversity.in<br />
                        📞 080 6989 6666
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
                        <div className="social-dot" style={{ width: '25px', height: '25px' }}></div>
                        <div className="social-dot" style={{ width: '25px', height: '25px' }}></div>
                        <div className="social-dot" style={{ width: '25px', height: '25px' }}></div>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} IT Museum Christ University. All rights reserved.</p>
                <p>Designed with algorithmic beauty and Gemini AI.</p>
            </div>
        </footer>
    );
}

