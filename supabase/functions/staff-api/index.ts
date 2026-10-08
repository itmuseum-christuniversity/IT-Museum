// Authenticated staff endpoints. Every request:
//   1. verifies the Firebase ID token (signature, issuer, audience, expiry),
//   2. resolves an explicit, active staff_members record (deny by default),
//   3. runs the action through the shared workflow service, which checks the
//      role, the current status and the expected version before writing.
import { checkRequestSize, corsHeaders, errorResponse, json, kickNotifications, readForm, readUpload, realDeps, serviceClient, verifyFirebaseToken } from '../_shared/deno_deps.ts';
import { MAX_FINAL_PDF_BYTES } from '../_shared/validation.ts';
import {
    addNote,
    articleDetail,
    assign,
    HttpError,
    listQueue,
    listStaff,
    overview,
    resolveStaff,
    retryStorageCleanup,
    stageFinalPdf,
    suggestTags,
    transition,
    updateMetadata,
    upsertStaff,
} from '../_shared/service.ts';

const MAX_REQUEST_BYTES = 26 * 1024 * 1024;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, { error: { code: 'METHOD', message: 'Use POST.' } }, 405);
    try {
        checkRequestSize(req, MAX_REQUEST_BYTES, 'The file is too large (25 MB maximum).');
        const identity = await verifyFirebaseToken(req);
        const deps = realDeps(serviceClient());
        const staff = await resolveStaff(deps, identity);

        if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
            const form = await readForm(req);
            if (form.get('action') !== 'stage-final-pdf') throw new HttpError(400, 'BAD_REQUEST', 'Unknown action.');
            return json(req, await stageFinalPdf(deps, staff, {
                id: String(form.get('id') ?? ''),
                expectedVersion: Number(form.get('expectedVersion')),
                file: await readUpload(form, 'file', MAX_FINAL_PDF_BYTES),
            }));
        }

        const parsed = await req.json().catch(() => null);
        // deno-lint-ignore no-explicit-any
        const body: Record<string, any> = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
        switch (body.action) {
            case 'me':
                return json(req, { id: staff.id, email: staff.email, display_name: staff.display_name, role: staff.role });
            case 'overview':
                return json(req, await overview(deps, staff));
            case 'queue':
                return json(req, await listQueue(deps, staff, body.query ?? {}));
            case 'article':
                return json(req, await articleDetail(deps, staff, String(body.id ?? '')));
            case 'transition': {
                const result = await transition(deps, staff, {
                    id: String(body.id ?? ''),
                    action: String(body.workflowAction ?? ''),
                    reason: body.reason ?? '',
                    expectedVersion: Number(body.expectedVersion),
                });
                kickNotifications();
                return json(req, result);
            }
            case 'note':
                return json(req, await addNote(deps, staff, { id: String(body.id ?? ''), body: String(body.body ?? '') }));
            case 'assign':
                return json(req, await assign(deps, staff, { id: String(body.id ?? ''), assigneeId: body.assigneeId ?? null, expectedVersion: Number(body.expectedVersion) }));
            case 'suggest-tags':
                return json(req, await suggestTags(deps, staff, { id: String(body.id ?? ''), tags: body.tags ?? [], expectedVersion: Number(body.expectedVersion) }));
            case 'update-metadata':
                return json(req, await updateMetadata(deps, staff, { id: String(body.id ?? ''), expectedVersion: Number(body.expectedVersion), fields: body.fields ?? {} }));
            case 'retry-storage-cleanup':
                return json(req, await retryStorageCleanup(deps, staff, { id: String(body.id ?? '') }));
            case 'staff-list':
                return json(req, await listStaff(deps, staff));
            case 'staff-upsert':
                return json(req, await upsertStaff(deps, staff, body.member ?? {}));
            default:
                throw new HttpError(400, 'BAD_REQUEST', 'Unknown action.');
        }
    } catch (err) {
        return errorResponse(req, err);
    }
});
