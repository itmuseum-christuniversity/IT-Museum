
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
    const location = useLocation();
    const currentPath = location.pathname;

    const isActive = (path: string) => currentPath === path ? 'active' : '';

    return (
        <header>
            <nav>
                <div className="logo-container" style={{ cursor: 'pointer' }}>
                    <div className="logo-text">
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a' }}>CHRIST</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#546e7a', marginLeft: '5px' }}>(Deemed to be University)</span>
                    </div>
                    <div style={{ height: '35px', width: '1px', background: '#e0e0e0' }}></div>
                    <div className="logo-text">
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#D32F2F' }}>DataArt</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#546e7a', marginLeft: '5px' }}>IT Museum</span>
                    </div>
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
