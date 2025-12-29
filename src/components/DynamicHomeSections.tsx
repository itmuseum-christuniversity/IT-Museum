import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from '../firebase-config';

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
        const q = query(collection(db, "sections"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const secs: SectionData[] = [];
            snapshot.forEach((doc) => {
                secs.push({ id: doc.id, ...doc.data() } as SectionData);
            });
            setSections(secs);
        });

        return () => unsubscribe();
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
