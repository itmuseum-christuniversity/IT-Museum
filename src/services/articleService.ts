
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
    similarity_report_url: string; // Link to similarity/plagiarism report
    originality_confirmed: boolean; // Confirmation that article is original
    file_url?: string;
    status: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'approved_first' | 'approved_technical' | 'approved_literature' | 'ready_for_publishing' | 'published';
    created_at?: string;
    tags?: string[];
}

export const articleService = {
    // Submit a new article
    async submitArticle(data: Article, googleDocUrl: string) {
        // 1. Insert Record directly with the URL
        const { data: article, error: dbError } = await supabase
            .from('articles')
            .insert([
                {
                    ...data,
                    file_url: googleDocUrl,
                    status: 'submitted'
                }
            ])
            .select()
            .single();

        if (dbError) throw dbError;
        return article;
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
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .eq('status', status)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Article[];
    },

    // Admin: Update article status
    async updateStatus(id: string, status: Article['status']) {
        const { data, error } = await supabase
            .from('articles')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Admin: Update article details
    async updateArticleDetails(id: string, updates: Partial<Article>) {
        const { data, error } = await supabase
            .from('articles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
