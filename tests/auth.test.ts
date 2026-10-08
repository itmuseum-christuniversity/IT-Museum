import { describe, expect, it } from 'vitest';
import { classifyTokenError, FIREBASE_REQUIRED_CLAIMS, FIREBASE_TOKEN_ALGORITHMS, identityFromClaims } from '../supabase/functions/_shared/auth.ts';

const joseError = (code: string) => Object.assign(new Error(code), { code });

describe('Firebase token verification policy', () => {
    it('pins RS256 and requires exp/sub', () => {
        expect(FIREBASE_TOKEN_ALGORITHMS).toEqual(['RS256']);
        expect(FIREBASE_REQUIRED_CLAIMS).toEqual(expect.arrayContaining(['exp', 'sub']));
    });

    it('treats bad or expired tokens as 401-class', () => {
        for (const code of [
            'ERR_JWT_EXPIRED',
            'ERR_JWT_CLAIM_VALIDATION_FAILED',
            'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
            'ERR_JWS_INVALID',
            'ERR_JWT_INVALID',
            'ERR_JOSE_ALG_NOT_ALLOWED',
            'ERR_JWKS_NO_MATCHING_KEY',
        ]) {
            expect(classifyTokenError(joseError(code)), code).toBe('invalid');
        }
    });

    it('treats key-set fetch failures and non-jose errors as 503-class', () => {
        expect(classifyTokenError(joseError('ERR_JWKS_TIMEOUT'))).toBe('unavailable');
        expect(classifyTokenError(joseError('ERR_JWKS_INVALID'))).toBe('unavailable');
        expect(classifyTokenError(joseError('ERR_JOSE_GENERIC'))).toBe('unavailable');
        expect(classifyTokenError(new TypeError('error sending request'))).toBe('unavailable');
        expect(classifyTokenError(undefined)).toBe('unavailable');
    });

    it('reads email_verified strictly', () => {
        expect(identityFromClaims({ sub: 'u1', email: 'a@b.in', email_verified: true })).toEqual({ uid: 'u1', email: 'a@b.in', emailVerified: true });
        expect(identityFromClaims({ sub: 'u1', email: 'a@b.in', email_verified: false })?.emailVerified).toBe(false);
        expect(identityFromClaims({ sub: 'u1', email: 'a@b.in', email_verified: 'true' })?.emailVerified).toBe(false);
        expect(identityFromClaims({ sub: 'u1', email: 'a@b.in' })?.emailVerified).toBe(false);
        expect(identityFromClaims({ sub: 'u1', email_verified: true })).toEqual({ uid: 'u1', email: null, emailVerified: false });
    });

    it('rejects an unusable subject', () => {
        expect(identityFromClaims({ email: 'a@b.in' })).toBeNull();
        expect(identityFromClaims({ sub: '' })).toBeNull();
        expect(identityFromClaims({ sub: 42 })).toBeNull();
    });
});
