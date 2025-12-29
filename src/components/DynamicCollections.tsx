import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from '../firebase-config';

interface CollectionData {
    id: string;
    title?: string;
    subtitle?: string;
    summary?: string;
    content?: string;
    imageUrl?: string;
    pdfUrl?: string;
    date?: string;
}

export default function DynamicCollections() {
    const [collections, setCollections] = useState<CollectionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "collections"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const cols: CollectionData[] = [];
            snapshot.forEach((doc) => {
                cols.push({ id: doc.id, ...doc.data() } as CollectionData);
            });
            setCollections(cols);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (!loading && collections.length === 0) {
        return <p style={{ textAlign: 'center', gridColumn: '1/-1', color: '#666', padding: '2rem' }}>No collections added yet.</p>;
    }

    return (
        <>
            {collections.map(col => (
                <div className="researcher-card" key={col.id} onClick={() => { /* expand logic or link */ }}>
                    {col.imageUrl && <img src={col.imageUrl} alt={col.title || 'Collection'} />}
                    <div className="card-content">
                        <h3>{col.title}</h3>
                        {col.subtitle && <p className="subtitle">{col.subtitle}</p>}
                        {col.pdfUrl && (
                            <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                                <a href={col.pdfUrl} target="_blank" style={{ color: '#8E24AA', fontSize: '0.9em', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                                    <span style={{ marginRight: '5px' }}>📄</span> View PDF
                                </a>
                            </div>
                        )}
                        <p>{col.summary || (col.content ? col.content.substring(0, 150) + '...' : '')}</p>
                    </div>
                </div>
            ))}
        </>
    );
}
