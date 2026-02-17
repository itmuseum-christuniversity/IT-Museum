
import { useScrollAnimation } from '../hooks/useScrollAnimation';

import bijuKcImg from '../assets/team/biju-kc.png';
import vinayMImg from '../assets/team/vinay-m.png';
import nirmalaMnImg from '../assets/team/nirmala-mn.png';
import balakrishnanCImg from '../assets/team/balakrishnan-c.png';
import gayathrySwImg from '../assets/team/gayathry-sw.png';
import rajasekharDImg from '../assets/team/rajasekhar-d.png';
import alexeyPImg from '../assets/team/alexey-p.png';
import krishnaPImg from '../assets/team/krishna-p.png';
import jehosonJjImg from '../assets/team/jehoson-jj.png';
import shashwatImg from '../assets/team/1745844616185.jpeg';
import vishnuImg from '../assets/team/profile-pic.jpg';
import shruthiImg from '../assets/team/shruthi-patel.jpg';
import jackJoyImg from '../assets/team/jack-sir.JPG.jpeg';
export default function Team() {
    useScrollAnimation();

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>The Curators</h1>
                    <p>Meet the researchers bridging the gap between art and algorithms.</p>
                </div>
            </section>

            <section className="section">

                {/* Mentors */}
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>Mentors</h2>
                <div className="team-grid" style={{ marginBottom: '4rem' }}>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${bijuKcImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Chief Curator</span>
                        <h3>Dr. Fr. Biju K C</h3>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${vinayMImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Co-Chief Curator</span>
                        <h3>Dr. Vinay M</h3>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${nirmalaMnImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Co-Chief Curator</span>
                        <h3>Dr. Nirmala M N</h3>
                    </div>
                </div>

                {/* Core Coordination Team */}
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>Core Coordination Team</h2>
                <div className="team-grid" style={{ marginBottom: '4rem' }}>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${balakrishnanCImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Coordinator & Curator</span>
                        <h3>Dr. Balakrishnan C</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Computer Science-BYC</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${gayathrySwImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Curator - Technical</span>
                        <h3>Dr. Gayathry S Warrier</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Computer Science-BYC</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${rajasekharDImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Curator - Cultural</span>
                        <h3>Dr. Rajasekhar D</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Media Studies-BYC</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ background: '#00acc1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>JJ</div>
                        <span className="profile-badge">Curator - Logistics</span>
                        <h3>Mr. Jack Joy</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>CDL-BYC</p>
                    </div>
                </div>

                {/* Collaborating Partner */}
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>Collaborating Partner</h2>
                <div className="team-grid" style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'center' }}>
                    <div className="profile-card" style={{ maxWidth: '350px' }}>
                        <div className="profile-img" style={{ backgroundImage: `url(${alexeyPImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">DataArt IT Museum Curator</span>
                        <h3>Dr. Alexey Pomigalov</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>DataArt</p>
                    </div>
                </div>

                {/* Editorial Team */}
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>Editorial Team</h2>
                <div className="team-grid" style={{ marginBottom: '4rem', justifyContent: 'center' }}>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${krishnaPImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Editor - Technical</span>
                        <h3>Dr. Krishna Presannakumar</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Computer Science-BYC</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${jehosonJjImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">Editor - Linguistic</span>
                        <h3>Dr. Jehoson Jiresh J</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>English & Cultural Studies-BYC</p>
                    </div>
                </div>

                {/* Student Developers */}
                <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary)', fontFamily: 'Playfair Display, serif' }}>Student Developers</h2>
                <div className="team-grid" style={{ justifyContent: 'center' }}>
                    <div className="profile-card">
                        <div className="profile-img" style={{ background: '#7986cb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>SP</div>
                        <span className="profile-badge">BCA</span>
                        <h3>Shruthi S Patel</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Front End Developer</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${vishnuImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">BCA</span>
                        <h3>Vishnu S</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Back End Developer</p>
                    </div>
                    <div className="profile-card">
                        <div className="profile-img" style={{ backgroundImage: `url(${shashwatImg})`, backgroundSize: 'cover', backgroundPosition: 'top center', backgroundColor: '#e0e0e0' }}></div>
                        <span className="profile-badge">BCA</span>
                        <h3>Shashwat</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Full Stack Developer</p>
                    </div>
                </div>

            </section>
        </div>
    );
}
