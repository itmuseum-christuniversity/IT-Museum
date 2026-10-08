/**
 * Pure helpers for Firebase ID-token handling. No Deno or npm imports, so the
 * Edge adapter (deno_deps.ts) and the vitest suite share exactly this logic.
 */
import type { StaffIdentity } from './types.ts';

/** Only Firebase's signing algorithm is accepted (blocks alg confusion / "none"). */
export const FIREBASE_TOKEN_ALGORITHMS = ['RS256'];
/** Claims that must be present for a token to be considered at all. */
export const FIREBASE_REQUIRED_CLAIMS = ['exp', 'iat', 'sub'];

/**
 * jose error codes that mean "we could not obtain or trust Google's signing
 * keys" — an outage on our side, not a bad token. ERR_JOSE_GENERIC is only
 * thrown by jose's JWKS fetch (non-200 response or unparsable body).
 */
const KEY_SET_UNAVAILABLE = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);

/**
 * Decide whether a token-verification failure is the caller's problem
 * ('invalid' -> 401) or an infrastructure problem ('unavailable' -> 503).
 * Anything that is not a jose error (e.g. a fetch TypeError) is infrastructure.
 */
export function classifyTokenError(err: unknown): 'invalid' | 'unavailable' {
    const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
    if (typeof code !== 'string' || !code.startsWith('ERR_J')) return 'unavailable';
    return KEY_SET_UNAVAILABLE.has(code) ? 'unavailable' : 'invalid';
}

/**
 * Map verified token claims to a StaffIdentity. Returns null when the subject
 * is unusable. `emailVerified` is true only when Firebase asserts it with a
 * literal boolean true; anything else (missing, "true", 1) is unverified.
 */
export function identityFromClaims(payload: Record<string, unknown>): StaffIdentity | null {
    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0 || sub.length > 128) return null;
    const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null;
    return { uid: sub, email, emailVerified: email !== null && payload.email_verified === true };
}
