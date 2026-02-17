

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
    submitted_email?: string; // Email of the person submitting the article
    similarity_report_url: string; // Link to similarity/plagiarism report
    ai_report_url: string; // Link to AI detection report
    originality_confirmed: boolean; // Confirmation that article is original
    file_url?: string;
    status: 'SUBMITTED' | 'ADMIN_APPROVED' | 'ADMIN_REJECTED' | 'IT_APPROVED' | 'IT_REJECTED' | 'TECH_APPROVED' | 'TECH_REJECTED' | 'LIT_APPROVED' | 'LIT_REJECTED' | 'PUBLISHED';
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
                    status: 'SUBMITTED'
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
            .in('status', ['PUBLISHED'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Article[];
    },

    // Fetch submitted articles for Admin review
    async getPendingArticles(status: Article['status'] = 'SUBMITTED') {
        let query = supabase
            .from('articles')
            .select('*');

        // Simple query by status
        query = query.eq('status', status);

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


