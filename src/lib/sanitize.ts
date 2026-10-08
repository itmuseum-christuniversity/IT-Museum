import DOMPurify from 'dompurify';

/** Sanitise CMS HTML (homepage sections) to a safe subset before rendering. */
export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h3', 'h4', 'figure', 'figcaption', 'img'],
        ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'width', 'height'],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
    });
}

/** Only allow http(s) links for user/CMS supplied URLs. */
export function safeUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid');
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
    } catch {
        return null;
    }
}
