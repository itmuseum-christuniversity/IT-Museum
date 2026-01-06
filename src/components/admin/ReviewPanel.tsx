import { useState, useEffect } from 'react';
import { articleService, Article } from '../../services/articleService';

interface ReviewPanelProps {
    title: string;
    currentStageStatus: Article['status'];
    nextStageStatus: Article['status'];
    reviewerName: string;
    onActionComplete?: () => void;
}

export default function ReviewPanel({ title, currentStageStatus, nextStageStatus, reviewerName: _reviewerName, onActionComplete }: ReviewPanelProps) {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit & Notification State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', abstract: '' });
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        const loadArticles = async () => {
            try {
                // Always fetch pending articles based on the current stage status
                // The service now handles filtering by the status passed
                let data = await articleService.getPendingArticles(currentStageStatus);
                setArticles(data);
            } catch (error) {
                console.error("Error loading articles:", error);
            } finally {
                setLoading(false);
            }
        };
        loadArticles();
    }, [currentStageStatus]);

    // Derived notifications from article history
    useEffect(() => {
        // Mock notifications or implement history later if needed
        setNotifications([]);
    }, [articles]);

    const handleEditStart = (article: Article) => {
        setEditingId(article.id || null);
        setEditForm({ title: article.title, abstract: article.abstract });
    };

    const handleEditSave = async (id: string) => {
        try {
            if (id) {
                await articleService.updateArticleDetails(id, {
                    title: editForm.title,
                    abstract: editForm.abstract
                });
                // Update local state
                setArticles(articles.map(a => a.id === id ? { ...a, ...editForm } : a));
                setEditingId(null);
                alert("Changes saved successfully!");
            }
        } catch (error: any) {
            alert("Error saving: " + error.message);
        }
    };

    const handleApprove = async (articleId: string) => {
        if (!window.confirm("Approve this article for the next stage?")) return;
        try {
            if (articleId) {
                await articleService.updateStatus(articleId, nextStageStatus);
                // Refresh list locally
                setArticles(articles.filter(a => a.id !== articleId));
                if (onActionComplete) onActionComplete();
            }
        } catch (error: any) {
            alert("Error approving: " + error.message);
        }
    };

    const handleReject = async (articleId: string) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;

        try {
            if (articleId) {
                await articleService.updateStatus(articleId, 'rejected');
                setArticles(articles.filter(a => a.id !== articleId));
            }
        } catch (error: any) {
            alert("Error rejecting: " + error.message);
        }
    };

    if (loading) return <div>Loading submissions...</div>;

    return (
        <div className="review-panel fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid var(--primary)', paddingBottom: '0.5rem' }}>
                <h2 style={{ margin: 0 }}>{title}</h2>

                {/* Notification Badge */}
                <div style={{ position: 'relative', cursor: 'pointer' }} title="Recent Activity">
                    <span style={{ fontSize: '1.5rem' }}>🔔</span>
                    {notifications.length > 0 && (
                        <span style={{
                            position: 'absolute', top: -5, right: -5,
                            background: '#d32f2f', color: 'white',
                            borderRadius: '50%', width: '20px', height: '20px',
                            fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '2px solid white'
                        }}>
                            {notifications.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Notification Area */}
            {notifications.length > 0 && (
                <div style={{ background: '#fff8e1', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #ffe082' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#f57f17', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📢</span> Recent Updates
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#5d4037' }}>
                        {notifications.map((n, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>
                                <strong>{n.action.toUpperCase()}</strong> by {n.reviewed_by} <span style={{ opacity: 0.7 }}>({new Date(n.timestamp).toLocaleTimeString()})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {articles.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px', color: '#757575' }}>
                    <p>No articles pending for review in this stage.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '2rem' }}>
                    {articles.map(article => (
                        <div key={article.id} className="card-premium" style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div style={{ width: '100%' }}>
                                    {editingId === article.id ? (
                                        <input
                                            type="text"
                                            value={editForm.title}
                                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                            placeholder="Article Title"
                                            style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold', border: '2px solid var(--primary)', borderRadius: '4px' }}
                                        />
                                    ) : (
                                        <h3 style={{ margin: 0, color: 'var(--primary)' }}>{article.title}</h3>
                                    )}

                                    <p style={{ margin: '0.5rem 0', color: '#666' }}>By {article.author_name} ({article.institution_email})</p>
                                </div>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#e3f2fd',
                                    color: '#1565c0',
                                    borderRadius: '16px',
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    marginLeft: '1rem',
                                    height: 'fit-content'
                                }}>
                                    {article.status.replace('_', ' ').toUpperCase()}
                                </span>
                            </div>

                            <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '4px', marginBottom: '1.5rem' }}>
                                <strong>Abstract:</strong>
                                {editingId === article.id ? (
                                    <textarea
                                        value={editForm.abstract}
                                        onChange={(e) => setEditForm({ ...editForm, abstract: e.target.value })}
                                        rows={6}
                                        style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem', border: '2px solid var(--primary)', borderRadius: '4px', fontFamily: 'inherit' }}
                                    />
                                ) : (
                                    <p style={{ marginTop: '0.5rem', lineHeight: '1.6' }}>{article.abstract}</p>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <strong>Submission: </strong>
                                <a href={article.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--secondary)', fontWeight: 500 }}>
                                    Open Google Doc 🔗
                                </a>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                {editingId === article.id ? (
                                    <>
                                        <button
                                            onClick={() => article.id && handleEditSave(article.id)}
                                            className="cta-button"
                                            style={{ flex: 1, background: '#1976d2', boxShadow: 'none' }}
                                        >
                                            💾 Save Changes
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="cta-button"
                                            style={{ flex: 1, background: '#757575', boxShadow: 'none' }}
                                        >
                                            ❌ Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => article.id && handleEditStart(article)}
                                            className="cta-button secondary"
                                            style={{ flex: 0.5, border: '1px solid #90a4ae', color: '#546e7a' }}
                                            title="Edit Article Details"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => article.id && handleApprove(article.id)}
                                            className="cta-button"
                                            style={{ flex: 1, background: '#2e7d32' }}
                                        >
                                            ✅ {nextStageStatus === 'ready_for_publishing' ? 'Move to Analysis' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => article.id && handleReject(article.id)}
                                            className="cta-button"
                                            style={{ flex: 1, background: '#c62828' }}
                                        >
                                            ⛔ Reject
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
