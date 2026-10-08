import { describe, expect, it } from 'vitest';
import {
    checkManuscriptUrl,
    checkPdfFile,
    hasPdfSignature,
    isEmail,
    makeReferenceCode,
    MAX_AUTHOR_NAME_CHARS,
    MAX_DESCRIPTION_CHARS,
    MAX_DESIGNATION_CHARS,
    MAX_EMAIL_CHARS,
    MAX_REPORT_BYTES,
    normalizeTags,
    parseKeywords,
    validateSubmission,
} from '../supabase/functions/_shared/validation.ts';
import { validSubmission } from './helpers/memory.ts';

describe('manuscript link validation (parsed host, not substring)', () => {
    it.each([
        'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit?usp=sharing',
        'https://docs.google.com/document/u/0/d/1AbCdEfGhIjKlMnOp/edit',
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',
        'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp',
    ])('accepts %s', (url) => expect(checkManuscriptUrl(url).ok).toBe(true));

    it.each([
        ['http://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit', 'https'],
        ['https://docs.google.com.evil.example/document/d/1AbCdEfGhIjKlMnOp', 'host spoof'],
        ['https://evil.example/?u=docs.google.com/document/d/1AbCdEfGhIjKlMnOp', 'query spoof'],
        ['https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp', 'not a document'],
        ['https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp', 'folder'],
        ['https://user:pw@docs.google.com/document/d/1AbCdEfGhIjKlMnOp', 'credentials'],
        ['docs.google.com/document/d/1AbCdEfGhIjKlMnOp', 'no scheme'],
        ['', 'empty'],
    ])('rejects %s (%s)', (url) => expect(checkManuscriptUrl(url).ok).toBe(false));
});

describe('submission fields', () => {
    it('accepts a complete submission', () => {
        expect(validateSubmission(validSubmission())).toEqual({});
    });

    it('reports every problem with a field key', () => {
        const errors = validateSubmission({
            ...validSubmission(),
            title: 'x',
            description: 'too short',
            keywords: ',,',
            submitterEmail: 'nope',
            authors: [{ name: '', email: 'bad', designation: '' }],
            originalityConfirmed: false,
        });
        expect(Object.keys(errors).sort()).toEqual(
            ['authors.0.designation', 'authors.0.email', 'authors.0.name', 'description', 'keywords', 'originalityConfirmed', 'submitterEmail', 'title'].sort(),
        );
    });

    it('limits authors to 1–10', () => {
        const a = validSubmission().authors[0];
        expect(validateSubmission({ ...validSubmission(), authors: [] }).authors).toBeTruthy();
        expect(validateSubmission({ ...validSubmission(), authors: Array(11).fill(a) }).authors).toBeTruthy();
        expect(validateSubmission({ ...validSubmission(), authors: Array(10).fill(a) }).authors).toBeUndefined();
    });

    it('enforces the 250-word description limit', () => {
        expect(validateSubmission({ ...validSubmission(), description: 'word '.repeat(251) }).description).toMatch(/250/);
    });

    it('parses comma-separated keywords and tags', () => {
        expect(parseKeywords(' AI,  machine   learning ,, C++ ')).toEqual(['AI', 'machine learning', 'C++']);
        expect(normalizeTags(['AI', 'ai', ' Data  Science ', ''])).toEqual(['AI', 'Data Science']);
    });
});

describe('file checks', () => {
    it('requires a non-empty PDF within the size limit', () => {
        expect(checkPdfFile(null)).toBeTruthy();
        expect(checkPdfFile({ name: 'a.docx', size: 10, type: 'application/msword' })).toMatch(/PDF/);
        expect(checkPdfFile({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toMatch(/empty/);
        expect(checkPdfFile({ name: 'a.pdf', size: MAX_REPORT_BYTES + 1, type: 'application/pdf' })).toMatch(/MB/);
        expect(checkPdfFile({ name: 'a.PDF', size: 100, type: 'application/pdf' })).toBeNull();
    });

    it('sniffs the PDF signature server-side', () => {
        expect(hasPdfSignature(new TextEncoder().encode('%PDF-1.4'))).toBe(true);
        expect(hasPdfSignature(new TextEncoder().encode('<html>'))).toBe(false);
    });

    it('makes readable reference codes', () => {
        expect(makeReferenceCode(2026, new Uint8Array([0, 1, 2, 3, 4, 5]))).toMatch(/^ITM-2026-[A-Z2-9]{6}$/);
    });
});

describe('email validation', () => {
    it.each(['asha@christuniversity.in', 'first.last+tag@dept.univ.ac.in', "o'brien@example.org", ' padded@example.com '])('accepts %s', (e) =>
        expect(isEmail(e)).toBe(true),
    );

    it.each([
        'a@b.co,c.de',
        'a@b.co;c@d.co',
        'a@b.co, c@d.co',
        'Name <a@b.co>',
        '<a@b.co>',
        'a@b.co?subject=hi',
        'a@b.co#frag',
        'a@b.co/path',
        'a b@c.co',
        'a@b',
        'a@b.c',
        'a@@b.co',
        'a@b..co',
        'a@.b.co',
        '@b.co',
        '"a"@b.co',
        '',
    ])('rejects %j', (e) => expect(isEmail(e)).toBe(false));

    it('rejects non-strings without throwing', () => {
        expect(isEmail(undefined as unknown as string)).toBe(false);
        expect(isEmail(42 as unknown as string)).toBe(false);
    });

    it('applies the RFC 5321 length caps (64 local part, 254 total)', () => {
        expect(isEmail(`${'a'.repeat(64)}@example.com`)).toBe(true);
        expect(isEmail(`${'a'.repeat(65)}@example.com`)).toBe(false);
        const domain = `${'d'.repeat(60)}.${'e'.repeat(60)}.${'f'.repeat(60)}.com`;
        const ok = `a@${domain}`;
        expect(ok.length).toBeLessThanOrEqual(MAX_EMAIL_CHARS);
        expect(isEmail(ok)).toBe(true);
        expect(isEmail(`${'a'.repeat(60)}@${domain}x${'g'.repeat(40)}.org`)).toBe(false);
    });

    it('flags a multi-address submitter email', () => {
        expect(validateSubmission({ ...validSubmission(), submitterEmail: 'a@b.co,c@d.co' }).submitterEmail).toBeTruthy();
    });
});

describe('text length caps', () => {
    it('caps description characters even when the word count is fine', () => {
        const longWords = Array(30).fill('x'.repeat(MAX_DESCRIPTION_CHARS / 10)).join(' ');
        expect(longWords.length).toBeGreaterThan(MAX_DESCRIPTION_CHARS);
        expect(validateSubmission({ ...validSubmission(), description: longWords }).description).toMatch(/characters/);
    });

    it('caps author name and designation', () => {
        const a = validSubmission().authors[0];
        const errors = validateSubmission({
            ...validSubmission(),
            authors: [{ ...a, name: 'n'.repeat(MAX_AUTHOR_NAME_CHARS + 1), designation: 'd'.repeat(MAX_DESIGNATION_CHARS + 1) }],
        });
        expect(errors['authors.0.name']).toMatch(/characters/);
        expect(errors['authors.0.designation']).toMatch(/characters/);
        expect(validateSubmission({ ...validSubmission(), authors: [{ ...a, name: 'n'.repeat(MAX_AUTHOR_NAME_CHARS) }] })['authors.0.name']).toBeUndefined();
    });
});
