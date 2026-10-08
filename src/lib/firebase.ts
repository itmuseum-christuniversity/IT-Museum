/**
 * Firebase is used for staff sign-in (Auth) and for the legacy Firestore
 * `collections` content. Both are loaded on demand so public pages that do not
 * need them stay light.
 */
import type { FirebaseApp } from 'firebase/app';
import { config, isFirebaseConfigured } from './config';

let appPromise: Promise<FirebaseApp> | null = null;

export function firebaseApp(): Promise<FirebaseApp> {
    if (!isFirebaseConfigured) return Promise.reject(new Error('Firebase is not configured.'));
    appPromise ??= import('firebase/app').then(({ initializeApp, getApps }) => getApps()[0] ?? initializeApp(config.firebase));
    return appPromise;
}

export async function firebaseAuth() {
    const [app, mod] = await Promise.all([firebaseApp(), import('firebase/auth')]);
    return { auth: mod.getAuth(app), mod };
}

export async function firestore() {
    const [app, mod] = await Promise.all([firebaseApp(), import('firebase/firestore')]);
    return { db: mod.getFirestore(app), mod };
}
