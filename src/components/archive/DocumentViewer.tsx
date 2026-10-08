import { useState } from 'react';
import { Download, ExternalLink, FileText } from 'lucide-react';

/**
 * Inline PDF preview with an always-available download/open fallback.
 * Some browsers (notably on phones) do not render PDFs inline, so the preview
 * is opt-in on small screens and the links work everywhere.
 */
export function DocumentViewer({ pdfUrl, externalUrl, title }: { pdfUrl?: string | null; externalUrl?: string | null; title: string }) {
    const [show, setShow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 48rem)').matches);
    if (!pdfUrl && !externalUrl) {
        return (
            <div className="card card--sunken">
                <p style={{ margin: 0 }}>The full document for this record is not yet available online. Contact the museum for access.</p>
            </div>
        );
    }
    if (!pdfUrl && externalUrl) {
        return (
            <div className="card card--sunken stack">
                <p style={{ margin: 0 }}>This record was archived before PDFs were stored with the museum. The full text is available as the author’s shared document.</p>
                <p style={{ margin: 0 }}>
                    <a className="btn btn--primary" href={externalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={16} aria-hidden="true" /> Open the document<span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                </p>
            </div>
        );
    }
    return (
        <div className="doc-viewer">
            <div className="doc-viewer__bar">
                <span className="cluster" style={{ ['--cluster-gap' as string]: '0.5rem' }}>
                    <FileText size={18} aria-hidden="true" />
                    <span>PDF document</span>
                </span>
                <span className="cluster">
                    <button type="button" className="btn btn--sm" aria-expanded={show} onClick={() => setShow((s) => !s)}>
                        {show ? 'Hide preview' : 'Show preview'}
                    </button>
                    <a className="btn btn--sm" href={pdfUrl!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={16} aria-hidden="true" /> Open<span className="visually-hidden"> PDF in a new tab</span>
                    </a>
                    <a className="btn btn--primary btn--sm" href={pdfUrl!} download>
                        <Download size={16} aria-hidden="true" /> Download PDF
                    </a>
                </span>
            </div>
            {show && (
                <object className="doc-viewer__frame" data={pdfUrl!} type="application/pdf" aria-label={`PDF preview: ${title}`}>
                    <div className="doc-viewer__fallback">
                        <p>Your browser cannot show the PDF here.</p>
                        <a href={pdfUrl!} target="_blank" rel="noopener noreferrer">
                            Open the PDF in a new tab
                        </a>
                    </div>
                </object>
            )}
        </div>
    );
}
