// Sending club emails (reminders and admin notices): opt-outs, the email_log claim that makes each
// email go out at most once, and Resend batches of 100.
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendBatch } from './send';
import { unsubscribeHeaders, unsubscribeLinks } from './unsubscribe';
import type { RenderedEmail } from './templates';
import type { ClubBrandRow } from './club-brand';

export type EmailKind =
  | 'availability' | 'event' | 'renewal'
  | 'notice_match' | 'notice_event' | 'notice_news' | 'notice_renewal';

export interface ClubEmail {
  /** Unique name of this email; a key already in email_log is never sent again */
  key: string;
  clubId: string;
  kind: EmailKind;
  refId: string;
  to: string;
  fromName: string;
  email: RenderedEmail;
  /** One-click unsubscribe URL for the List-Unsubscribe header */
  oneClickUnsubscribe?: string | null;
}

export interface SendReport {
  sent: number;
  failed: number;
  /** Already in email_log (sent earlier, or claimed by an overlapping run) */
  alreadySent: number;
  error?: string;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const looksLikeEmail = (email: string | null | undefined): email is string => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Addresses that unsubscribed from this club's emails */
export async function optedOut(db: SupabaseClient, clubId: string): Promise<Set<string>> {
  const { data } = await db.from('email_opt_outs').select('email').eq('club_id', clubId);
  return new Set((data || []).map(r => normalizeEmail(r.email)));
}

/** Keys (of `keys`) that are already in email_log. Chunked: the keys travel in the request URL. */
export async function alreadyLogged(db: SupabaseClient, keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < keys.length; i += 100) {
    const { data } = await db.from('email_log').select('key').in('key', keys.slice(i, i + 100));
    (data || []).forEach(d => found.add(d.key));
  }
  return found;
}

/**
 * Claims each email in email_log, sends the claimed ones in batches of 100, and releases the
 * claims of a batch that failed (so a later run retries it). Look sends up by recipient in Resend.
 */
export async function sendClubEmails(db: SupabaseClient, emails: ClubEmail[]): Promise<SendReport> {
  const report: SendReport = { sent: 0, failed: 0, alreadySent: 0 };
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const { data: claimed, error } = await db.from('email_log')
      .upsert(
        chunk.map(e => ({ key: e.key, club_id: e.clubId, recipient: e.to, kind: e.kind, ref_id: e.refId, subject: e.email.subject })),
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('key');
    if (error) {
      // e.g. the email migration isn't applied: send nothing rather than risk repeats
      return { ...report, error: `email_log: ${error.message}` };
    }
    const mine = new Set((claimed || []).map(c => c.key));
    const batch = chunk.filter(e => mine.has(e.key));
    report.alreadySent += chunk.length - batch.length;
    if (!batch.length) continue;

    const result = await sendBatch(batch.map(e => ({
      to: e.to,
      ...e.email,
      fromName: e.fromName,
      headers: e.oneClickUnsubscribe ? unsubscribeHeaders(e.oneClickUnsubscribe) : undefined,
    })));
    if (result.ok) {
      report.sent += batch.length;
    } else {
      report.failed += batch.length;
      report.error = result.error;
      console.error('[club-emails] batch failed:', result.error);
      await db.from('email_log').delete().in('key', batch.map(e => e.key));
    }
  }
  return report;
}

/** An email not yet sent: rendered once the recipient's unsubscribe link is known */
export interface EmailDraft {
  key: string;
  club: ClubBrandRow;
  kind: EmailKind;
  refId: string;
  to: string;
  render: (unsubscribeUrl: string | null) => RenderedEmail;
}

/** Drops unsubscribed addresses (per club) and drafts already in email_log */
export async function filterDrafts(db: SupabaseClient, drafts: EmailDraft[]) {
  const optOuts = new Map<string, Set<string>>();
  for (const clubId of new Set(drafts.map(d => d.club.id))) optOuts.set(clubId, await optedOut(db, clubId));
  const allowed = drafts.filter(d => !optOuts.get(d.club.id)?.has(normalizeEmail(d.to)));
  const sent = await alreadyLogged(db, allowed.map(d => d.key));
  return { due: allowed.filter(d => !sent.has(d.key)), optedOut: drafts.length - allowed.length, alreadySent: sent.size };
}

/** Renders drafts with each recipient's unsubscribe link and header */
export async function materialize(drafts: EmailDraft[]): Promise<ClubEmail[]> {
  const out: ClubEmail[] = [];
  for (const d of drafts) {
    const links = await unsubscribeLinks(d.club.id, d.to);
    out.push({
      key: d.key, clubId: d.club.id, kind: d.kind, refId: d.refId, to: d.to, fromName: d.club.name,
      email: d.render(links?.page ?? null),
      oneClickUnsubscribe: links?.oneClick,
    });
  }
  return out;
}
