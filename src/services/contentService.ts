import { supabase } from '../lib/supabase';

export interface Section {
    id?: string;
    title?: string;
    content?: string;
    order?: number;
    image_url?: string;
    pdf_url?: string;
    created_at?: string;
}

export const contentService = {
    // Fetch all sections ordered by 'order'
    async getSections() {
        const { data, error } = await supabase
            .from('sections')
            .select('*')
            .order('order', { ascending: true });

        if (error) throw error;
        return data as Section[];
    },

    // Add a new section
    async addSection(section: Section) {
        const { data, error } = await supabase
            .from('sections')
            .insert([section])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Delete a section
    async deleteSection(id: string) {
        const { error } = await supabase
            .from('sections')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
