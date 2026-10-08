import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './config';

let client: SupabaseClient | null = null;

/**
 * Anonymous, read-only client for public content (published_articles view and
 * sections). All privileged work goes through the Edge Functions.
 */
export function publicDb(): SupabaseClient {
    if (!isSupabaseConfigured) throw new Error('The archive is not configured (missing Supabase settings).');
    client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false } });
    return client;
}
