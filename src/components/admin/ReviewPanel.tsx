import { useState, useEffect } from 'react';
import { articleService, Article } from '../../services/articleService';
import emailjs from '@emailjs/browser';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ReviewPanelProps {
    title: string;
    currentStageStatus: Article['status'];
    nextStageStatus: Article['status'];
    rejectionStatus: Article['status'];
    reviewerName: string;
    onActionComplete?: () => void;
}

export default function ReviewPanel({ title, currentStageStatus, nextStageStatus, rejectionStatus, reviewerName: _reviewerName, onActionComplete }: ReviewPanelProps) {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit & Notification State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ title: '', description: '' });

    const [notifications, setNotifications] = useState<any[]>([]);

    // UI State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

    // Toast Timer
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
    };

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
        setEditForm({ title: article.title, description: article.description });
    };

    const handleEditSave = async (id: string) => {
        try {
            if (id) {
                await articleService.updateArticleDetails(id, {
                    title: editForm.title,
                    description: editForm.description
                });
                // Update local state
                setArticles(articles.map(a => a.id === id ? { ...a, ...editForm } : a));
                setEditingId(null);

                showToast("Changes saved successfully!", "success");
            }
        } catch (error: any) {
            showToast("Error saving: " + error.message, "error");
        }
    };

    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (articles.length > 0 && !selectedId) {
            setSelectedId(articles[0].id || null);
        }
    }, [articles, selectedId]);

    const activeArticle = articles.find(a => a.id === selectedId) || (articles.length > 0 ? articles[0] : null);

    const handleApprove = async (articleId: string) => {
        if (!window.confirm("Approve this article for the next stage?")) return;
        try {
            if (articleId) {
                await articleService.updateStatus(articleId, nextStageStatus);

                // Find next article before removing current one
                const currentIndex = articles.findIndex(a => a.id === articleId);
                const nextArticle = articles[currentIndex + 1] || articles[currentIndex - 1];

                // Refresh list locally
                setArticles(articles.filter(a => a.id !== articleId));

                if (nextArticle) setSelectedId(nextArticle.id || null);
                else setSelectedId(null);

                showToast("Article approved successfully!", "success");
                if (onActionComplete) onActionComplete();
            }
        } catch (error: any) {
            showToast("Error approving: " + error.message, "error");
        }
    };

    const openRejectModal = (articleId: string) => {
        setSelectedArticleId(articleId);
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const confirmReject = async () => {
        if (!rejectReason.trim()) {
            showToast("Please enter a rejection reason.", "error");
            return;
        }

        const articleId = selectedArticleId;
        if (!articleId) return;

        try {
            // Find the article to get the submitter's email
            const article = articles.find(a => a.id === articleId);

            // Find next article before removing current one
            const currentIndex = articles.findIndex(a => a.id === articleId);
            const nextArticle = articles[currentIndex + 1] || articles[currentIndex - 1];

            // Update status in database
            await articleService.updateStatus(articleId, rejectionStatus);

            let emailSent = false;
            // Send rejection email if submitter email exists
            if (article?.submitted_email) {
                const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
                const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
                const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

                if (serviceId && templateId && publicKey) {
                    try {
                        const templateParams = {
                            to_email: article.submitted_email,
                            article_title: article.title,
                            rejection_reason: rejectReason,
                            recipient_name: article.author_name.split(',')[0]
                        };

                        await emailjs.send(serviceId, templateId, templateParams, publicKey);
                        emailSent = true;
                    } catch (emailError: any) {
                        console.error("EmailJS Error:", emailError);
                        showToast("Rejection saved but email failed: " + (emailError.text || emailError.message), "error");
                    }
                } else {
                    showToast("Rejection saved but EmailJS details missing.", "error");
                }
            }

            setArticles(articles.filter(a => a.id !== articleId));

            if (nextArticle) setSelectedId(nextArticle.id || null);
            else setSelectedId(null);

            setRejectModalOpen(false);

            if (emailSent) {
                showToast(`Article rejected and email sent to ${article?.submitted_email}`, "success");
            } else if (!article?.submitted_email) {
                showToast("Article rejected (no submitter email found).", "info");
            }

        } catch (error: any) {
            showToast("Error processing rejection: " + error.message, "error");
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
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    {/* Sidebar List */}
                    <div style={{ flex: 1, minWidth: '250px', borderRight: '1px solid #eee', paddingRight: '1.5rem', maxHeight: '700px', overflowY: 'auto' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#666' }}>Pending Articles ({articles.length})</h4>
                        {articles.map(a => (
                            <div
                                key={a.id}
                                onClick={() => setSelectedId(a.id || null)}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem',
                                    cursor: 'pointer',
                                    border: selectedId === a.id ? '2px solid var(--primary)' : '1px solid #eee',
                                    background: selectedId === a.id ? '#f0f4f8' : 'white',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <strong style={{ display: 'block', fontSize: '0.9rem', color: selectedId === a.id ? 'var(--primary)' : '#333' }}>{a.title}</strong>
                                <small style={{ color: '#666' }}>{a.author_name}</small>
                            </div>
                        ))}
                    </div>

                    {/* Detailed View */}
                    <div style={{ flex: 2.5, minWidth: '350px' }}>
                        {activeArticle ? (
                            <div className="card-premium" style={{ position: 'relative', margin: 0, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{ width: '100%' }}>
                                        {editingId === activeArticle.id ? (
                                            <input
                                                type="text"
                                                value={editForm.title}
                                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                placeholder="Article Title"
                                                style={{ width: '100%', padding: '0.8rem', marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 'bold', border: '2px solid var(--primary)', borderRadius: '4px' }}
                                            />
                                        ) : (
                                            <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.5rem' }}>{activeArticle.title}</h3>
                                        )}
                                        <p style={{ margin: '0.5rem 0', color: '#666' }}>By {activeArticle.author_name} ({activeArticle.institution_email})</p>
                                    </div>
                                    <span style={{
                                        padding: '0.4rem 1rem',
                                        background: '#e3f2fd',
                                        color: '#1565c0',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        marginLeft: '1rem'
                                    }}>
                                        {activeArticle.status.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                </div>

                                <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #edf2f7' }}>
                                    <strong style={{ color: '#4a5568', display: 'block', marginBottom: '0.75rem' }}>Description / Abstract:</strong>
                                    {editingId === activeArticle.id ? (
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                            rows={8}
                                            style={{ width: '100%', padding: '1rem', marginTop: '0.5rem', border: '2px solid var(--primary)', borderRadius: '4px', fontFamily: 'inherit', fontSize: '1rem' }}
                                        />
                                    ) : (
                                        <p style={{ margin: 0, lineHeight: '1.7', color: '#2d3748' }}>{activeArticle.description}</p>
                                    )}
                                </div>

                                <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📄</span>
                                    <div style={{ flex: 1 }}>
                                        <strong style={{ display: 'block', color: '#c53030' }}>Document Submission</strong>
                                        <a href={activeArticle.file_url} target="_blank" rel="noreferrer" style={{ color: '#2b6cb0', fontWeight: 600, textDecoration: 'underline' }}>
                                            Open Google Doc for Review 🔗
                                        </a>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                                    {editingId === activeArticle.id ? (
                                        <>
                                            <button
                                                onClick={() => activeArticle.id && handleEditSave(activeArticle.id)}
                                                className="cta-button"
                                                style={{ flex: 1, background: '#1976d2' }}
                                            >
                                                💾 Save Changes
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="cta-button secondary"
                                                style={{ flex: 1 }}
                                            >
                                                ❌ Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => activeArticle.id && handleEditStart(activeArticle)}
                                                className="cta-button secondary"
                                                style={{ flex: 0.4 }}
                                                title="Edit Article Details"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                onClick={() => activeArticle.id && handleApprove(activeArticle.id)}
                                                className="cta-button"
                                                style={{ flex: 1, background: '#2e7d32' }}
                                            >
                                                ✅ {nextStageStatus === 'LIT_APPROVED' ? 'Move to Final Processing' : 'Approve & Pass'}
                                            </button>
                                            <button
                                                onClick={() => activeArticle.id && openRejectModal(activeArticle.id)}
                                                className="cta-button"
                                                style={{ flex: 1, background: '#c62828' }}
                                            >
                                                ⛔ Reject
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999', border: '2px dashed #ddd', borderRadius: '8px' }}>
                                <p>Select an article from the list to review</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setRejectModalOpen(false)}>
                    <div style={{
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        width: '90%',
                        maxWidth: '500px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        transform: 'translateY(0)',
                        animation: 'slideUp 0.3s ease-out'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#c62828' }}>Reject Article</h3>
                            <button onClick={() => setRejectModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#666" />
                            </button>
                        </div>

                        <p style={{ marginBottom: '1rem', color: '#555' }}>
                            Please provide a reason for rejection. This will be sent to the submitter.
                        </p>

                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            rows={5}
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '1rem',
                                border: '2px solid #e0e0e0',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontFamily: 'inherit',
                                marginBottom: '1.5rem',
                                resize: 'vertical'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => setRejectModalOpen(false)}
                                style={{
                                    padding: '0.8rem 1.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    color: '#666'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReject}
                                style={{
                                    padding: '0.8rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#c62828',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    boxShadow: '0 2px 5px rgba(198, 40, 40, 0.4)'
                                }}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    background: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: '8px',
                    boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    zIndex: 2000,
                    borderLeft: `5px solid ${toast.type === 'success' ? '#4caf50' : toast.type === 'error' ? '#f44336' : '#2196f3'}`,
                    animation: 'slideInRight 0.3s ease-out',
                    maxWidth: '400px'
                }}>
                    {toast.type === 'success' && <CheckCircle size={24} color="#4caf50" />}
                    {toast.type === 'error' && <AlertCircle size={24} color="#f44336" />}
                    {toast.type === 'info' && <Info size={24} color="#2196f3" />}
                    <div>
                        <p style={{ margin: 0, fontWeight: 500, color: '#333' }}>{toast.message}</p>
                    </div>
                </div>
            )}

        </div>
    );
}
