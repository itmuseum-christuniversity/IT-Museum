

import { supabase } from '../lib/supabase';

// Type definitions matching our DB schema
export interface Article {
    id?: string;
    title: string;
    author_name: string;
    institution_email: string;
    description: string;
    keywords: string; // Comma-separated keywords for NLP processing
    num_authors: number; // Number of authors (1-10)
    author_designations: string; // Designations for all authors
    submitter_email?: string; // Email of the person submitting the article
    similarity_report_url: string; // Link to similarity/plagiarism report
    originality_confirmed: boolean; // Confirmation that article is original
    file_url?: string;
    status: 'reviewer_first' | 'reviewer_technical' | 'reviewer_literature' | 'admin' | 'ready_for_publishing' | 'published' | 'rejected' | 'submitted'; // submitted kept for legacy/fallback
    created_at?: string;
    tags?: string[];
}

export const articleService = {
    // Upload a file to Supabase Storage
    async uploadFile(file: File, bucket: string = 'articles') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return publicUrl;
    },

    // Submit a new article
    async submitArticle(data: Article) {
        const { data: result, error: dbError } = await supabase
            .from('articles')
            .insert([
                {
                    ...data,
                    status: 'reviewer_first'
                }
            ])
            .select();

        if (dbError) throw dbError;
        return result ? result[0] : null;
    },

    // Fetch accepted articles for the Collection page
    async getAcceptedArticles() {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .in('status', ['accepted', 'published'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Article[];
    },

    // Fetch submitted articles for Admin review
    async getPendingArticles(status: Article['status'] = 'submitted') {
        let query = supabase
            .from('articles')
            .select('*');

        if (status === 'reviewer_first') {
            // Include both current and legacy 'submitted' status
            query = query.or(`status.eq.reviewer_first,status.eq.submitted`);
        } else {
            query = query.eq('status', status);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data as Article[];
    },

    // Admin: Update article status
    async updateStatus(id: string, status: Article['status']) {
        const { data: result, error: dbError } = await supabase
            .from('articles')
            .update({ status })
            .eq('id', id)
            .select();

        if (dbError) throw dbError;
        return result ? result[0] : null;
    },


    // Admin: Update article details
    async updateArticleDetails(id: string, updates: Partial<Article>) {
        const { data: result, error: dbError } = await supabase
            .from('articles')
            .update(updates)
            .eq('id', id)
            .select();

        if (dbError) throw dbError;
        return result ? result[0] : null;
    },

    // Fetch single article by ID
    async getArticleById(id: string) {
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Article;
    }
};


