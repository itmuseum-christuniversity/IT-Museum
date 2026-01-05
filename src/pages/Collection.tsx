
import { useNavigate } from 'react-router-dom';
import DynamicCollections from '../components/DynamicCollections';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

import { useState, useEffect } from 'react';
import { articleService, Article } from '../services/articleService';

export default function Collection() {
    useScrollAnimation();
    const navigate = useNavigate();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadArticles = async () => {
            try {
                const data = await articleService.getAcceptedArticles();
                setArticles(data);
            } catch (error) {
                console.error("Failed to load articles", error);
            } finally {
                setLoading(false);
            }
        };
        loadArticles();
    }, []);

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>Digital Archive</h1>
                    <p>Select an exhibit to explore detailed research and artifacts.</p>
                </div>
            </section>

            <section className="section" style={{ marginTop: '2rem' }}>
                <div className="gallery-grid">
                    {/* Exhibit 1: Kolam Art */}
                    <a onClick={() => navigate('/article/kolam')} className="gallery-item" style={{ cursor: 'pointer' }}>
                        <div className="gallery-thumb">
                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #4A148C, #7B1FA2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>🥨</div>
                        </div>
                        <div className="gallery-content">
                            <span className="gallery-tag">Ethnomathematics</span>
                            <h3>The Art of Kolam</h3>
                            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Exploring the recursive geometry and array grammars hidden within traditional threshold patterns.</p>
                            <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', marginTop: '1rem', display: 'block' }}>Read Article &rarr;</span>
                        </div>
                    </a>

                    {/* Dynamic Articles from Supabase */}
                    {loading ? (
                        <p>Loading archive...</p>
                    ) : (
                        articles.map((article) => (
                            <a key={article.id} href={article.file_url} target="_blank" rel="noopener noreferrer" className="gallery-item">
                                <div className="gallery-thumb">
                                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #006064, #0097A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>📄</div>
                                </div>
                                <div className="gallery-content">
                                    <span className="gallery-tag">Research Paper</span>
                                    <h3>{article.title}</h3>
                                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>By {article.author_name}</p>
                                    <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.abstract}</p>
                                </div>
                            </a>
                        ))
                    )}
                </div>

                <div style={{ marginTop: '3rem' }} className="gallery-grid">
                    <DynamicCollections />
                </div>
            </section>
        </div>
    );
}
