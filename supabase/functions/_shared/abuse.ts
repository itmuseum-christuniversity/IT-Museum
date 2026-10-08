/**
 * Abuse limits for the unauthenticated public API: limit definitions, client
 * IP extraction and key normalisation. Pure TypeScript (no Deno/npm imports),
 * shared by the Edge adapter and the vitest suite.
 *
 * Counting happens in Postgres (consume_rate_limit, migration 0005). Keys are
 * never stored in the clear: the service HMACs them with a server secret
 * before they leave the function (see Deps.hmacHex).
 */

export interface RateLimit {
    /** Bucket name stored with the counter (lowercase, [a-z0-9_:.-]). */
    bucket: string;
    windowSeconds: number;
    max: number;
}

const HOUR = 3600;
const DAY = 86400;

/**
 * Generous enough for real contributors (a department submitting from one
 * campus NAT on deadline day), tight enough that the form cannot be used to
 * send thousands of confirmation emails or fill storage.
 */
export const RATE_LIMITS = {
    /** New submissions from one client IP (IPv6: per /64). */
    submitPerIpHour: { bucket: 'submit:ip:1h', windowSeconds: HOUR, max: 20 },
    submitPerIpDay: { bucket: 'submit:ip:1d', windowSeconds: DAY, max: 50 },
    /** New submissions (and so confirmation emails) per submitter address. */
    submitPerEmailDay: { bucket: 'submit:email:1d', windowSeconds: DAY, max: 5 },
    /** Upper bound on new public submissions per day, whatever their origin. */
    submitGlobalDay: { bucket: 'submit:all:1d', windowSeconds: DAY, max: 300 },
    /** Revision uploads per client IP. */
    resubmitPerIpHour: { bucket: 'resubmit:ip:1h', windowSeconds: HOUR, max: 10 },
    /** Status look-ups (reference + access key) per client IP. */
    statusPerIp10Min: { bucket: 'status:ip:10m', windowSeconds: 600, max: 60 },
} as const satisfies Record<string, RateLimit>;

export interface RateLimitDecision {
    allowed: boolean;
    retryAfterSeconds: number;
}

interface HeaderSource {
    get(name: string): string | null;
}

/**
 * The caller's IP as seen by Supabase's edge, or null.
 *
 * `cf-connecting-ip` is set by Cloudflare in front of Supabase and replaces
 * any client-sent value, so it is preferred. `x-forwarded-for` is NOT
 * overwritten: a client can send its own value and the edge appends the real
 * address, so only the LAST entry is trusted, never the first.
 */
export function clientIpFromHeaders(headers: HeaderSource): string | null {
    const cf = normalizeIp(headers.get('cf-connecting-ip') ?? '');
    if (cf) return cf;
    const xff = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return xff.length ? normalizeIp(xff[xff.length - 1]) : null;
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function expandIpv6(raw: string): number[] | null {
    if (!/^[0-9a-f:.]+$/i.test(raw)) return null;
    let s = raw;
    let tail: number[] = [];
    const v4 = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) {
        if (!IPV4_RE.test(v4[2])) return null;
        const o = v4[2].split('.').map(Number);
        tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
        s = v4[1].endsWith('::') ? v4[1] : v4[1].slice(0, -1);
    }
    const halves = s.split('::');
    if (halves.length > 2) return null;
    const parse = (part: string) => (part ? part.split(':') : []);
    const head = parse(halves[0]);
    const rest = halves.length === 2 ? parse(halves[1]) : [];
    if ([...head, ...rest].some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
    const hex = (gs: string[]) => gs.map((g) => parseInt(g, 16));
    const total = head.length + rest.length + tail.length;
    if (halves.length === 1 && total !== 8) return null;
    if (halves.length === 2 && total > 7) return null;
    const zeros: number[] = halves.length === 2 ? new Array(8 - total).fill(0) : [];
    return [...hex(head), ...zeros, ...hex(rest), ...tail];
}

/**
 * Canonical form used as a rate-limit key: dotted IPv4, or the /64 prefix of
 * an IPv6 address (one subscriber usually controls a whole /64, so limiting
 * single IPv6 addresses would be trivial to bypass). IPv4-mapped IPv6 becomes
 * IPv4. Returns null for anything that is not an IP address.
 */
export function normalizeIp(raw: string): string | null {
    const s = raw.trim().replace(/^\[|\]$/g, '').split('%')[0];
    if (!s) return null;
    if (IPV4_RE.test(s)) return s;
    if (!s.includes(':')) return null;
    const g = expandIpv6(s.toLowerCase());
    if (!g) return null;
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
        return `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    }
    return `${g.slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`;
}

/**
 * Canonical mailbox for per-recipient limits, so `Victim+1@Gmail.com` and
 * `v.i.c.t.i.m@gmail.com` share one budget: lowercase, drop a `+tag`, and
 * drop dots for Gmail. Used only as a limiter key; the address the email is
 * sent to is unchanged.
 */
export function normalizeEmailForLimit(email: string): string {
    const e = email.trim().toLowerCase();
    const at = e.lastIndexOf('@');
    if (at < 1) return e;
    let local = e.slice(0, at).split('+')[0];
    let domain = e.slice(at + 1);
    if (domain === 'googlemail.com') domain = 'gmail.com';
    if (domain === 'gmail.com') local = local.replace(/\./g, '');
    return `${local}@${domain}`;
}

/** "about 3 minutes", "about 2 hours" — for the 429 message. */
export function describeWait(seconds: number): string {
    if (seconds < 90) return 'a minute';
    if (seconds < 55 * 60) return `about ${Math.ceil(seconds / 60)} minutes`;
    const hours = Math.ceil(seconds / 3600);
    return hours === 1 ? 'about an hour' : `about ${hours} hours`;
}
