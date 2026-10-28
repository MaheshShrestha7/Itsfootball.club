import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { CLUB_BRAND_COLUMNS, type ClubBrandRow } from '@/lib/email/club-brand';
import { filterDrafts, materialize, sendClubEmails } from '@/lib/email/club-emails';
import { MAX_TEAM_BODY, MAX_TEAM_TITLE, teamAudience, teamMessageNotice } from '@/lib/email/team-notices';
import { pushConfigured, pushToClub } from '@/lib/push';
import { isUuid } from '@/lib/ids';

// Admin -> Email Notifications -> Message a team (F27-2).
//   POST { clubId, teamId, messageId, title, body, push?, send? }
//   without send: who gets it + an email preview; with send: true: emails it, puts it in each
//   member's Messages inbox, and (push) notifies the club's followers. messageId is made by the
//   page for each new message, so pressing Send twice sends it once.

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.teamId) || !isUuid(body?.messageId)) {
    return NextResponse.json({ error: 'Choose a team.' }, { status: 400 });
  }
  const title = clean(body.title, MAX_TEAM_TITLE);
  const text = typeof body.body === 'string' ? body.body.replace(/[<>]/g, '').trim() : '';
  if (!title || !text) return NextResponse.json({ error: 'Write a subject and a message.' }, { status: 400 });
  if (text.length > MAX_TEAM_BODY) return NextResponse.json({ error: `Keep the message under ${MAX_TEAM_BODY} characters.` }, { status: 400 });

  const auth = await requireClubPerm(req, body.clubId, ['emails'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Messages are not set up on the server.' }, { status: 503 });
  const { data: club } = await db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', body.clubId).maybeSingle();
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });

  const audience = await teamAudience(db, body.clubId, body.teamId);
  if (!audience) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  const wantsPush = body.push === true && pushConfigured();
  const notice = teamMessageNotice(club as ClubBrandRow, audience, { id: body.messageId, title, body: text, push: wantsPush });
  const { due, optedOut, alreadySent } = await filterDrafts(db, notice.drafts);
  const { count: followers } = wantsPush
    ? await db.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).eq('club_id', body.clubId)
    : { count: 0 };
  const summary = { label: notice.label, members: notice.members, recipients: due.length, optedOut, alreadySent, noEmail: notice.noEmail, followers: followers || 0 };

  if (!body.send) {
    const sample = (due[0] || notice.drafts[0])?.render('https://itsfootball.club/unsubscribe');
    return NextResponse.json({ ...summary, preview: sample ? { subject: sample.subject, html: sample.html } : null });
  }
  if (!notice.members) return NextResponse.json({ error: 'Nobody is in this team yet. Add players on Club Teams first.' }, { status: 400 });
  if (!(await durableRateLimit(`team-message:${body.clubId}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That\'s a lot of team messages in an hour. Please wait a while.' }, { status: 429 });
  }
  // The inbox copies and push go once per message, however often Send is pressed
  const first = await durableRateLimit(`notice-once:${notice.onceKey}`, 1, 7 * 24 * 60 * 60 * 1000);
  const [{ error: inboxError }, pushed] = first
    ? await Promise.all([
        db.from('member_messages').insert(notice.inbox),
        notice.push && followers ? pushToClub(db, body.clubId, notice.push) : Promise.resolve(0),
      ])
    : [{ error: null }, 0];
  const report = process.env.RESEND_API_KEY && due.length
    ? await sendClubEmails(db, await materialize(due))
    : { sent: 0, failed: 0, alreadySent: 0 };
  if (inboxError && !report.sent) return NextResponse.json({ ...summary, error: 'Could not send the message. Please try again.' }, { status: 500 });
  return NextResponse.json({ ...summary, ...report, inbox: first && !inboxError ? notice.inbox.length : 0, pushed, alreadySent: alreadySent + report.alreadySent });
}
