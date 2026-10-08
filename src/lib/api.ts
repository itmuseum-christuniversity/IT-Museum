import { config } from './config';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public code: string,
        public fields: Record<string, string> | null = null,
        /** For 429 responses: seconds until the limit resets (body or Retry-After header). */
        public retryAfterSeconds: number | null = null,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const OFFLINE = 'We could not reach the server. Check your connection and try again.';

function endpoint(fn: string) {
    if (!config.functionsUrl) throw new ApiError('The service is not configured (missing Supabase settings).', 0, 'NOT_CONFIGURED');
    return `${config.functionsUrl}/${fn}`;
}

function headers(token?: string): Record<string, string> {
    const h: Record<string, string> = {};
    if (config.supabaseAnonKey) h.apikey = config.supabaseAnonKey;
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

function retryAfter(fromBody: unknown, header: string | null): number | null {
    const n = typeof fromBody === 'number' ? fromBody : header !== null && /^\d+$/.test(header.trim()) ? Number(header.trim()) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
}

async function parse<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        const e = body?.error;
        throw new ApiError(
            e?.message ?? `Request failed (${res.status}).`,
            res.status,
            e?.code ?? 'HTTP',
            e?.fields ?? null,
            res.status === 429 ? retryAfter(e?.retryAfterSeconds, res.headers.get('Retry-After')) : null,
        );
    }
    return body as T;
}

export async function callJson<T>(fn: string, body: unknown, token?: string): Promise<T> {
    let res: Response;
    try {
        res = await fetch(endpoint(fn), {
            method: 'POST',
            headers: { ...headers(token), 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch {
        throw new ApiError(OFFLINE, 0, 'NETWORK');
    }
    return parse<T>(res);
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function callMultipart<T>(fn: string, form: FormData, opts: { token?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        let url: string;
        try {
            url = endpoint(fn);
        } catch (e) {
            reject(e);
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        for (const [k, v] of Object.entries(headers(opts.token))) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
        };
        xhr.onload = () => {
            let body: { error?: { message?: string; code?: string; fields?: Record<string, string>; retryAfterSeconds?: number } } | null = null;
            try {
                body = JSON.parse(xhr.responseText);
            } catch {
                /* non-JSON error page */
            }
            if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
            else {
                reject(
                    new ApiError(
                        body?.error?.message ?? `Request failed (${xhr.status}).`,
                        xhr.status,
                        body?.error?.code ?? 'HTTP',
                        body?.error?.fields ?? null,
                        xhr.status === 429 ? retryAfter(body?.error?.retryAfterSeconds, xhr.getResponseHeader('Retry-After')) : null,
                    ),
                );
            }
        };
        xhr.onerror = () => reject(new ApiError(OFFLINE, 0, 'NETWORK'));
        xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0, 'ABORTED'));
        opts.signal?.addEventListener('abort', () => xhr.abort());
        xhr.send(form);
    });
}
