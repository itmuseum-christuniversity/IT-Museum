
import { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import keyword_extractor from 'keyword-extractor';
import { articleService, Article } from '../../services/articleService';
import { supabase } from '../../lib/supabase';

export default function KeywordExtractor() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedFileName, setUploadedFileName] = useState('');

    useEffect(() => {
        loadReadyArticles();
    }, []);

    const loadReadyArticles = async () => {
        setLoading(true);
        try {
            // Fetch articles that are ready for publishing
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .eq('status', 'ready_for_publishing')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setArticles(data || []);
        } catch (error) {
            console.error("Error loading articles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectArticle = (article: Article) => {
        setSelectedArticle(article);

        // Merge existing tags with submitter's keywords
        let initialKeywords: string[] = article.tags || [];

        if (article.keywords) {
            // Split comma-separated keywords from submission
            const submitterKeywords = article.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

            // Merge strictly
            initialKeywords = Array.from(new Set([...initialKeywords, ...submitterKeywords]));
        }

        setKeywords(initialKeywords);
        setUploadedFileName('');
        setProgress(0);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadedFileName(file.name);
        setProcessing(true);
        setProgress(10); // Start progress

        try {
            // Simulate progress steps
            await new Promise(r => setTimeout(r, 500));
            setProgress(30);

            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const text = result.value;

            setProgress(60);
            await new Promise(r => setTimeout(r, 300));

            // 1. Extract Keywords (Standard NLP)
            const extractionResult = keyword_extractor.extract(text, {
                language: "english",
                remove_digits: true,
                return_changed_case: true, // Keep original case for potential proper nouns here too
                remove_duplicates: true
            });

            // 2. Extract Proper Nouns via Regex (Simple heuristic: Capitalized words in middle of sentences)
            // Matches words starting with Capital not at start of sentence (conceptually hard without sentence splitting, 
            // but simply matching [A-Z][a-z]+ can work well for names/places)
            const properNounRegex = /\b[A-Z][a-zA-Z]+\b/g;
            const properNouns = text.match(properNounRegex) || [];

            // Filter common stop words from proper nouns just in case (like 'The', 'A')
            const commonStarts = ['The', 'A', 'An', 'This', 'That', 'It', 'In', 'On', 'For', 'Of', 'With', 'And', 'But'];
            const filteredProperNouns = properNouns.filter(w => !commonStarts.includes(w) && w.length > 3);

            // Combine
            const allCandidates = [...filteredProperNouns, ...extractionResult];

            // Filter and Deduplicate
            const uniqueKeywords = Array.from(new Set(allCandidates));

            // Select Top Results (Logic: Proper nouns first, then others)
            // Dynamic limit: Base 30, plus 1 for every 30 words, capped at 100 to prevent UI clutter
            const wordCount = text.split(/\s+/).length;
            const dynamicLimit = Math.min(100, Math.max(30, Math.ceil(wordCount / 30)));

            const finalKeywords = uniqueKeywords
                .filter(w => w.length > 3)
                .slice(0, dynamicLimit);

            // Merge with existing unique keywords
            const newKeywords = Array.from(new Set([...keywords, ...finalKeywords]));
            setKeywords(newKeywords);

            setProgress(100);
            await new Promise(r => setTimeout(r, 200));
        } catch (error: any) {
            alert("Error parsing file: " + error.message);
            setProgress(0);
        } finally {
            setProcessing(false);
        }
    };

    const addManualKeywords = (val: string) => {
        if (!val.trim()) return;

        // Support comma-separated entry
        const newTags = val.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

        if (newTags.length > 0) {
            // Merge and deduplicate
            const uniqueNewKeywords = newTags.filter(tag => !keywords.includes(tag));

            if (uniqueNewKeywords.length > 0) {
                setKeywords([...keywords, ...uniqueNewKeywords]);
            }
        }
    };

    const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const input = e.target as HTMLInputElement;
            addManualKeywords(input.value);
            input.value = '';
        }
    };

    const removeKeyword = (k: string) => {
        setKeywords(keywords.filter(w => w !== k));
    };

    const handlePublishLive = async () => {
        if (!selectedArticle?.id) return;

        if (keywords.length === 0 && !window.confirm("Publish without keywords?")) return;

        try {
            // Update keywords AND Status
            await articleService.updateArticleDetails(selectedArticle.id, {
                tags: keywords,
                status: 'published'
            });

            alert("Article is now LIVE!");

            // Remove from local list since it's now published
            setArticles(articles.filter(a => a.id !== selectedArticle.id));
            setSelectedArticle(null);
            setKeywords([]);
            setUploadedFileName('');
            setProgress(0);

        } catch (error: any) {
            alert("Error publishing: " + error.message);
        }
    };

    if (loading) return <div>Loading articles for analysis...</div>;

    return (
        <div className="card-premium" style={{ marginBottom: '3rem' }}>
            <h2>Keyword Analysis & Extraction</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Analyze articles approved by the Lit Reviewer. Extract keywords before final publishing.
            </p>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Article List */}
                <div style={{ flex: 1, minWidth: '300px', borderRight: '1px solid #eee', paddingRight: '2rem' }}>
                    <h3>Ready for Analysis</h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {articles.length === 0 ? <p>No articles waiting for analysis.</p> : (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {articles.map(article => (
                                    <li key={article.id}
                                        onClick={() => handleSelectArticle(article)}
                                        style={{
                                            padding: '1rem',
                                            border: selectedArticle?.id === article.id ? '2px solid var(--primary)' : '1px solid #eee',
                                            marginBottom: '0.5rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            background: selectedArticle?.id === article.id ? '#e3f2fd' : 'white'
                                        }}
                                    >
                                        <strong style={{ display: 'block' }}>{article.title}</strong>
                                        <small>{article.author_name}</small>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Extraction Panel */}
                <div style={{ flex: 2, minWidth: '300px' }}>
                    {selectedArticle ? (
                        <div>
                            <h3 style={{ marginTop: 0 }}>Analysis: {selectedArticle.title}</h3>

                            {selectedArticle.file_url && (
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
                                    <p style={{ margin: 0, fontWeight: 500, color: '#1565c0' }}>
                                        Original Submission: {' '}
                                        <a href={selectedArticle.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                                            Open Google Doc ↗
                                        </a>
                                    </p>
                                    <small style={{ display: 'block', marginTop: '0.5rem', color: '#555' }}>
                                        Step 0: Open this doc, go to File &gt; Download &gt; Microsoft Word (.docx).
                                    </small>
                                </div>
                            )}

                            <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Step 1: Upload .docx File</label>

                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="file"
                                        id="docx-upload"
                                        accept=".docx"
                                        onChange={handleFileUpload}
                                        disabled={processing}
                                        style={{ display: 'none' }}
                                    />
                                    <label
                                        htmlFor="docx-upload"
                                        style={{
                                            display: 'block',
                                            padding: '2rem',
                                            border: '2px dashed #bbb',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            background: uploadedFileName ? '#e8f5e9' : 'white',
                                            cursor: processing ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            color: uploadedFileName ? '#2e7d32' : '#666'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#bbb'}
                                    >
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                            {processing ? '⏳' : (uploadedFileName ? '✅' : '📄')}
                                        </div>
                                        {processing ? (
                                            <span style={{ fontWeight: 'bold' }}>Analyzing Document...</span>
                                        ) : (
                                            uploadedFileName ? (
                                                <>
                                                    <span style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem' }}>Analysis Complete!</span>
                                                    <span style={{ fontSize: '0.9rem' }}>File: {uploadedFileName}</span>
                                                    <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>(Click to upload different file)</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span style={{ display: 'block', fontWeight: 'bold' }}>Click to Upload Word Document</span>
                                                    <span style={{ fontSize: '0.8rem' }}>(.docx format only)</span>
                                                </>
                                            )
                                        )}
                                    </label>
                                </div>

                                {processing && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <div style={{ height: '8px', background: '#ccc', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '4px' }}>{progress}% Analyzed</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Step 2: Manage Keywords</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', minHeight: '50px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    {keywords.map(k => (
                                        <span key={k} style={{
                                            background: 'var(--secondary, #eee)',
                                            color: 'black',
                                            padding: '4px 10px',
                                            borderRadius: '16px',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            {k}
                                            <button
                                                onClick={() => removeKeyword(k)}
                                                style={{ background: 'none', border: 'none', color: 'black', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                                            >×</button>
                                        </span>
                                    ))}
                                    {keywords.length === 0 && <span style={{ color: '#999', padding: '4px' }}>No keywords yet. Upload file or add manually.</span>}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        id="manual-keyword-input"
                                        placeholder="Type keyword..."
                                        onKeyDown={handleAddKeyword}
                                        style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('manual-keyword-input') as HTMLInputElement;
                                            if (input) {
                                                addManualKeywords(input.value);
                                                input.value = '';
                                            }
                                        }}
                                        className="cta-button"
                                        style={{ padding: '0 1.5rem', borderRadius: '4px', background: 'var(--primary)', height: 'auto', display: 'flex', alignItems: 'center' }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handlePublishLive}
                                className="cta-button"
                                style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', background: 'linear-gradient(45deg, #43a047, #2e7d32)' }}
                            >
                                🚀 Publish Live to Website
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999', border: '2px dashed #ddd', borderRadius: '8px' }}>
                            <p>Select an article to begin (from left)</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
