
import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import keyword_extractor from 'keyword-extractor';
import { articleService, Article } from '../../services/articleService';
import { supabase } from '../../lib/supabase';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function KeywordExtractor() {
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);

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
        setPdfFile(null);
        setProgress(0);
    };

    const extractTextFromPdf = async (arrayBuffer: ArrayBuffer) => {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + ' ';
            setProgress(Math.round((i / pdf.numPages) * 100));
        }

        return fullText;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert("Please upload a PDF file.");
            return;
        }

        setUploadedFileName(file.name);
        setPdfFile(file);
        setProcessing(true);
        setProgress(0);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const text = await extractTextFromPdf(arrayBuffer);

            setProgress(90);
            await new Promise(r => setTimeout(r, 300));

            // 1. Extract Keywords (Standard NLP)
            const extractionResult = keyword_extractor.extract(text, {
                language: "english",
                remove_digits: true,
                return_changed_case: true,
                remove_duplicates: true
            });

            // 2. Extract Proper Nouns via Regex
            const properNounRegex = /\b[A-Z][a-zA-Z]+\b/g;
            const properNouns = text.match(properNounRegex) || [];

            const commonStarts = ['The', 'A', 'An', 'This', 'That', 'It', 'In', 'On', 'For', 'Of', 'With', 'And', 'But'];
            const filteredProperNouns = properNouns.filter(w => !commonStarts.includes(w) && w.length > 3);

            // Combine
            const allCandidates = [...filteredProperNouns, ...extractionResult];

            // Filter and Deduplicate
            const uniqueKeywords = Array.from(new Set(allCandidates));

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
            console.error("PDF Parsing error:", error);
            alert("Error parsing PDF file: " + error.message);
            setProgress(0);
        } finally {
            setProcessing(false);
        }
    };

    const addManualKeywords = (val: string) => {
        if (!val.trim()) return;

        const newTags = val.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

        if (newTags.length > 0) {
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
        if (!pdfFile) {
            alert("Please scan a PDF file before publishing. This PDF will be the version displayed on the website.");
            return;
        }

        if (keywords.length === 0 && !window.confirm("Publish without keywords?")) return;

        setIsPublishing(true);
        try {
            // 1. Upload the PDF to Supabase Storage
            const finalPdfUrl = await articleService.uploadFile(pdfFile, 'articles');

            // 2. Update article with new PDF URL and Keywords
            await articleService.updateArticleDetails(selectedArticle.id, {
                tags: keywords,
                file_url: finalPdfUrl, // Replaces Google Doc URL with permanent PDF storage
                status: 'published'
            });

            alert("Article is now LIVE! The Google Doc link has been replaced with the permanent PDF archive.");

            // Find next article before removing current one
            const currentIndex = articles.findIndex(a => a.id === selectedArticle.id);
            const nextArticle = articles[currentIndex + 1] || articles[currentIndex - 1];

            setArticles(articles.filter(a => a.id !== selectedArticle.id));

            if (nextArticle) handleSelectArticle(nextArticle);
            else setSelectedArticle(null);

            setKeywords([]);
            setPdfFile(null);
            setUploadedFileName('');
            setProgress(0);

        } catch (error: any) {
            alert("Error publishing: " + error.message);
        } finally {
            setIsPublishing(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading articles for analysis...</div>;

    return (
        <div className="card-premium" style={{ marginBottom: '3rem' }}>
            <h2>Step 4: Final Archive & Publication (PDF)</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Analyze approved articles. Download the final Google Doc as a PDF, scan it for keywords here, and publish it to the live archive.
            </p>

            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px', borderRight: '1px solid #eee', paddingRight: '2rem' }}>
                    <h3>Ready for Archiving</h3>
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

                <div style={{ flex: 2, minWidth: '300px' }}>
                    {selectedArticle ? (
                        <div>
                            <h3 style={{ marginTop: 0 }}>Processing: {selectedArticle.title}</h3>

                            {selectedArticle.file_url && (
                                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
                                    <p style={{ margin: 0, fontWeight: 500, color: '#1565c0' }}>
                                        Current Google Doc: {' '}
                                        <a href={selectedArticle.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                                            Open Document for Export ↗
                                        </a>
                                    </p>
                                    <small style={{ display: 'block', marginTop: '0.5rem', color: '#555' }}>
                                        Instructions: 1. Open Google Doc. 2. File &gt; Download &gt; PDF Document. 3. Upload the PDF below to replace the link with the permanent file.
                                    </small>
                                </div>
                            )}

                            <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Step 1: Upload Final PDF for Scanning</label>

                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="file"
                                        id="pdf-upload"
                                        accept=".pdf"
                                        onChange={handleFileUpload}
                                        disabled={processing || isPublishing}
                                        style={{ display: 'none' }}
                                    />
                                    <label
                                        htmlFor="pdf-upload"
                                        style={{
                                            display: 'block',
                                            padding: '2rem',
                                            border: '2px dashed #bbb',
                                            borderRadius: '8px',
                                            textAlign: 'center',
                                            background: uploadedFileName ? '#e8f5e9' : 'white',
                                            cursor: (processing || isPublishing) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            color: uploadedFileName ? '#2e7d32' : '#666'
                                        }}
                                        onMouseEnter={(e) => !(processing || isPublishing) && (e.currentTarget.style.borderColor = 'var(--primary)')}
                                        onMouseLeave={(e) => !(processing || isPublishing) && (e.currentTarget.style.borderColor = '#bbb')}
                                    >
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                            {processing ? '⏳' : (uploadedFileName ? '✅' : '📄')}
                                        </div>
                                        {processing ? (
                                            <span style={{ fontWeight: 'bold' }}>Scanning Document Content...</span>
                                        ) : (
                                            uploadedFileName ? (
                                                <>
                                                    <span style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem' }}>Scan Complete!</span>
                                                    <span style={{ fontSize: '0.9rem' }}>File ready: {uploadedFileName}</span>
                                                    <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>(Click to upload different version)</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span style={{ display: 'block', fontWeight: 'bold' }}>Click to Upload PDF</span>
                                                    <span style={{ fontSize: '0.8rem' }}>(Downloaded from Google Docs)</span>
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
                                        <p style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '4px' }}>{progress}% Scanned</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Step 2: Review Keywords</label>
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
                                disabled={isPublishing || !pdfFile}
                                className={`cta-button ${isPublishing ? 'loading' : ''}`}
                                style={{
                                    width: '100%',
                                    fontSize: '1.2rem',
                                    padding: '1rem',
                                    background: isPublishing ? '#999' : 'linear-gradient(45deg, #43a047, #2e7d32)',
                                    cursor: (isPublishing || !pdfFile) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isPublishing ? 'Uploading PDF & Publishing...' : '🚀 Replace Link & Publish Live'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999', border: '2px dashed #ddd', borderRadius: '8px' }}>
                            <p>Select an article to archive (from left)</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
