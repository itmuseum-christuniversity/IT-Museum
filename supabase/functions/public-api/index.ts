// Public (unauthenticated) endpoints for contributors:
//   POST multipart  action=submit    → create a submission (server-side validation, private report upload)
//   POST json       action=status    → status lookup with reference + access key
//   POST multipart  action=resubmit  → send a requested revision
// All three are rate limited per client IP (and submit also per submitter
// address and globally); see _shared/abuse.ts and README → "Abuse limits".
// A limit answers 429 with Retry-After.
import { checkRequestSize, corsHeaders, errorResponse, json, kickNotifications, readForm, readUpload, realDeps, serviceClient } from '../_shared/deno_deps.ts';
import { HttpError, lookupStatus, resubmit, submitArticle } from '../_shared/service.ts';
import type { SubmissionInput } from '../_shared/validation.ts';
import { clientIpFromHeaders } from '../_shared/abuse.ts';

const MAX_REQUEST_BYTES = 22 * 1024 * 1024; // two 10 MB reports + fields

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, { error: { code: 'METHOD', message: 'Use POST.' } }, 405);
    try {
        checkRequestSize(req, MAX_REQUEST_BYTES, 'The upload is too large. Each report must be 10 MB or smaller.');

        const deps = realDeps(serviceClient());
        const clientIp = clientIpFromHeaders(req.headers);
        const type = req.headers.get('content-type') ?? '';

        if (type.includes('multipart/form-data')) {
            const form = await readForm(req);
            const action = String(form.get('action') ?? '');
            if (action === 'submit') {
                let input: SubmissionInput;
                try {
                    input = JSON.parse(String(form.get('payload') ?? '{}'));
                } catch {
                    throw new HttpError(400, 'BAD_REQUEST', 'Malformed submission.');
                }
                if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new HttpError(400, 'BAD_REQUEST', 'Malformed submission.');
                const rawKey = form.get('idempotencyKey');
                const result = await submitArticle(
                    deps,
                    input,
                    { similarity: await readUpload(form, 'similarityReport'), ai: await readUpload(form, 'aiReport') },
                    { clientIp, idempotencyKey: typeof rawKey === 'string' && rawKey !== '' ? rawKey : null },
                );
                // A duplicate wrote nothing and queued no email.
                if (result.duplicate) return json(req, result, 200);
                kickNotifications();
                return json(req, result, 201);
            }
            if (action === 'resubmit') {
                const view = await resubmit(deps, String(form.get('reference') ?? ''), String(form.get('accessKey') ?? ''), {
                    manuscriptUrl: String(form.get('manuscriptUrl') ?? ''),
                    note: String(form.get('note') ?? ''),
                    similarity: await readUpload(form, 'similarityReport'),
                    ai: await readUpload(form, 'aiReport'),
                }, { clientIp });
                kickNotifications();
                return json(req, view);
            }
            throw new HttpError(400, 'BAD_REQUEST', 'Unknown action.');
        }

        const parsed = await req.json().catch(() => null);
        const body: Record<string, unknown> = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
        if (body.action === 'status') return json(req, await lookupStatus(deps, String(body.reference ?? ''), String(body.accessKey ?? ''), { clientIp }));
        throw new HttpError(400, 'BAD_REQUEST', 'Unknown action.');
    } catch (err) {
        return errorResponse(req, err);
    }
});
