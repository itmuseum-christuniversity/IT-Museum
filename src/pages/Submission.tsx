import { FormEvent, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { articleService } from '../services/articleService';

export default function Submission() {
    useScrollAnimation();
    const [loading, setLoading] = useState(false);
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        author: '',
        email: '',
        abstract: ''
    });

<<<<<<< HEAD
=======


>>>>>>> a4a7950 (made the changes to google docs)
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
<<<<<<< HEAD
            if (!googleDocUrl.includes('docs.google.com')) {
                alert('Please provide a valid Google Docs URL (docs.google.com).');
=======
            if (!googleDocUrl) {
                alert('Please provide the Google Docs URL.');
                setLoading(false);
                return;
            }

            // Basic validation for Google Docs URL
            if (!googleDocUrl.includes('docs.google.com')) {
                alert('Please enter a valid Google Docs URL (e.g., https://docs.google.com/document/d/...)');
>>>>>>> a4a7950 (made the changes to google docs)
                setLoading(false);
                return;
            }

            // Submit using Supabase service
            await articleService.submitArticle({
                title: formData.title,
                author_name: formData.author,
                institution_email: formData.email,
                abstract: formData.abstract,
                status: 'submitted'
            }, googleDocUrl);

            alert('Thank you for your submission! Our academic panel will review it using the link provided.');
            setFormData({ title: '', author: '', email: '', abstract: '' });
            setGoogleDocUrl('');
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
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>View Template</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>View our Google Doc template to see the required format and structure.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)',
                            width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem'
                        }}>2</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Prepare Manuscript</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Upload your work to Google Docs and ensure 'Anyone with the link can comment' access.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)',
                            width: '40px', height: '40px', borderRadius: '50%', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem'
                        }}>3</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Submit Link</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Submit the link here. Our academic panel will review your submission.</p>
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
                                    <li><strong>Submit a Google Docs Link</strong> (Access: Anyone with link can comment).</li>
                                </ul>
                            </div>
                            <div>
                                <a href="https://docs.google.com/document/d/1K7n8O0YxF9ywZ-2pG_y5jX5uPq4l3-2/edit" // Replace with actual template link
                                    target="_blank" rel="noopener noreferrer" className="cta-button"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                                    <span>View Google Doc Template</span>
                                </a>
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontSize: '0.85rem' }}>View-only access</p>
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
<<<<<<< HEAD
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Google Document Link</label>
                            <input
                                type="url"
                                required
                                placeholder="https://docs.google.com/document/d/..."
=======
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Google Docs Link</label>
                            <input
                                type="url"
                                required
                                placeholder="Paste your Google Docs URL here (e.g. https://docs.google.com/document/d/...)"
>>>>>>> a4a7950 (made the changes to google docs)
                                value={googleDocUrl}
                                onChange={e => setGoogleDocUrl(e.target.value)}
                                style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}
                            />
<<<<<<< HEAD
                            <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                Please ensure share settings are set to <strong>"Anyone with the link can comment"</strong>.
=======
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                * Please ensure your document Link Sharing is set to "Anyone with the link can comment" so our reviewers can provide feedback.
>>>>>>> a4a7950 (made the changes to google docs)
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button type="submit" className="cta-button" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Link for Review'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
