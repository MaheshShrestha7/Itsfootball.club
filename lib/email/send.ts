// Sends email through the Resend API. Server-only: reads RESEND_API_KEY.

export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'notifications@itsfootball.club';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Display name before the address, e.g. the club's name. Defaults to itsfootball.club */
  fromName?: string;
  replyTo?: string;
  /** Resend drops a repeat send with the same key within 24 hours */
  idempotencyKey?: string;
  /** Extra headers, e.g. List-Unsubscribe */
  headers?: Record<string, string>;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Quotes a display name so commas, quotes or angle brackets in a club name can't break the From header */
const displayName = (name: string) => `"${name.replace(/["\\\r\n<>]/g, '').trim().slice(0, 70) || 'itsfootball.club'}"`;

const toResend = (email: OutgoingEmail) => ({
  from: `${displayName(email.fromName || 'itsfootball.club')} <${EMAIL_FROM_ADDRESS}>`,
  to: [email.to],
  subject: email.subject,
  html: email.html,
  text: email.text,
  ...(email.replyTo ? { reply_to: email.replyTo } : {}),
  ...(email.headers ? { headers: email.headers } : {}),
});

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(email.idempotencyKey ? { 'Idempotency-Key': email.idempotencyKey } : {}),
    },
    body: JSON.stringify(toResend(email)),
  }).catch((e: unknown) => ({ ok: false, status: 0, text: async () => String(e) }) as const);

  const body = await res.text();
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
  try {
    return { ok: true, id: String(JSON.parse(body).id || '') };
  } catch {
    return { ok: true, id: '' };
  }
}

/**
 * Up to 100 emails in one Resend call (their batch endpoint). All-or-nothing: on success the ids
 * come back in the same order as `emails`.
 */
export async function sendBatch(emails: OutgoingEmail[], idempotencyKey?: string): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set' };
  if (!emails.length) return { ok: true, ids: [] };
  if (emails.length > 100) return { ok: false, error: 'At most 100 emails per batch' };

  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(emails.map(toResend)),
  }).catch((e: unknown) => ({ ok: false, status: 0, text: async () => String(e) }) as const);

  const body = await res.text();
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
  try {
    return { ok: true, ids: (JSON.parse(body).data || []).map((d: { id?: string }) => String(d.id || '')) };
  } catch {
    return { ok: true, ids: [] };
  }
}
