import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from '../firebase-config';
import ReviewPanel from '../components/admin/ReviewPanel';
import KeywordExtractor from '../components/admin/KeywordExtractor';
// import { contentService, Section } from '../services/contentService'; // Currently unused

// Define types for Section data


type UserRole = 'admin' | 'reviewer_first' | 'reviewer_technical' | 'reviewer_literature';

export default function Admin() {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>('admin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);

    // Dashboard State - Currently unused, kept for future functionality
    // const [title, setTitle] = useState('');
    // const [content, setContent] = useState('');
    // const [sections, setSections] = useState<Section[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser && currentUser.email) {
                // Role mapping based on Christ University email patterns
                const email = currentUser.email.toLowerCase();

                // Literature Reviewer (Check first to prevent 'litreview' matching 'itreview')
                if (email.includes('itmuseum.literaturereview') || email.includes('literaturereview') || email.includes('litreview')) setRole('reviewer_literature');

                // Technical Reviewer
                else if (email.includes('itmuseum.technicalreview') || email.includes('technicalreview') || email.includes('techreview')) setRole('reviewer_technical');

                // IT Reviewer (formerly First Reviewer)
                else if (email.includes('itmuseum.itreview') || email.includes('itreview')) setRole('reviewer_first');

                // Admin
                else if (email.includes('itmuseum.admin') || email.includes('admin')) setRole('admin');

                else setRole('admin'); // Default fallback
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to sections for list view (Admin only) - Currently unused
    // useEffect(() => {
    //     if (!user || role !== 'admin') return;
    //
    //     const loadSections = async () => {
    //         try {
    //             const data = await contentService.getSections();
    //             setSections(data as Section[]);
    //         } catch (error) {
    //             console.error("Error loading sections:", error);
    //         }
    //     };
    //
    //     loadSections();
    //     // Set up an interval or real-time subscription here if needed. 
    //     // For now, simple fetch on load is robust.
    // }, [user, role]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            alert("Login Failed: " + error.message);
        }
    };

    const handleCreateTestUsers = async () => {
        const users = [
            { email: 'itmuseum.itreview@christuniversity.in', pass: 'it.christ@26', role: 'IT Reviewer' },
            { email: 'itmuseum.technicalreview@christuniversity.in', pass: 'tech.christ@26', role: 'Technical Reviewer' },
            { email: 'itmuseum.literaturereview@christuniversity.in', pass: 'lit.christ@26', role: 'Literature Reviewer' },
            { email: 'itmuseum.admin@christuniversity.in', pass: 'admin.christ@26', role: 'Admin' }
        ];

        let createdCount = 0;
        for (const u of users) {
            try {
                await createUserWithEmailAndPassword(auth, u.email, u.pass);
                createdCount++;
                console.log(`Created ${u.email}`);
                // Sign out immediately to not get stuck on the last one
                await signOut(auth);
            } catch (error: any) {
                console.log(`Skipped ${u.email} (might exist or error: ${error.message})`);
            }
        }
        alert(`Accounts initialization complete.\n\nCredentials:\n\nIT Reviewer: itmuseum.itreview@christuniversity.in (it.christ@26)\nTechnical: itmuseum.technicalreview@christuniversity.in (tech.christ@26)\nLiterature: itmuseum.literaturereview@christuniversity.in (lit.christ@26)\nAdmin: itmuseum.admin@christuniversity.in (admin.christ@26)`);
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.reload();
    };

    // Admin section management functions - Currently unused, kept for future functionality
    // const handleAddSection = async (e: React.FormEvent) => {
    //     if (role !== 'admin') return;
    //     e.preventDefault();
    //     try {
    //         await contentService.addSection({
    //             title,
    //             content,
    //             order: Date.now()
    //         });
    //         alert("Section Added");
    //         setTitle('');
    //         setContent('');
    //         // Refresh list
    //         const data = await contentService.getSections();
    //         setSections(data as Section[]);
    //     } catch (error: any) {
    //         alert("Error: " + error.message);
    //     }
    // };
    //
    // const handleDelete = async (id: string) => {
    //     if (!window.confirm("Delete this section?")) return;
    //     try {
    //         await contentService.deleteSection(id);
    //         // Refresh list
    //         setSections(sections.filter(s => s.id !== id));
    //     } catch (error: any) {
    //         alert("Error: " + error.message);
    //     }
    // };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    if (!user) {
        return (
            <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div className="card-premium" style={{ width: '90%', maxWidth: '450px', padding: '3rem' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Portal Login</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>IT Museum Administrative Access</p>
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Email Address</label>
                            <input
                                type="email"
                                required
                                placeholder="email@christuniversity.in"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem', transition: 'all 0.3s ease' }}
                            />
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Password</label>
                            <input
                                type="password"
                                required
                                placeholder="Enter your password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem', transition: 'all 0.3s ease' }}
                            />
                        </div>
                        <button type="submit" className="cta-button" style={{ width: '100%', border: 'none', marginBottom: '1rem', fontSize: '1rem', padding: '14px' }}>Sign In</button>
                    </form>

                    {process.env.NODE_ENV === 'development' && (
                        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
                            <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.75rem' }}>Development Tools</p>
                            <button
                                onClick={handleCreateTestUsers}
                                style={{ background: 'none', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.3s ease' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(13, 71, 161, 0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                Initialize User Accounts
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const renderDashboard = () => {
        switch (role) {
            case 'reviewer_first':
                return (
                    <ReviewPanel
                        title="IT Review Panel"
                        currentStageStatus="ADMIN_APPROVED"
                        nextStageStatus="IT_APPROVED"
                        rejectionStatus="ADMIN_REJECTED"
                        reviewerName={user.email || 'IT Reviewer'}
                    />
                );
            case 'reviewer_technical':
                return (
                    <ReviewPanel
                        title="Technical Review Panel"
                        currentStageStatus="IT_APPROVED"
                        nextStageStatus="TECH_APPROVED"
                        rejectionStatus="IT_REJECTED"
                        reviewerName={user.email || 'Tech Reviewer'}
                    />
                );
            case 'reviewer_literature':
                return (
                    <>
                        <ReviewPanel
                            title="Literature Review Panel"
                            currentStageStatus="TECH_APPROVED"
                            nextStageStatus="LIT_APPROVED"
                            rejectionStatus="TECH_REJECTED"
                            reviewerName={user.email || 'Lit Reviewer'}
                            onActionComplete={() => setRefreshKey(prev => prev + 1)}
                        />

                        <div style={{ borderTop: '2px solid #eee', margin: '4rem 0' }}></div>

                        <KeywordExtractor key={refreshKey} />
                    </>
                );
            case 'admin':
            default:
                return (
                    <ReviewPanel
                        title="Admin Triage & Review"
                        currentStageStatus="SUBMITTED"
                        nextStageStatus="ADMIN_APPROVED"
                        rejectionStatus="ADMIN_REJECTED"
                        reviewerName={user.email || 'Admin'}
                    />
                );
        }
    };

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>{role === 'admin' ? 'Admin Dashboard' : 'Reviewer Portal'}</h1>
                    <p>Manage submissions, review articles, and curate the digital museum content.</p>
                </div>
            </section>

            <div className="section" style={{ marginTop: '-4rem', position: 'relative', zIndex: 10 }}>
                <div className="card-premium" style={{ minHeight: '600px' }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Welcome Back</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Logged in as: <strong>{user.email}</strong> <span style={{ background: 'var(--primary-light)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', marginLeft: '10px' }}>{role}</span></p>
                        </div>
                        <button onClick={handleLogout} className="cta-button secondary" style={{ fontSize: '0.9rem', padding: '0.5rem 1.5rem' }}>Logout</button>
                    </header>

                    {renderDashboard()}
                </div>
            </div>
        </div>
    );
}
