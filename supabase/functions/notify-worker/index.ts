// Delivers queued contributor emails from public.notification_outbox.
// Runs after each committed workflow change (kicked by the APIs) and on a
// schedule for retries (see README → "Notifications"). Each claimed row is
// marked sent or failed with exponential backoff; nothing is sent from the
// browser.
import { serviceClient } from '../_shared/deno_deps.ts';
import { MAX_NOTIFICATION_ATTEMPTS, nextAttemptDelayMinutes, renderNotification, type NotificationPayload } from '../_shared/notifications.ts';

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('NOTIFY_CRON_SECRET') ?? '';

/** Constant-time string comparison: hash both sides so lengths are equal, then XOR-accumulate. */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    if (!a || !b) return false;
    const enc = new TextEncoder();
    const [da, db] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
    const x = new Uint8Array(da);
    const y = new Uint8Array(db);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
    // EmailJS REST API (server-side). Requires "Allow EmailJS API for non-browser
    // applications" and a private key. The template should use {{to_email}},
    // {{subject}} and {{message}}.
    const serviceId = Deno.env.get('EMAILJS_SERVICE_ID');
    const templateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
    const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const privateKey = Deno.env.get('EMAILJS_PRIVATE_KEY');
    if (!serviceId || !templateId || !publicKey || !privateKey) throw new Error('Email provider is not configured');
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: { to_email: to, subject, message: text },
        }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`EmailJS ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Record an outbox outcome; supabase-js returns errors rather than throwing, so check and log without rethrowing. */
async function markOutbox(db: ReturnType<typeof serviceClient>, id: string, status: 'sent' | 'failed', fields: Record<string, unknown>): Promise<void> {
    try {
        const { error } = await db.from('notification_outbox').update({ status, ...fields }).eq('id', id);
        if (error) console.error(`notify-worker: could not mark outbox row ${id} as ${status}:`, error.message);
    } catch (e) {
        console.error(`notify-worker: could not mark outbox row ${id} as ${status}:`, e instanceof Error ? e.message : 'unknown error');
    }
}

Deno.serve(async (req) => {
    const auth = req.headers.get('authorization') ?? '';
    const [bearerOk, cronOk] = await Promise.all([
        timingSafeEqual(auth, `Bearer ${SERVICE_KEY}`).then((ok) => Boolean(SERVICE_KEY) && ok),
        timingSafeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET),
    ]);
    const authorised = bearerOk || cronOk;
    if (!authorised) return new Response('Forbidden', { status: 403 });

    const db = serviceClient();
    const { data: batch, error } = await db.rpc('claim_notifications', { p_limit: 20 });
    if (error) return new Response(error.message, { status: 500 });

    let sent = 0;
    let failed = 0;
    for (const n of batch ?? []) {
        let delivered = false;
        try {
            const email = renderNotification(n.template, n.payload as NotificationPayload);
            await sendEmail(n.recipient, email.subject, email.text);
            delivered = true;
        } catch (e) {
            failed++;
            await markOutbox(db, n.id, 'failed', {
                last_error: String((e as Error).message ?? e).slice(0, 500),
                next_attempt_at: new Date(Date.now() + nextAttemptDelayMinutes(n.attempts) * 60000).toISOString(),
                ...(n.attempts >= MAX_NOTIFICATION_ATTEMPTS ? { attempts: MAX_NOTIFICATION_ATTEMPTS } : {}),
            });
        }
        if (delivered) {
            // The email is out: a failure to record it must be logged, never turned into a "failed" (re-send) mark.
            sent++;
            await markOutbox(db, n.id, 'sent', { sent_at: new Date().toISOString(), last_error: null });
        }
    }
    return new Response(JSON.stringify({ claimed: batch?.length ?? 0, sent, failed }), { headers: { 'Content-Type': 'application/json' } });
});
