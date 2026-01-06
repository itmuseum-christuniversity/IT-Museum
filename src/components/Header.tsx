
import { Link, useLocation } from 'react-router-dom';
import christLogo from '../assets/christ-logo.png';
import museumLogo from '../assets/dataart-museum-logo.jpg';

export default function Header() {
    const location = useLocation();
    const currentPath = location.pathname;

    const isActive = (path: string) => currentPath === path ? 'active' : '';

    return (
        <header>
            <nav>
                <div className="logo-container">
                    <img src={christLogo} alt="Christ University Logo" className="logo-christ" />
                    <div className="logo-separator"></div>
                    <img src={museumLogo} alt="IT Museum Logo" className="logo-museum" />
                </div>

                <ul className="nav-links">
                    <li><Link to="/" className={isActive('/')}>Home</Link></li>
                    <li><Link to="/collection" className={isActive('/collection')}>Collection</Link></li>
                    <li><Link to="/team" className={isActive('/team')}>Team</Link></li>
                    <li><Link to="/contact" className={isActive('/contact')}>Contact</Link></li>
                    <li><Link to="/submission" style={{ color: 'var(--primary)', fontWeight: 600 }}>Submit Article</Link></li>
                    <li><Link to="/admin" className="admin-btn">Admin</Link></li>
                </ul>
            </nav>
        </header>
    );
}
