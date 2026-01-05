import { FormEvent, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';

export default function Submission() {
    useScrollAnimation();
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        email: '',
        abstract: ''
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Note: mixing Firestore and hypothetical storage upload
            // In a real app, upload file to Storage, get URL, then save to Firestore.
            // For now, we simulate the file URL.

            await addDoc(collection(db, "articles"), {
                ...formData,
                status: 'submitted',
                submittedAt: serverTimestamp(),
                originalFilename: file ? file.name : 'unknown',
                fileUrl: '#', // Placeholder for actual storage URL
                history: [
                    {
                        stage: 'submission',
                        action: 'submit',
                        timestamp: new Date().toISOString(),
                        user: formData.email
                    }
                ]
            });

            alert('Thank you for your submission! Our academic panel will review it shortly.');
            setFormData({ title: '', author: '', email: '', abstract: '' });
            setFile(null);
        } catch (error: any) {
            console.error("Error submitting document: ", error);
            alert('Submission failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page active" style={{ display: 'block' }}>
            {/* Hero Section */}
            <section className="hero" style={{ padding: '6rem 2rem 4rem', minHeight: '50vh', background: 'white' }}>
                <div className="hero-content">
                    <h1 className="fade-in">Research Submission Portal</h1>
                    <p className="fade-in" style={{ animationDelay: '0.2s' }}>
                        Contribute to the global repository of Kolam and Computational Art research.
                    </p>
                </div>
            </section>

            <div className="section" style={{ marginTop: '-4rem', position: 'relative', zIndex: 10 }}>
                {/* Process Overview */}
                <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '4rem', flexWrap: 'wrap', animationDelay: '0.3s' }}>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)',
                            width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem'
                        }}>1</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Download Template</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Use the official IEEE format to ensure your article meets our publication standards.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)',
                            width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem'
                        }}>2</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Prepare Manuscript</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Include abstract, keywords, and rigorous analysis. Max file size 10MB.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)',
                            width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem'
                        }}>3</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Submit for Review</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Our academic panel will review your submission for originality and impact.</p>
                    </div>
                </div>

                {/* Guidelines & Template Section */}
                <div className="fade-in" style={{ animationDelay: '0.4s', maxWidth: '1000px', margin: '0 auto 4rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #0d1b2a 0%, var(--primary) 100%)',
                        color: 'white', padding: '3rem', borderRadius: 'var(--radius-lg)',
                        position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-soft)'
                    }}>
                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                            <div style={{ flex: '1', minWidth: '300px' }}>
                                <h2 style={{ color: 'white', marginBottom: '1rem', textAlign: 'left', fontSize: '1.8rem' }}>📝 Submission Guidelines</h2>
                                <ul style={{ color: 'rgba(255,255,255,0.9)', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
                                    <li>All submissions must be original and not properly published elsewhere.</li>
                                    <li>Articles must strictly follow the IEEE two-column format.</li>
                                    <li>Include a clear abstract (max 250 words) and keywords.</li>
                                    <li>Graphics should be high-resolution (300 DPI+).</li>
                                </ul>
                            </div>
                            <div>
                                <a href="https://www.ieee.org/content/dam/ieee-org/ieee/web/org/conferences/conference-template-a4.docx"
                                    target="_blank" rel="noopener noreferrer" className="cta-button"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                                    <span>Download IEEE Template</span>
                                </a>
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontSize: '0.85rem' }}>.DOCX Format</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submission Form */}
                <div className="card-premium fade-in" style={{ animationDelay: '0.5s', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', marginBottom: '2rem', fontSize: '1.5rem' }}>New Submission</h2>

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Article Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter the full title of your research paper"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Primary Author</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Full Name"
                                    value={formData.author}
                                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                                    style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Institutional Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="name@university.edu"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Abstract</label>
                            <textarea
                                rows={6}
                                required
                                placeholder="Paste your abstract here (approx. 200-250 words)..."
                                value={formData.abstract}
                                onChange={e => setFormData({ ...formData, abstract: e.target.value })}
                                style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}
                            ></textarea>
                            <p style={{ textAlign: 'right', color: '#999', fontSize: '0.8rem', marginTop: '0.5rem' }}>{formData.abstract.split(' ').filter(x => x).length} / 250 words</p>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Manuscript Upload</label>
                            <div style={{
                                padding: '3rem', border: '2px dashed #b0bec5', borderRadius: '12px', textAlign: 'center',
                                background: '#fbfbfb', cursor: 'pointer', position: 'relative'
                            }}>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                />
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                                <h4 style={{ marginBottom: '0.5rem' }}>{file ? file.name : "Drag & drop your file here"}</h4>
                                <p style={{ color: '#78909c' }}>or click to browse</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button type="submit" className="cta-button" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Research'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
