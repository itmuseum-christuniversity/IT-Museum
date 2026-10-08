import { isEmail } from '../../supabase/functions/_shared/validation.ts';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const valid = (d: Date) => !Number.isNaN(d.getTime());

export function formatDate(iso: string | null | undefined, style: 'long' | 'short' = 'long'): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return valid(d) ? (style === 'long' ? dateFmt : shortFmt).format(d) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return valid(d) ? timeFmt.format(d) : '—';
}

export function yearOf(iso: string | null | undefined): string {
    if (!iso) return 'n.d.';
    const d = new Date(iso);
    return valid(d) ? String(d.getFullYear()) : 'n.d.';
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number {
    if (!iso) return 0;
    return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export function ageLabel(iso: string | null | undefined): string {
    const d = daysSince(iso);
    if (d === 0) return 'today';
    if (d === 1) return '1 day';
    return `${d} days`;
}

/** A mailto: link for exactly one valid address (percent-encoded), or null so callers render plain text. */
export function mailtoHref(email: string | null | undefined): string | null {
    const address = email?.trim() ?? '';
    if (!isEmail(address)) return null;
    return `mailto:${encodeURIComponent(address).replace(/%40/g, '@')}`;
}
