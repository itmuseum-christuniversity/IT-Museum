import { useEffect, useState } from 'react';
import { contentService } from '../services/contentService';

interface SectionData {
    id: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    pdfUrl?: string;
}

export default function DynamicHomeSections() {
    const [sections, setSections] = useState<SectionData[]>([]);

    useEffect(() => {
        const loadSections = async () => {
            try {
                const data = await contentService.getSections();
                setSections(data as SectionData[]);
            } catch (error) {
                console.error("Error loading sections:", error);
            }
        };
        loadSections();
    }, []);

    return (
        <>
            {sections.map(section => (
                <section className="section" id={`section-${section.id}`} key={section.id}>
                    <div className="content-wrapper">
                        {section.title && <h2>{section.title}</h2>}
                        {section.imageUrl && (
                            <img
                                src={section.imageUrl}
                                alt={section.title || 'Section Image'}
                                style={{ maxWidth: '100%', height: 'auto', marginBottom: '1rem', borderRadius: '8px' }}
                            />
                        )}
                        {section.content && <div dangerouslySetInnerHTML={{ __html: section.content }} />}
                        {section.pdfUrl && (
                            <div style={{ marginTop: '1rem' }}>
                                <a href={section.pdfUrl} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: '#8E24AA', color: 'white', textDecoration: 'none', borderRadius: '5px', fontWeight: 500 }}>
                                    <span style={{ marginRight: '8px' }}>📄</span> View PDF Document
                                </a>
                            </div>
                        )}
                    </div>
                </section>
            ))}
        </>
    );
}
