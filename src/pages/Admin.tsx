import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "firebase/firestore";
import { auth, db } from '../firebase-config';

// Define types for Section data
interface Section {
    id: string;
    title: string;
    content: string;
    order: number;
}

export default function Admin() {
    const [user, setUser] = useState<User | null>(null);
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
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to sections for list view
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, "sections"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const secs: Section[] = [];
            snapshot.forEach((doc) => {
                secs.push({ id: doc.id, ...doc.data() } as Section);
            });
            setSections(secs);
        });
        return () => unsubscribe();
    }, [user]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            alert("Login Failed: " + error.message);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    const handleAddSection = async (e: React.FormEvent) => {
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
                    <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Admin Portal</h2>
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email</label>
                            <input
                                type="email"
                                required
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
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
                        </div>
                        <button type="submit" className="cta-button" style={{ width: '100%', border: 'none' }}>Login</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="page active" style={{ display: 'block', padding: '2rem' }}>
            <div className="article-container">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <h1>Admin Dashboard</h1>
                    <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#e0e0e0', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Logout</button>
                </header>

                <div className="card-premium" style={{ marginBottom: '3rem' }}>
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
            </div>
        </div>
    );
}
