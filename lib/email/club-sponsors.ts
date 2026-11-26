// The club's sponsors at the bottom of its emails: the ones fans see on the club site right now,
// top tiers first and bigger. renderEmail leaves a marker; sendClubEmails and the previews fill it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSponsorOnSite, sortSponsorsByTier } from '@/lib/sponsors';
import { CLUB_SPONSORS_MARK, sponsorStrip, type EmailSponsor, type RenderedEmail } from './templates';

const MAX = 8;

/** Club-wide sponsors on the site (event-only ones belong on that event's emails) */
export async function clubEmailSponsors(db: SupabaseClient, clubId: string, now = Date.now()): Promise<EmailSponsor[]> {
  const { data, error } = await db.from('sponsors')
    .select('name, logo_url, website_url, tier, display_order, is_active, package_status, ends_on')
    .eq('club_id', clubId).is('event_id', null);
  if (error) return []; // an email without sponsors beats no email
  return sortSponsorsByTier((data || []).filter(s => isSponsorOnSite(s, now))).slice(0, MAX)
    .map(s => ({ name: s.name, logoUrl: s.logo_url, url: s.website_url, big: s.tier === 'platinum' || s.tier === 'gold' }));
}

/** Puts the sponsors (or nothing) where renderEmail left the marker, and adds them to the text part */
export function fillClubSponsors(email: RenderedEmail, clubName: string, list: EmailSponsor[]): RenderedEmail {
  const m = email.html.match(CLUB_SPONSORS_MARK);
  if (!m) return email;
  const heading = `${clubName} is supported by`;
  return {
    ...email,
    html: email.html.replace(CLUB_SPONSORS_MARK, sponsorStrip(heading, list, m[1])),
    text: list.length ? withTextLine(email.text, `${heading}: ${list.map(s => s.name).join(', ')}`) : email.text,
  };
}

// Above the "--" footer, like the other sections of the text part
const withTextLine = (text: string, line: string) => {
  const at = text.lastIndexOf('\n--\n');
  return at < 0 ? `${text}\n\n${line}` : `${text.slice(0, at)}\n${line}\n${text.slice(at)}`;
};
