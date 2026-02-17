
import { FormEvent, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { articleService } from '../services/articleService';

export default function Submission() {
    useScrollAnimation();
    const [loading, setLoading] = useState(false);
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [urlError, setUrlError] = useState('');
    const [similarityReportFile, setSimilarityReportFile] = useState<File | null>(null);
    const [aiReportFile, setAiReportFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        keywords: '',
        numAuthors: 1,
        submitterEmail: '',
        authors: [{ name: '', email: '', designation: '' }],
        originalityConfirmed: false
    });

    const handleNumAuthorsChange = (num: number) => {
        const newAuthors = Array.from({ length: num }, (_, i) =>
            formData.authors[i] || { name: '', email: '', designation: '' }
        );
        setFormData({ ...formData, numAuthors: num, authors: newAuthors });
    };

    const handleAuthorChange = (index: number, field: 'name' | 'email' | 'designation', value: string) => {
        const newAuthors = [...formData.authors];
        newAuthors[index] = { ...newAuthors[index], [field]: value };
        setFormData({ ...formData, authors: newAuthors });
    };

    const validateGoogleDocUrl = (url: string) => {
        if (!url) {
            setUrlError('Please provide the Google Docs URL.');
            return false;
        }
        if (!url.includes('docs.google.com/document') && !url.includes('drive.google.com')) {
            setUrlError('Please provide a valid Google Docs or Google Drive URL.');
            return false;
        }
        setUrlError('');
        return true;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!googleDocUrl) {
                alert('Please provide the Google Docs URL.');
                setLoading(false);
                return;
            }

            if (!similarityReportFile) {
                alert('Please upload the Similarity Report PDF.');
                setLoading(false);
                return;
            }

            if (!aiReportFile) {
                alert('Please upload the AI Detection Report PDF.');
                setLoading(false);
                return;
            }

            if (!formData.originalityConfirmed) {
                alert('Please confirm that your article is original work.');
                setLoading(false);
                return;
            }

            const keywordRegex = /^([a-zA-Z0-9\s-]+,)*[a-zA-Z0-9\s-]+$/;
            if (!keywordRegex.test(formData.keywords.trim())) {
                alert('Please enter keywords in a comma-separated format (e.g. "AI, Machine Learning, Data Science").');
                setLoading(false);
                return;
            }

            if (!validateGoogleDocUrl(googleDocUrl)) {
                alert('Please enter a valid Google Docs URL.');
                setLoading(false);
                return;
            }

            // Upload reports to Supabase
            const similarityReportUrl = await articleService.uploadFile(similarityReportFile, 'reports');
            const aiReportUrl = await articleService.uploadFile(aiReportFile, 'reports');

            const allAuthorsNames = formData.authors.map(a => a.name).join(', ');
            const allAuthorsEmails = formData.authors.map(a => a.email).join(', ');
            const allAuthorsDesignations = formData.authors.map(a => a.designation).join(', ');

            await articleService.submitArticle({
                title: formData.title,
                author_name: allAuthorsNames,
                institution_email: allAuthorsEmails,
                description: formData.description,
                keywords: formData.keywords,
                num_authors: formData.numAuthors,
                author_designations: allAuthorsDesignations,
                submitted_email: formData.submitterEmail,
                similarity_report_url: similarityReportUrl,
                ai_report_url: aiReportUrl,
                originality_confirmed: formData.originalityConfirmed,
                status: 'SUBMITTED',
                file_url: googleDocUrl
            });

            alert('✅ Submission successful! Our academic panel will review your article.');
            setFormData({
                title: '',
                description: '',
                keywords: '',
                numAuthors: 1,
                submitterEmail: '',
                authors: [{ name: '', email: '', designation: '' }],
                originalityConfirmed: false
            });
            setGoogleDocUrl('');
            setSimilarityReportFile(null);
            setAiReportFile(null);
            setUrlError('');
        } catch (error: any) {
            console.error("Error submitting document: ", error);
            alert('❌ Submission failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ padding: '6rem 2rem 4rem', minHeight: '50vh', background: 'white' }}>
                <div className="hero-content">
                    <h1 className="fade-in">Submission Portal</h1>
                    <p className="fade-in" style={{ animationDelay: '0.2s' }}>
                        Contribute to document Indian IT Innovations
                    </p>
                </div>
            </section>

            <div className="section" style={{ marginTop: '-4rem', position: 'relative', zIndex: 10 }}>
                <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '4rem', flexWrap: 'wrap', animationDelay: '0.3s' }}>
                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{ background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem' }}>1</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Download Template</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Please ensure that your contribution meets all the requirements given below.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{ background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem' }}>2</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Prepare Manuscript</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Write your paper in Google Docs. Ensure you grant <strong>commenter access</strong> to our editorial team.</p>
                    </div>

                    <div className="card-premium" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', textAlign: 'center', padding: '2rem' }}>
                        <div style={{ background: 'rgba(13, 71, 161, 0.1)', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 1rem' }}>3</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Submit URL</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Paste your Google Docs URL below. Our academic panel will review your submission directly in the document.</p>
                    </div>
                </div>

                <div className="fade-in" style={{ animationDelay: '0.4s', maxWidth: '1000px', margin: '0 auto 4rem' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0d1b2a 0%, var(--primary) 100%)', color: 'white', padding: '3rem', borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-soft)' }}>
                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                            <div style={{ flex: '1', minWidth: '300px' }} className="text-white-force">
                                <h2 style={{ marginBottom: '1rem', textAlign: 'left', fontSize: '1.8rem', color: 'white' }}>📝 Submission Guidelines</h2>
                                <ul style={{ lineHeight: '1.8', paddingLeft: '1.5rem', color: 'white' }}>
                                    <li style={{ color: 'white' }}>All submissions must be original and not previously published elsewhere.</li>
                                    <li style={{ color: 'white' }}>Include a clear abstract (max 250 words) and keywords.</li>
                                    <li style={{ color: 'white' }}>AI-generated content must not exceed 5% of the total manuscript.</li>
                                    <li style={{ color: 'white' }}>Paste the Google Docs link or Google Drive link in the submission field.</li>
                                    <li style={{ color: 'white' }}>You can add relevant pictures and videos within your document if needed.</li>
                                    <li style={{ background: '#FFD700', color: '#002147', padding: '12px 20px', borderRadius: '8px', listStyle: 'none', marginLeft: '-1.5rem', marginTop: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', fontWeight: 'bold', textAlign: 'center' }}>
                                        Give Commenter Access to the document before submitting
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <a href="https://docs.google.com/document/d/1ExampleTemplate_URL" target="_blank" rel="noopener noreferrer" className="cta-button" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                                    <span>View Document Template</span>
                                </a>
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Opens in Google Docs</p>
                            </div>
                        </div>
                    </div >
                </div >

                < div className="card-premium fade-in" style={{ animationDelay: '0.5s', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', marginBottom: '2rem', fontSize: '1.5rem' }}>New Submission</h2>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Article Title</label>
                            <input
                                type="text"
                                required
                                placeholder="Enter the full title of your research paper"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Submitter Email</label>
                            <input
                                type="email"
                                required
                                placeholder="Enter your email for notifications"
                                value={formData.submitterEmail}
                                onChange={e => setFormData({ ...formData, submitterEmail: e.target.value })}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                            />
                            <p style={{ fontSize: '0.85rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                                Important: We will use this email to communicate the status of your submission (acceptance/rejection).
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Number of Authors</label>
                            <select
                                required
                                value={formData.numAuthors}
                                onChange={e => handleNumAuthorsChange(parseInt(e.target.value))}
                                className="enhanced-input"
                                style={{ width: '100%', maxWidth: '200px', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem', backgroundColor: 'white' }}
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.85rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                                Select the total number of authors
                            </p>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)' }}>Author Information</h3>
                            {formData.authors.map((author, index) => (
                                <div key={index} style={{
                                    marginBottom: '1.5rem',
                                    padding: '1.5rem',
                                    backgroundColor: index === 0 ? '#f0f7ff' : '#f8f9fa',
                                    borderRadius: '8px',
                                    border: `2px solid ${index === 0 ? '#0d47a1' : '#e0e0e0'}`
                                }}>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>
                                        {index === 0 ? '👤 Primary Author' : `👤 Author ${index + 1}`}
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Full Name *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Enter full name"
                                                value={author.name}
                                                onChange={e => handleAuthorChange(index, 'name', e.target.value)}
                                                className="enhanced-input"
                                                style={{ width: '100%', padding: '0.875rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Institutional Email *</label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="name@university.edu"
                                                value={author.email}
                                                onChange={e => handleAuthorChange(index, 'email', e.target.value)}
                                                className="enhanced-input"
                                                style={{ width: '100%', padding: '0.875rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Designation *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g., Associate Professor"
                                                value={author.designation}
                                                onChange={e => handleAuthorChange(index, 'designation', e.target.value)}
                                                className="enhanced-input"
                                                style={{ width: '100%', padding: '0.875rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Description</label>
                            <textarea
                                rows={6}
                                required
                                placeholder="Provide a comprehensive description of your research (approx. 200-250 words)..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem', resize: 'vertical' }}
                            ></textarea>
                            <p className="char-counter" style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                {formData.description.split(' ').filter((x: string) => x).length} / 250 words
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Keywords</label>
                            <input
                                type="text"
                                required
                                placeholder="Enter keywords separated by commas (e.g., machine learning, neural networks, AI)"
                                value={formData.keywords}
                                onChange={e => setFormData({ ...formData, keywords: e.target.value })}
                                className="enhanced-input"
                                style={{ width: '100%', padding: '1rem', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '1rem' }}
                            />
                            <p style={{ fontSize: '0.85rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                                These keywords help categorize and index your research
                            </p>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '1.5rem', fontWeight: 600, fontSize: '1.1rem' }}>Research Reports</label>

                            {/* Similarity Report */}
                            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>1. SIMILARITY REPORT (PDF) *</label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setSimilarityReportFile(file);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white' }}
                                />
                                {similarityReportFile && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#2e7d32' }}>
                                        ✓ {similarityReportFile.name}
                                    </p>
                                )}
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Upload your plagiarism/similarity report in PDF format.</p>
                            </div>

                            {/* AI Detection Report */}
                            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', marginBottom: '0.8rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>2. AI DETECTION REPORT (PDF) *</label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setAiReportFile(file);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e0e0e0', borderRadius: '8px', backgroundColor: 'white' }}
                                />
                                {aiReportFile && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#2e7d32' }}>
                                        ✓ {aiReportFile.name}
                                    </p>
                                )}
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>Upload your AI content detection report in PDF format.</p>
                                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#d32f2f', fontWeight: 'bold' }}>
                                    ⚠️ AI content policy: Only up to 5% AI-generated content is permitted.
                                </p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Submit your work (Google Doc or Drive link with Commenter Access)</label>
                            <input
                                type="url"
                                required
                                placeholder="Paste your Google Docs or Google Drive URL here"
                                value={googleDocUrl}
                                onChange={e => {
                                    setGoogleDocUrl(e.target.value);
                                    validateGoogleDocUrl(e.target.value);
                                }}
                                className={`enhanced-input ${urlError ? 'error' : googleDocUrl && !urlError ? 'success' : ''}`}
                                style={{ width: '100%', padding: '1rem', border: `2px solid ${urlError ? '#ef5350' : '#e0e0e0'}`, borderRadius: '8px', fontSize: '1rem' }}
                            />
                            {urlError && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ef5350' }}>❌ {urlError}</p>
                            )}
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                ℹ️ <strong>Give Commenter Access</strong> to the document before submitting.
                            </p>
                        </div>

                        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #0d47a1' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}>
                                <input
                                    type="checkbox"
                                    required
                                    checked={formData.originalityConfirmed}
                                    onChange={e => setFormData({ ...formData, originalityConfirmed: e.target.checked })}
                                    style={{ marginRight: '0.75rem', marginTop: '0.25rem', width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <span>I confirm that this article is original work and has not been published elsewhere. I understand that plagiarism or submission of non-original work will result in rejection.</span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                type="submit"
                                className={`cta-button ${loading ? 'loading' : ''}`}
                                disabled={loading || !!urlError || !googleDocUrl || !similarityReportFile || !aiReportFile || !formData.originalityConfirmed}
                                style={{ fontSize: '1rem', padding: '14px 28px' }}
                            >
                                {loading ? 'Submitting...' : '📤 Submit Article'}
                            </button>
                        </div>
                    </form >
                </div >
            </div >
        </div >
    );
}
