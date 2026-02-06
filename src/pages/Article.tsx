
import { Link, useParams } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useEffect, useState } from 'react';
import { articleService, Article as ArticleType } from '../services/articleService';

export default function Article() {
    useScrollAnimation();
    const { id } = useParams();
    const [article, setArticle] = useState<ArticleType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id && id !== 'kolam') {
            const loadArticle = async () => {
                try {
                    const data = await articleService.getArticleById(id);
                    setArticle(data);
                } catch (error) {
                    console.error("Failed to load article", error);
                } finally {
                    setLoading(false);
                }
            };
            loadArticle();
        } else {
            setLoading(false);
        }
    }, [id]);

    if (loading) return <div className="page active" style={{ display: 'block', padding: '4rem', textAlign: 'center' }}>Loading research document...</div>;

    // Static Kolam Exhibit
    if (id === 'kolam') {
        return (
            <div className="page active" style={{ display: 'block' }}>
                <div className="article-container">
                    <Link to="/collection" className="article-back-btn">&larr; Back to Collection</Link>

                    <header className="article-header">
                        <span className="profile-badge">Exhibit #001</span>
                        <h1>The Art of Kolam: Symmetry & Computation</h1>
                        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>An in-depth analysis of South Indian threshold designs.</p>
                    </header>

                    <div className="card-premium" style={{ marginBottom: '3rem' }}>
                        <h3>Introduction to Kolam</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Kolam is an ancient Indian folk art extensively used to beautifully adorn the thresholds and open courtyards in front of houses. The word "Kolam" in the Tamil language means form and beauty.</p>
                    </div>

                    <div className="card-premium" style={{ marginBottom: '3rem' }}>
                        <h3>Mathematical Frameworks</h3>
                        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1.5rem' }}>
                            <div>
                                <h4 style={{ color: 'var(--primary)' }}>1. Angular Encoding Model</h4>
                                <p style={{ color: 'var(--text-muted)' }}>Maps angular movements in Kolam drawing to symbol sequences representing directions.</p>
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--primary)' }}>2. Array Grammar</h4>
                                <p style={{ color: 'var(--text-muted)' }}>Uses array grammars and contextual Array P Systems to generate and analyze patterns.</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-premium" style={{ background: 'linear-gradient(135deg, #f3e5f5, white)' }}>
                        <h3>📚 Further Reading</h3>
                        <ul style={{ marginTop: '1rem', marginLeft: '1.5rem', color: 'var(--text-muted)' }}>
                            <li><a href="https://arxiv.org/abs/2307.02144" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Kolam Simulation (arXiv)</a></li>
                            <li><a href="https://www.iitm.ac.in/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>IIT Madras Research Archive</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    // Dynamic Article Handling
    if (!article) {
        return <div className="page active" style={{ display: 'block', padding: '4rem', textAlign: 'center' }}>Article not found (ID: {id})</div>;
    }

    return (
        <div className="page active" style={{ display: 'block', backgroundColor: '#fdfdfd' }}>
            <div className="article-container" style={{ maxWidth: '1200px', padding: '8rem 4rem', backgroundColor: 'white', boxShadow: '0 0 50px rgba(0,0,0,0.02)', margin: '4rem auto', borderRadius: '8px' }}>
                <Link to="/collection" className="article-back-btn" style={{ marginBottom: '4rem', fontSize: '1rem' }}>
                    &larr; Return to Feature Collection
                </Link>

                <header className="article-header" style={{ textAlign: 'left', marginBottom: '6rem', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-1rem', left: 0, width: '60px', height: '6px', background: 'var(--accent)' }}></div>
                    <span className="profile-badge" style={{ marginBottom: '2rem', background: '#e3f2fd', color: '#0d47a1', letterSpacing: '1.5px', textTransform: 'uppercase', padding: '6px 16px' }}>
                        Feature Article • {new Date(article.created_at || '').getFullYear()}
                    </span>
                    <h1 style={{ fontSize: '4rem', lineHeight: '1.1', fontWeight: 800, color: '#002147', marginBottom: '2rem' }}>
                        {article.title}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(45deg, #0d47a1, #1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>
                            {article.author_name.charAt(0)}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, color: '#333' }}>{article.author_name}</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Corresponding Author • IT Museum Faculty</p>
                        </div>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '3rem', marginBottom: '4rem' }}>
                    <div className="card-premium" style={{ margin: 0, border: 'none', boxShadow: '0 4px 30px rgba(0,0,0,0.05)', padding: '4rem' }}>
                        <h3 style={{ fontSize: '1.8rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--accent)' }}>■</span> Abstract
                        </h3>
                        <p style={{ color: '#444', lineHeight: '1.8', fontSize: '1.1rem', textAlign: 'justify' }}>
                            {article.description}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="card-premium" style={{ margin: 0, border: 'none', background: 'var(--primary-dark)', color: 'white', padding: '2.5rem' }}>
                            <h3 style={{ color: 'var(--accent)', fontSize: '1.3rem', marginBottom: '1.5rem' }}>Citation Details</h3>
                            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'white', marginBottom: '0' }}>
                                <strong style={{ color: 'var(--accent)' }}>Preferred Citation:</strong><br />
                                {article.author_name} ({new Date(article.created_at || '').getFullYear()}). <em>{article.title}</em>. IT Museum Feature Archive.
                            </p>
                        </div>

                        <div className="card-premium" style={{ margin: 0, border: 'none', background: 'linear-gradient(135deg, #fff, #f5f7fa)', padding: '2.5rem' }}>
                            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>Metadata</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Published On</span>
                                    <strong>{new Date(article.created_at || '').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Repository ID</span>
                                    <code style={{ background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>ITM-{id?.substring(0, 8).toUpperCase()}</code>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Format</span>
                                    <strong>Digital PDF Archive</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-premium" style={{ marginBottom: '3rem', padding: '3rem', background: '#fff', border: '1px solid #eee', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', padding: '1rem 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.8rem' }}>Full Feature Article</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Interactive Digital Exhibit • Museum Archive</p>
                        </div>
                        <a href={article.file_url} target="_blank" rel="noopener noreferrer" className="cta-button" style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>⬇️</span> Download Feature PDF
                        </a>
                    </div>

                    <div style={{
                        width: '100%',
                        height: '900px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        backgroundColor: '#525659',
                        position: 'relative',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
                    }}>
                        <iframe
                            src={`${article.file_url}#toolbar=0&navpanes=0`}
                            width="100%"
                            height="100%"
                            title={article.title}
                            style={{ border: 'none' }}
                        />
                        <div style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(255, 215, 0, 0.9)',
                            color: '#002147',
                            padding: '6px 15px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                            pointerEvents: 'none'
                        }}>
                            SECURE VIEW MODE
                        </div>
                    </div>
                </div>

                <footer style={{ textAlign: 'center', marginTop: '6rem', padding: '4rem 0', borderTop: '1px solid #eee' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        © {new Date().getFullYear()} Christ University IT Museum Research. All Rights Reserved.
                    </p>
                </footer>
            </div>
        </div>
    );
}

