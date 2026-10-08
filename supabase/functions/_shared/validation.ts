/**
 * Submission validation shared by the submission form (for immediate feedback)
 * and the `public-api` Edge Function (authoritative). Pure TypeScript.
 */

export const MAX_AUTHORS = 10;
export const MAX_ABSTRACT_WORDS = 250;
export const MAX_REPORT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FINAL_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
export const PDF_MIME = 'application/pdf';
export const MAX_DESCRIPTION_CHARS = 3000;
export const MAX_AUTHOR_NAME_CHARS = 120;
export const MAX_DESIGNATION_CHARS = 120;
/** Combined "A, B, C" credit line for up to MAX_AUTHORS authors. */
export const MAX_AUTHOR_CREDIT_CHARS = MAX_AUTHORS * (MAX_AUTHOR_NAME_CHARS + 2);
/** RFC 5321: 254 characters in total, 64 in the local part. */
export const MAX_EMAIL_CHARS = 254;
const MAX_EMAIL_LOCAL_CHARS = 64;

export interface AuthorInput {
    name: string;
    email: string;
    designation: string;
}

export interface SubmissionInput {
    title: string;
    description: string;
    keywords: string;
    submitterEmail: string;
    authors: AuthorInput[];
    manuscriptUrl: string;
    originalityConfirmed: boolean;
}

export type FieldErrors = Record<string, string>;

