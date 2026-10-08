/** Public runtime configuration (VITE_* values are bundled and public). */
const env = import.meta.env;

const supabaseUrl = (env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const config = {
    supabaseUrl,
    supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
    functionsUrl: ((env.VITE_FUNCTIONS_URL as string | undefined) || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '')).replace(/\/$/, ''),
    siteUrl: ((env.VITE_SITE_URL as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
    firebase: {
        apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
        projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
        appId: env.VITE_FIREBASE_APP_ID as string | undefined,
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
    },
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const isFirebaseConfigured = Boolean(config.firebase.apiKey && config.firebase.projectId && config.firebase.appId);
