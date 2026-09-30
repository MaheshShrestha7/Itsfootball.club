import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOfClub } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { CLUB_BRAND_COLUMNS, type ClubBrandRow } from '@/lib/email/club-brand';
import { filterDrafts, materialize, sendClubEmails } from '@/lib/email/club-emails';
import { cleanSettings } from '@/lib/email/settings';
import { MAX_MESSAGE_LENGTH, NOTICE_KINDS, prepareNotice, type NoticeRequest } from '@/lib/email/notices';
import { pushConfigured, pushToClub } from '@/lib/push';
import { isUuid } from '@/lib/ids';

// Admin -> Email Notifications. Club admins only (checked with their own session token).
//   GET    ?clubId=           switches, setup status, opt-out count, recent sends
//   PATCH  { clubId, settings }   save the automatic-reminder switches
//   POST   { clubId, kind, refId?, audience?, message?, memberId?, send? }
//          (memberId: a renewal email to that one member, from Members Administration)
//          without send: who would get it + a preview; with send: true: sends it

const MAX_RECIPIENTS = 2000;

async function authorise(req: NextRequest, clubId: string | null | undefined) {
  if (!clubId) return { error: NextResponse.json({ error: 'Missing club.' }, { status: 400 }) };
  const auth = await requireAdminOfClub(req, clubId);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const db = getServiceClient();
  if (!db) return { error: NextResponse.json({ error: 'Email is not configured on the server.' }, { status: 503 }) };
  const { data: club } = await db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', clubId).maybeSingle();
  if (!club) return { error: NextResponse.json({ error: 'Club not found.' }, { status: 404 }) };
  // Separate query: before the email migration the column doesn't exist, and the page should still load
  const { data: settings } = await db.from('clubs').select('email_settings').eq('id', clubId).maybeSingle();
  return { db, club: { ...(club as ClubBrandRow), email_settings: settings?.email_settings ?? {} } };
}

export async function GET(req: NextRequest) {
  const a = await authorise(req, req.nextUrl.searchParams.get('clubId'));
  if ('error' in a) return a.error;
  const { db, club } = a;

  const [{ count: optOuts }, { data: log, error: logError }] = await Promise.all([
    db.from('email_opt_outs').select('email', { count: 'exact', head: true }).eq('club_id', club.id),
    db.from('email_log').select('kind, ref_id, subject, sent_at').eq('club_id', club.id).order('sent_at', { ascending: false }).limit(2000),
  ]);

  // One history line per notice (all its recipients), and per reminder type per day
  const groups = new Map<string, { kind: string; subject: string; sentAt: string; recipients: number }>();
  for (const row of log || []) {
    const notice = row.kind?.startsWith('notice_') && row.kind !== 'notice_renewal';
    const id = notice ? `${row.kind}:${row.ref_id}` : `${row.kind}:${String(row.sent_at).slice(0, 10)}`;
    const g = groups.get(id);
    if (g) g.recipients++;
    else groups.set(id, { kind: row.kind || 'email', subject: notice ? row.subject || '' : '', sentAt: row.sent_at, recipients: 1 });
  }

  return NextResponse.json({
    settings: cleanSettings(club.email_settings),
    ready: {
      resend: !!process.env.RESEND_API_KEY,
      unsubscribe: !!process.env.CRON_SECRET,
      database: !logError,
    },
    optOuts: optOuts || 0,
    history: [...groups.values()].slice(0, 40),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const a = await authorise(req, body?.clubId);
  if ('error' in a) return a.error;
  const settings = { ...cleanSettings(a.club.email_settings), ...cleanSettings(body?.settings) };
  const { error } = await a.db.from('clubs').update({ email_settings: settings }).eq('id', a.club.id);
  if (error) return NextResponse.json({ error: 'Could not save. Has the email migration been run?' }, { status: 500 });
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const a = await authorise(req, body?.clubId);
  if ('error' in a) return a.error;
  const { db, club } = a;

  if (!NOTICE_KINDS.includes(body?.kind)) return NextResponse.json({ error: 'Choose what to send.' }, { status: 400 });
  if (typeof body.message === 'string' && body.message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Keep the message under ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 });
  }
  const request: NoticeRequest = {
    kind: body.kind,
    refId: typeof body.refId === 'string' ? body.refId : undefined,
    audience: body.audience === 'players' ? 'players' : 'members',
    message: typeof body.message === 'string' ? body.message : undefined,
    memberId: body.kind === 'renewal' && isUuid(body.memberId) ? body.memberId : undefined,
  };

  const prepared = await prepareNotice(db, club, request);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  const { due, optedOut, alreadySent } = await filterDrafts(db, prepared.drafts);
  // Push followers (anyone who tapped the bell on the club site) for public notices
  const push = pushConfigured() ? prepared.push : undefined;
  const { count: followers } = push
    ? await db.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }).eq('club_id', club.id)
    : { count: 0 };
  const summary = { label: prepared.label, recipients: due.length, optedOut, alreadySent, noEmail: prepared.skippedNoEmail, followers: followers || 0 };
  // Once per notice a day, however often Send is pressed (the emails dedupe through email_log)
  const pushFollowers = async () =>
    push && followers && (await durableRateLimit(`notice-push:${club.id}:${request.kind}:${request.refId}`, 1, 24 * 60 * 60 * 1000))
      ? pushToClub(db, club.id, push)
      : 0;

  if (!body.send) {
    // Preview with the first recipient's details (or any, if everyone already has it)
    const sample = (due[0] || prepared.drafts[0])?.render('https://itsfootball.club/unsubscribe');
    return NextResponse.json({ ...summary, preview: sample ? { subject: sample.subject, html: sample.html } : null });
  }

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email sending is not set up yet (RESEND_API_KEY).' }, { status: 503 });
  if (!due.length) return NextResponse.json({ ...summary, sent: 0, failed: 0, pushed: await pushFollowers() });
  if (due.length > MAX_RECIPIENTS) return NextResponse.json({ error: `A notice can go to at most ${MAX_RECIPIENTS} people.` }, { status: 400 });
  // One-member renewal emails get their own, bigger allowance (admins send them one by one)
  if (!(await durableRateLimit(request.memberId ? `notice-member:${club.id}` : `notice:${club.id}`, request.memberId ? 100 : 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That\'s a lot of notices in an hour. Please wait a while before sending more.' }, { status: 429 });
  }

  const [report, pushed] = await Promise.all([sendClubEmails(db, await materialize(due)), pushFollowers()]);
  if (report.error && !report.sent) {
    return NextResponse.json({ ...summary, ...report, error: report.error.startsWith('email_log') ? 'Emails are not set up in the database yet (run the email migration).' : 'Sending failed. Please try again.' }, { status: 502 });
  }
  return NextResponse.json({ ...summary, ...report, pushed, alreadySent: alreadySent + report.alreadySent });
}
