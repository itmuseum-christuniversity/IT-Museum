import { FormEvent, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { articleService } from '../services/articleService';

export default function Submission() {
    useScrollAnimation();
    const [loading, setLoading] = useState(false);
    const [googleDocUrl, setGoogleDocUrl] = useState('');
    const [urlError, setUrlError] = useState('');
    const [similarityReportUrl, setSimilarityReportUrl] = useState('');
    const [similarityReportImage, setSimilarityReportImage] = useState<File | null>(null);
    const [similarityReportError, setSimilarityReportError] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        keywords: '',
        numAuthors: 1,
        authors: [{ name: '', email: '', designation: '' }], // Array of author objects
        originalityConfirmed: false
    });

    // Update authors array when numAuthors changes
    const handleNumAuthorsChange = (num: number) => {
        const newAuthors = Array.from({ length: num }, (_, i) =>
            formData.authors[i] || { name: '', email: '', designation: '' }
        );
        setFormData({ ...formData, numAuthors: num, authors: newAuthors });
    };

    // Update individual author field
    const handleAuthorChange = (index: number, field: 'name' | 'email' | 'designation', value: string) => {
        const newAuthors = [...formData.authors];
        newAuthors[index] = { ...newAuthors[index], [field]: value };
        setFormData({ ...formData, authors: newAuthors });
    };

    // Validate Google Docs URL in real-time
    const validateGoogleDocUrl = (url: string) => {
        if (!url) {
            setUrlError('');
            return false;
        }
        if (!url.includes('docs.google.com')) {
            setUrlError('Please enter a valid Google Docs URL');
            return false;
        }
        setUrlError('');
        return true;
    };

    // Validate Similarity Report URL
    const validateSimilarityReportUrl = (url: string) => {
        if (!url) {
            setSimilarityReportError('');
            return false;
        }
        // Accept Google Drive, Dropbox, or other common file sharing URLs
        const validDomains = ['drive.google.com', 'dropbox.com', 'onedrive.live.com', 'docs.google.com'];
        const isValid = validDomains.some(domain => url.includes(domain));
        if (!isValid) {
            setSimilarityReportError('Please provide a valid file sharing URL (Google Drive, Dropbox, etc.)');
            return false;
        }
        setSimilarityReportError('');
        return true;
    };

    // Validate AI Content Percentage


    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate all required fields
            if (!googleDocUrl) {
                alert('Please provide the Google Docs URL.');
                setLoading(false);
                return;
            }

            if (!similarityReportImage) {
                alert('Please upload the similarity report image.');
                setLoading(false);
                return;
            }

            if (!formData.originalityConfirmed) {
                alert('Please confirm that your article is original work.');
                setLoading(false);
                return;
            }

            // Validate URLs
            if (!validateGoogleDocUrl(googleDocUrl)) {
                alert('Please enter a valid Google Docs URL (e.g., https://docs.google.com/document/d/...)');
                setLoading(false);
                return;
            }

            // Validate similarity report URL only if provided (it's optional)
            if (similarityReportUrl && !validateSimilarityReportUrl(similarityReportUrl)) {
                alert('Please enter a valid similarity report URL from a file sharing service.');
                setLoading(false);
                return;
            }


            // Submit using Supabase service
            // Combine all authors' data
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
                similarity_report_url: similarityReportUrl || 'Image uploaded', // Store image reference
                originality_confirmed: formData.originalityConfirmed,
                status: 'submitted'
            }, googleDocUrl);

            alert('✅ Submission successful! Our academic panel will review your article.');
            // Reset form
            setFormData({
                title: '',
                description: '',
                keywords: '',
                numAuthors: 1,
                authors: [{ name: '', email: '', designation: '' }],
                originalityConfirmed: false
            });
            setGoogleDocUrl('');
            setSimilarityReportUrl('');
            setSimilarityReportImage(null);
            setUrlError('');
            setSimilarityReportError('');
        } catch (error: any) {
            console.error("Error submitting document: ", error);
            alert('❌ Submission failed: ' + error.message);
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
                            <div style={{ flex: '1', minWidth: '300px' }} className="text-white-force">
                                <h2 style={{ marginBottom: '1rem', textAlign: 'left', fontSize: '1.8rem', color: 'white' }}>📝 Submission Guidelines</h2>
                                <ul style={{ lineHeight: '1.8', paddingLeft: '1.5rem', color: 'white' }}>
                                    <li style={{ color: 'white' }}>All submissions must be original and not properly published elsewhere.</li>
                                    <li style={{ color: 'white' }}>Articles must strictly follow the IEEE two-column format.</li>
                                    <li style={{ color: 'white' }}>Include a clear abstract (max 250 words) and keywords.</li>
                                    <li style={{ color: 'white' }}><strong>Submit a Google Docs Link</strong> (Access: Anyone with link can comment).</li>
                                </ul>
                            </div>
                            <div>
                                <a href="https://docs.google.com/document/d/1K7n8O0YxF9ywZ-2pG_y5jX5uPq4l3-2/edit"
                                    target="_blank" rel="noopener noreferrer" className="cta-button"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                                    <span>View Google Doc Template</span>
                                </a>
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontSize: '0.85rem' }}>View-only access</p>
                            </div>
                        </div>
                    </div >
                </div >

                {/* Submission Form */}
                < div className="card-premium fade-in" style={{ animationDelay: '0.5s', maxWidth: '800px', margin: '0 auto' }
                }>
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

                        {/* Dynamic Author Fields */}
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

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Similarity Report</label>

                            {/* Image Upload */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.95rem' }}>Upload Report Image (PNG/JPG) *</label>
                                <input
                                    type="file"
                                    required
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setSimilarityReportImage(file);
                                            setSimilarityReportError('');
                                        }
                                    }}
                                    className="enhanced-input"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        backgroundColor: 'white'
                                    }}
                                />
                                {similarityReportImage && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#2e7d32' }}>
                                        ✓ File selected: {similarityReportImage.name}
                                    </p>
                                )}
                                <p style={{ fontSize: '0.85rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                                    Upload a screenshot or PDF export of your similarity/plagiarism report
                                </p>
                            </div>

                            {/* URL Option (Optional) */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.95rem' }}>
                                    Report Link
                                </label>
                                <input
                                    type="url"
                                    placeholder="Paste your similarity/plagiarism report URL (Google Drive, Dropbox, etc.)"
                                    value={similarityReportUrl}
                                    onChange={e => {
                                        setSimilarityReportUrl(e.target.value);
                                        if (e.target.value) {
                                            validateSimilarityReportUrl(e.target.value);
                                        } else {
                                            setSimilarityReportError('');
                                        }
                                    }}
                                    className={`enhanced-input ${similarityReportError ? 'error' : similarityReportUrl && !similarityReportError ? 'success' : ''}`}
                                    style={{ width: '100%', padding: '1rem', border: `2px solid ${similarityReportError ? '#ef5350' : '#e0e0e0'}`, borderRadius: '8px', fontSize: '1rem' }}
                                />
                                {similarityReportError && (
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ef5350' }}>
                                        ❌ {similarityReportError}
                                    </p>
                                )}
                                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                                    ℹ️ Optionally provide a link to your full report for reference
                                </p>
                            </div>
                        </div>


                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Google Docs Link</label>
                            <input
                                type="url"
                                required
                                placeholder="Paste your Google Docs URL here (e.g. https://docs.google.com/document/d/...)"
                                value={googleDocUrl}
                                onChange={e => {
                                    setGoogleDocUrl(e.target.value);
                                    validateGoogleDocUrl(e.target.value);
                                }}
                                className={`enhanced-input ${urlError ? 'error' : googleDocUrl && !urlError ? 'success' : ''}`}
                                style={{ width: '100%', padding: '1rem', border: `2px solid ${urlError ? '#ef5350' : '#e0e0e0'}`, borderRadius: '8px', fontSize: '1rem' }}
                            />
                            {urlError && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#ef5350' }}>
                                    ❌ {urlError}
                                </p>
                            )}
                            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                ℹ️ Please ensure your document Link Sharing is set to <strong>"Anyone with the link can comment"</strong> so our reviewers can provide feedback.
                            </p>
                        </div>

                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '2px solid #0d47a1'
                        }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 600
                            }}>
                                <input
                                    type="checkbox"
                                    required
                                    checked={formData.originalityConfirmed}
                                    onChange={e => setFormData({ ...formData, originalityConfirmed: e.target.checked })}
                                    style={{
                                        marginRight: '0.75rem',
                                        marginTop: '0.25rem',
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span>
                                    I confirm that this article is original work and has not been published elsewhere. I understand that plagiarism or submission of non-original work will result in rejection.
                                </span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                type="submit"
                                className={`cta-button ${loading ? 'loading' : ''}`}
                                disabled={loading || !!urlError || !!similarityReportError || !formData.originalityConfirmed}
                                style={{ fontSize: '1rem', padding: '14px 28px' }}
                            >
                                {loading ? 'Submitting...' : '📤 Submit for Review'}
                            </button>
                        </div>
                    </form >
                </div >
            </div >
        </div >
    );
}
