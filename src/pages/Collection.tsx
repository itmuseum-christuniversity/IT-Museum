
import { useNavigate } from 'react-router-dom';
import DynamicCollections from '../components/DynamicCollections';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

import { useState, useEffect, useMemo } from 'react';
import { articleService, Article } from '../services/articleService';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';

export default function Collection() {
    useScrollAnimation();
    const navigate = useNavigate();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

    // Configure Fuse.js for fuzzy search
    const fuse = useMemo(() => {
        return new Fuse(articles, {
            keys: ['title', 'tags', 'abstract', 'author_name'],
            threshold: 0.4, // 0.0 = perfect match, 1.0 = match anything. 0.4 is good for "lexical ambiguity"
            includeScore: true
        });
    }, [articles]);

    // Perform Search
    const filteredArticles = useMemo(() => {
        if (!searchQuery.trim()) return articles;
        return fuse.search(searchQuery).map(result => result.item);
    }, [searchQuery, articles, fuse]);

    return (
        <div className="page active" style={{ display: 'block' }}>
            <section className="hero" style={{ minHeight: '40vh' }}>
                <div className="hero-content">
                    <h1>Digital Archive</h1>
                    <p>Select an exhibit to explore detailed research and artifacts.</p>
                </div>
            </section>

            <section className="section" style={{ marginTop: '2rem' }}>

                {/* Search Bar - Replaces Topic Filter */}
                <div style={{ maxWidth: '600px', margin: '0 auto 4rem', position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                        <input
                            type="text"
                            placeholder="Search archives (e.g., 'algorithm', 'history')..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '1rem 1rem 1rem 3rem',
                                fontSize: '1.1rem',
                                borderRadius: '30px',
                                border: '1px solid #ddd',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                outline: 'none',
                                transition: 'all 0.3s ease'
                            }}
                            onFocus={(e) => e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'}
                            onBlur={(e) => e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
                        />
                    </div>
                    {searchQuery && (
                        <p style={{ textAlign: 'center', marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
                            Found {filteredArticles.length} result{filteredArticles.length !== 1 ? 's' : ''} for "{searchQuery}"
                        </p>
                    )}
                </div>

                <div className="gallery-grid">
                    {/* Exhibit 1: Kolam Art - Always visible unless search excludes it (but it's static, so we keep it or hide it? usually static exhibits are separate) */}
                    {/* Decision: Keep Kolam visible only if no search, OR we could make Kolam searchable if we added it to the 'articles' list in a unifying way. 
                        For now, requested behavior implies searching the Supabase articles. I'll hide static items if searching to focus on results. 
                    */}
                    {!searchQuery && (
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
                    )}

                    {/* Dynamic Articles from Supabase */}
                    {loading ? (
                        <p>Loading archive...</p>
                    ) : (
                        filteredArticles.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#666', background: '#f9f9f9', borderRadius: '8px' }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No matches found</p>
                                <p style={{ fontSize: '0.9rem' }}>Try checking your spelling or using different keywords.</p>
                            </div>
                        ) : (
                            filteredArticles.map((article) => (
                                <a key={article.id} href={article.file_url} target="_blank" rel="noopener noreferrer" className="gallery-item">
                                    <div className="gallery-thumb">
                                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, #006064, #0097A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>📄</div>
                                    </div>
                                    <div className="gallery-content">
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                            <span className="gallery-tag">Research Paper</span>
                                            {article.tags?.slice(0, 2).map((t, i) => (
                                                <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#eee', borderRadius: '4px', color: '#666' }}>{t}</span>
                                            ))}
                                        </div>
                                        <h3>{article.title}</h3>
                                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>By {article.author_name}</p>
                                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.abstract}</p>
                                    </div>
                                </a>
                            ))
                        )
                    )}
                </div>

                <div style={{ marginTop: '3rem' }} className="gallery-grid">
                    <DynamicCollections />
                </div>
            </section>
        </div>
    );
}
