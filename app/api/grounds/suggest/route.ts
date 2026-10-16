import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { isUuid } from '@/lib/ids';
import { SITE_URL } from '@/lib/seo';
import { CONTACT_EMAIL } from '@/lib/faq';
import { sendEmail } from '@/lib/email/send';
import { groundSuggestion } from '@/lib/email/templates';
import { clubBaseUrl } from '@/lib/email/club-brand';
import { SUGGESTION_TOPICS, cleanSuggestion, groundPath } from '@/lib/grounds';

// "Suggest an edit" on a public ground guide (/grounds/{suburb}/{ground}). Saves the suggestion for the
// club that looks after the ground (Admin -> Branding -> Public Ground Guide) and emails that club, or
// the itsfootball.club team when no club looks after it. Nothing on the page changes until the club
// edits the ground itself.
export async function POST(req: NextRequest) {
  if (!(await durableRateLimit(`ground-suggest:${getClientIp(req.headers)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many suggestions. Please try again later.' }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ ok: true }); // honeypot

  if (typeof body.groundId !== 'string' || !isUuid(body.groundId)) return NextResponse.json({ error: 'Unknown ground.' }, { status: 400 });
  const cleaned = cleanSuggestion(body);
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Suggestions are not available right now.' }, { status: 503 });

  const { data: ground } = await db
    .from('grounds')
    .select('id, name, slug, suburb, suburb_slug, steward_club_id')
    .eq('id', body.groundId)
    .eq('is_published', true)
    .maybeSingle();
  if (!ground) return NextResponse.json({ error: 'That ground is no longer in the directory.' }, { status: 404 });

  const { error } = await db.from('ground_suggestions').insert({ ground_id: ground.id, ...cleaned.row });
  if (error) return NextResponse.json({ error: 'Your suggestion could not be saved. Please try again in a moment.' }, { status: 500 });

  // Best effort: the suggestion is saved either way and shows in the club's admin
  const { data: club } = ground.steward_club_id
    ? await db.from('clubs').select('name, slug, custom_domain, contact_email, is_active').eq('id', ground.steward_club_id).maybeSingle()
    : { data: null };
  const to = club?.is_active && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(club.contact_email || '') ? club.contact_email : CONTACT_EMAIL;
  const email = groundSuggestion({
    clubName: club?.name || 'itsfootball.club',
    ground: `${ground.name}, ${ground.suburb}`,
    topic: SUGGESTION_TOPICS.find(t => t.key === cleaned.row.topic)!.label,
    message: cleaned.row.message,
    contact: cleaned.row.contact,
    guideUrl: `${SITE_URL}${groundPath(ground)}`,
    adminUrl: club ? `${clubBaseUrl(club)}/admin/branding` : `${SITE_URL}${groundPath(ground)}`,
  });
  await sendEmail({ to, ...email, replyTo: cleaned.row.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.row.contact) ? cleaned.row.contact : undefined })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