// One address only: no whitespace, list separators (, ;), angle brackets, quotes,
// or URL/query characters (? # /) anywhere in it.
const EMAIL_RE = /^[^\s@,;<>()[\]\\"?#/]+@[^\s@,;<>()[\]\\"?#/]+\.[^\s@,;<>()[\]\\"?#/.]{2,}$/;
const KEYWORD_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s\-+.#&/()]*$/u;

export function isEmail(value: string): boolean {
    if (typeof value !== 'string') return false;
    const email = value.trim();
    if (email.length > MAX_EMAIL_CHARS) return false;
    const at = email.indexOf('@');
    if (at < 1 || at > MAX_EMAIL_LOCAL_CHARS) return false;
    const domain = email.slice(at + 1);
    if (domain.startsWith('.') || domain.includes('..')) return false;
    return EMAIL_RE.test(email);
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function parseKeywords(raw: string): string[] {
    return raw
        .split(',')
        .map((k) => k.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
}

export type ManuscriptUrlCheck =
    | { ok: true; kind: 'google_doc' | 'google_drive'; normalized: string }
    | { ok: false; message: string };

/**
 * Accept only https links on docs.google.com/document/... or drive.google.com.
 * Parses the URL rather than substring-matching, so hosts such as
 * `docs.google.com.evil.example` or `evil.example/?docs.google.com` are rejected.
 * A passing check does NOT prove the reviewers have access — see the UI copy.
 */
export function checkManuscriptUrl(raw: string): ManuscriptUrlCheck {
    const value = raw.trim();
    if (!value) return { ok: false, message: 'Paste the link to your Google Doc or Google Drive file.' };
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, message: 'This does not look like a complete web address. It should start with https://' };
    }
    if (url.protocol !== 'https:') return { ok: false, message: 'Use the https:// link copied from Google Docs or Drive.' };
    if (url.username || url.password) return { ok: false, message: 'Links containing credentials are not accepted.' };
    const host = url.hostname.toLowerCase();
    if (host === 'docs.google.com') {
        if (!/^\/document\/(u\/\d+\/)?d\/[\w-]{10,}/.test(url.pathname)) {
            return { ok: false, message: 'Link to a Google Docs *document* (docs.google.com/document/d/…).' };
        }
        return { ok: true, kind: 'google_doc', normalized: url.toString() };
    }
    if (host === 'drive.google.com') {
        const hasFileId = /^\/file\/d\/[\w-]{10,}/.test(url.pathname) || /^\/open$/.test(url.pathname) && url.searchParams.has('id');
        if (!hasFileId) return { ok: false, message: 'Link to a specific Drive file (drive.google.com/file/d/…), not a folder.' };
        return { ok: true, kind: 'google_drive', normalized: url.toString() };
    }
    return { ok: false, message: 'Only Google Docs (docs.google.com) or Google Drive (drive.google.com) links are accepted.' };
}

export function validateAuthors(authors: AuthorInput[]): FieldErrors {
    const errors: FieldErrors = {};
    if (!Array.isArray(authors) || authors.length < 1) errors.authors = 'Add at least one author.';
    else if (authors.length > MAX_AUTHORS) errors.authors = `A submission can list at most ${MAX_AUTHORS} authors.`;
    (authors ?? []).slice(0, MAX_AUTHORS).forEach((a, i) => {
        if (!a?.name?.trim()) errors[`authors.${i}.name`] = 'Enter the author’s full name.';
        else if (a.name.trim().length > MAX_AUTHOR_NAME_CHARS) errors[`authors.${i}.name`] = `Keep the name to ${MAX_AUTHOR_NAME_CHARS} characters or fewer.`;
        if (!a?.email?.trim()) errors[`authors.${i}.email`] = 'Enter an institutional email address.';
        else if (!isEmail(a.email)) errors[`authors.${i}.email`] = 'Enter a valid email address, like name@university.edu.';
        if (!a?.designation?.trim()) errors[`authors.${i}.designation`] = 'Enter a designation, such as Associate Professor.';
        else if (a.designation.trim().length > MAX_DESIGNATION_CHARS) {
            errors[`authors.${i}.designation`] = `Keep the designation to ${MAX_DESIGNATION_CHARS} characters or fewer.`;
        }
    });
    return errors;
}

export function validateDetails(input: Pick<SubmissionInput, 'title' | 'description' | 'keywords' | 'manuscriptUrl'>): FieldErrors {
    const errors: FieldErrors = {};
    const title = input.title?.trim() ?? '';
    if (title.length < 5) errors.title = 'Enter the full article title (at least 5 characters).';
    else if (title.length > 300) errors.title = 'Keep the title under 300 characters.';

    const description = input.description ?? '';
    const words = countWords(description);
    if (words < 20) errors.description = 'Write a description of at least 20 words.';
    else if (words > MAX_ABSTRACT_WORDS) errors.description = `Keep the description to ${MAX_ABSTRACT_WORDS} words or fewer (currently ${words}).`;
    else if (description.trim().length > MAX_DESCRIPTION_CHARS) errors.description = `Keep the description to ${MAX_DESCRIPTION_CHARS} characters or fewer.`;

    const keywords = parseKeywords(input.keywords ?? '');
    if (keywords.length === 0) errors.keywords = 'Add at least one keyword, separated by commas.';
    else if (keywords.length > 15) errors.keywords = 'Use 15 keywords or fewer.';
    else if (keywords.some((k) => k.length > 60 || !KEYWORD_RE.test(k))) {
        errors.keywords = 'Separate keywords with commas, for example: computing history, mainframes, ISRO.';
    }

    const url = checkManuscriptUrl(input.manuscriptUrl ?? '');
    if (!url.ok) errors.manuscriptUrl = url.message;
    return errors;
}

export function validateSubmission(input: SubmissionInput): FieldErrors {
    const errors: FieldErrors = {
        ...validateAuthors(input.authors),
        ...validateDetails(input),
    };
    if (!input.submitterEmail?.trim()) errors.submitterEmail = 'Enter the email address we should send updates to.';
    else if (!isEmail(input.submitterEmail)) errors.submitterEmail = 'Enter a valid email address.';
    if (input.originalityConfirmed !== true) errors.originalityConfirmed = 'Confirm that the work is original before submitting.';
    return errors;
}

export interface FileLike {
    name: string;
    size: number;
    type: string;
}

/** Client-side/metadata check. The server additionally checks the PDF magic bytes. */
export function checkPdfFile(file: FileLike | null | undefined, maxBytes = MAX_REPORT_BYTES): string | null {
    if (!file) return 'Choose a PDF file.';
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfName || (file.type && file.type !== PDF_MIME)) return 'This file must be a PDF.';
    if (file.size === 0) return 'This file is empty.';
    if (file.size > maxBytes) return `This file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`;
    return null;
}

/** Server-side content sniffing: every PDF starts with "%PDF-". */
export function hasPdfSignature(bytes: Uint8Array): boolean {
    return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/** Human-friendly reference shown to contributors, e.g. ITM-2026-7K3QF9. */
export function makeReferenceCode(year: number, random: Uint8Array): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
    let out = '';
    for (let i = 0; i < 6; i++) out += alphabet[random[i] % alphabet.length];
    return `ITM-${year}-${out}`;
}

/** Normalise free-text tags for publication. */
export function normalizeTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
        const clean = t.trim().replace(/\s+/g, ' ');
        const key = clean.toLowerCase();
        if (clean && clean.length <= 60 && !seen.has(key)) {
            seen.add(key);
            out.push(clean);
        }
    }
    return out.slice(0, 30);
}
