import { publicDb } from '../lib/supabase';
import { safeUrl, sanitizeHtml } from '../lib/sanitize';

export interface HomeSection {
    id: string;
    title: string | null;
    html: string;
    imageUrl: string | null;
    pdfUrl: string | null;
}

interface SectionRow {
    id: string;
    title?: string | null;
    content?: string | null;
    order?: number | null;
    image_url?: string | null;
    pdf_url?: string | null;
}

/** The DB stores snake_case columns; the old component read camelCase and never showed images or PDFs. */
export function mapSection(r: SectionRow): HomeSection {
    return {
        id: r.id,
        title: r.title?.trim() || null,
        html: r.content ? sanitizeHtml(r.content) : '',
        imageUrl: safeUrl(r.image_url),
        pdfUrl: safeUrl(r.pdf_url),
    };
}

export async function fetchSections(): Promise<HomeSection[]> {
    const { data, error } = await publicDb().from('sections').select('id, title, content, order, image_url, pdf_url').order('order', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SectionRow[]).map(mapSection);
}
