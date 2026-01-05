import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from '../firebase-config';
import ReviewPanel from '../components/admin/ReviewPanel';

// Define types for Section data
interface Section {
    id: string;
    title: string;
    content: string;
    order: number;
}

type UserRole = 'admin' | 'reviewer_first' | 'reviewer_technical' | 'reviewer_literature';

export default function Admin() {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>('admin');
    const [activeTab, setActiveTab] = useState<'content' | 'reviews'>('content');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);

    // Dashboard State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [sections, setSections] = useState<Section[]>([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser && currentUser.email) {
                // Simple hardcoded role mapping for demonstration
                // In production, this should be fetched from a 'users' collection
                if (currentUser.email.includes('reviewer1')) setRole('reviewer_first');
                else if (currentUser.email.includes('tech')) setRole('reviewer_technical');
                else if (currentUser.email.includes('lit')) setRole('reviewer_literature');
                else setRole('admin');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to sections for list view (Admin only)
    useEffect(() => {
        if (!user || role !== 'admin') return;
        const q = query(collection(db, "sections"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const secs: Section[] = [];
            snapshot.forEach((doc) => {
                secs.push({ id: doc.id, ...doc.data() } as Section);
            });
            setSections(secs);
        });
        return () => unsubscribe();
    }, [user, role]);

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
            { email: 'reviewer1@it.edu', pass: 'password123', role: 'First Reviewer' },
            { email: 'tech@it.edu', pass: 'password123', role: 'Technical Reviewer' },
            { email: 'lit@it.edu', pass: 'password123', role: 'Literature Reviewer' },
            { email: 'admin@it.edu', pass: 'password123', role: 'Admin' }
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
                console.log(`Skipped ${u.email} (might exist)`);
            }
        }
        alert(`Process Complete. Try logging in as:\nreviewer1@it.edu\ntech@it.edu\nlit@it.edu\nadmin@it.edu\n\nPassword for all: password123`);
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.reload();
    };

    const handleAddSection = async (e: React.FormEvent) => {
        if (role !== 'admin') return;
        e.preventDefault();
        try {
            await addDoc(collection(db, "sections"), {
                title,
                content,
                order: Date.now()
            });
            alert("Section Added");
            setTitle('');
            setContent('');
        } catch (error: any) {
            alert("Error: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this section?")) return;
        try {
            await deleteDoc(doc(db, "sections", id));
        } catch (error: any) {
            alert("Error: " + error.message);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

    if (!user) {
        return (
            <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
                <div className="card-premium" style={{ width: '90%', maxWidth: '450px', padding: '3rem' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Portal Login</h2>
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email</label>
                            <input
                                type="email"
                                required
                                placeholder="role@university.edu"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Password</label>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                        <button type="submit" className="cta-button" style={{ width: '100%', border: 'none', marginBottom: '1rem' }}>Login</button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>Developer Tools</p>
                        <button
                            onClick={handleCreateTestUsers}
                            style={{ background: 'none', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            Create Test Accounts (Dev)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const renderDashboard = () => {
        switch (role) {
            case 'reviewer_first':
                return (
                    <ReviewPanel
                        title="First Review Panel"
                        currentStageStatus="submitted"
                        nextStageStatus="approved_first"
                        reviewerName={user.email || 'Reviewer 1'}
                    />
                );
            case 'reviewer_technical':
                return (
                    <ReviewPanel
                        title="Technical Review Panel"
                        currentStageStatus="approved_first"
                        nextStageStatus="approved_technical"
                        reviewerName={user.email || 'Tech Reviewer'}
                    />
                );
            case 'reviewer_literature':
                return (
                    <ReviewPanel
                        title="Literature Review Panel"
                        currentStageStatus="approved_technical"
                        nextStageStatus="approved_literature"
                        reviewerName={user.email || 'Lit Reviewer'}
                    />
                );
            case 'admin':
            default:
                return (
                    <>
                        <ReviewPanel
                            title="Final Publisher Approval"
                            currentStageStatus="approved_literature"
                            nextStageStatus="published"
                            reviewerName={user.email || 'Admin'}
                        />

                        <div style={{ borderTop: '2px solid #eee', margin: '4rem 0' }}></div>

                        <h2>Website Content Management</h2>
                        <div className="card-premium" style={{ marginBottom: '3rem', marginTop: '2rem' }}>
                            <h3>Add New Home Section</h3>
                            <form onSubmit={handleAddSection} style={{ marginTop: '2rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
                                    />
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Content (HTML allowed)</label>
                                    <textarea
                                        value={content}
                                        onChange={e => setContent(e.target.value)}
                                        rows={5}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
                                    />
                                </div>
                                <button type="submit" className="cta-button" style={{ border: 'none' }}>Add Section</button>
                            </form>
                        </div>

                        <h3>Existing Sections</h3>
                        <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
                            {sections.map(sec => (
                                <div key={sec.id} style={{ background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{sec.title || 'Untitled Section'}</span>
                                    <button onClick={() => handleDelete(sec.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
                                </div>
                            ))}
                        </div>
                    </>
                );
        }
    };

    return (
        <div className="page active" style={{ display: 'block', padding: '2rem' }}>
            <div className="article-container">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div>
                        <h1>{role === 'admin' ? 'Admin Dashboard' : 'Reviewer Portal'}</h1>
                        <p style={{ color: '#666' }}>Logged in as: {user.email} <span style={{ background: '#eee', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8em', marginLeft: '10px' }}>{role}</span></p>
                    </div>
                    <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#e0e0e0', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
                </header>

                {renderDashboard()}
            </div>
        </div>
    );
}
