import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { sendBatch } from '@/lib/email/send';
import { committeeMeetingEmail } from '@/lib/email/templates';
import { CLUB_BRAND_COLUMNS, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { isUuid } from '@/lib/ids';
import { clubTimeZone } from '@/lib/dates';
import { SITE_URL } from '@/lib/slugs';
import {
  buildMinutes, carriedActions, clock, longDay, MEETING_COLUMNS, meetingTitle, numberAgenda, topicKey,
  type CommitteeAction, type CommitteeMeeting,
} from '@/lib/committee-meetings';

// Emails a committee meeting's agenda (before) or its minutes (after) to everyone on the club's
// committee (club_members.is_executive) who has an email address.
//   POST { clubId, meetingId, kind: 'agenda' | 'minutes' }
// The meeting is read as the caller, so only staff who can edit the Committee area can send it.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind === 'minutes' ? 'minutes' : body?.kind === 'agenda' ? 'agenda' : null;
  if (!isUuid(body?.clubId) || !isUuid(body?.meetingId) || !kind) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, body.clubId, ['committee'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = auth.supabase;
  const [{ data: row }, { data: list }, { data: acts }] = await Promise.all([
    db.from('committee_meetings').select(MEETING_COLUMNS).eq('id', body.meetingId).eq('club_id', body.clubId).maybeSingle(),
    db.from('committee_meetings').select('id, kind, topic, event_id, starts_at, location').eq('club_id', body.clubId).limit(500),
    kind === 'minutes' ? db.from('committee_actions').select('*').eq('club_id', body.clubId).limit(2000) : Promise.resolve({ data: [] }),
  ]);
  const meeting = row as CommitteeMeeting | null;
  if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  if (kind === 'minutes' && meeting.status !== 'done') return NextResponse.json({ error: 'End the meeting first, then send its minutes.' }, { status: 400 });

  if (!(await durableRateLimit(`committee-email:${meeting.id}:${kind}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'This has been sent a few times already. Please try again in an hour.' }, { status: 429 });
  }

  // Committee emails and the club's brand aren't readable through every role, so read them with the service key
  const svc = getServiceClient();
  if (!svc) return NextResponse.json({ error: 'Email is not available right now.' }, { status: 503 });
  const [{ data: club }, { data: people }, { data: event }] = await Promise.all([
    svc.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', body.clubId).maybeSingle(),
    svc.from('club_members').select('id, full_name, email, executive_title, is_executive').eq('club_id', body.clubId),
    meeting.event_id ? svc.from('events').select('title').eq('id', meeting.event_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
  const members = (people || []) as { id: string; full_name: string; email: string | null; executive_title: string | null; is_executive: boolean | null }[];
  const byId = new Map(members.map(m => [m.id, m]));
  const committee = members.filter(m => m.is_executive);
  const valid = (e?: string | null) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const to = [...new Set(committee.filter(m => valid(m.email)).map(m => m.email!.trim().toLowerCase()))];
  if (!to.length) return NextResponse.json({ error: 'Nobody on the committee has an email address yet. Add them on People.' }, { status: 400 });

  const tz = clubTimeZone(club as ClubBrandRow);
  const title = meetingTitle(meeting, (event as { title?: string } | null)?.title);
  const when = `${longDay(meeting.started_at || meeting.starts_at, tz)}, ${clock(meeting.started_at || meeting.starts_at, tz)}`;
  const name = (id?: string | null) => (id ? byId.get(id)?.full_name : null);
  let rows: [string, string][];
  let link: string | null = null;
  if (kind === 'agenda') {
    rows = numberAgenda(meeting.agenda).map(r => [`${r.no}. ${r.item.title}`, [name(r.item.lead_id), `${r.minutes} min`].filter(Boolean).join(', ')]);
  } else {
    const meetings = (list || []) as CommitteeMeeting[];
    const actions = (acts || []) as CommitteeAction[];
    const next = meetings.filter(x => x.id !== meeting.id && topicKey(x) === topicKey(meeting) && x.starts_at > meeting.starts_at)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] || null;
    const minutes = buildMinutes({
      club: club.name, meeting, title, actions, carried: carriedActions(actions, meetings, meeting), meetings, next, tz,
      person: id => { const m = byId.get(id); return m ? (m.executive_title ? `${m.full_name} (${m.executive_title})` : m.full_name) : null; },
    });
    rows = [
      ...minutes.decisions.map(d => [`Decided (${d.no})`, d.text] as [string, string]),
      ...minutes.actions.map(a => ['Action', `${a.text}${a.who || a.due ? ` (${[a.who, a.due ? `by ${a.due}` : null].filter(Boolean).join(', ')})` : ''}`] as [string, string]),
    ];
    if (meeting.share_token) link = `${SITE_URL}/report/m/${meeting.share_token}`;
  }

  const message = committeeMeetingEmail({ brand: clubBrand(club as ClubBrandRow), kind, title, when, where: meeting.location, rows, link });
  const sent = await sendBatch(to.slice(0, 100).map(addr => ({ to: addr, ...message, fromName: club.name, log: { kind: `committee_${kind}`, clubId: club.id, refId: meeting.id } })));
  if (!sent.ok) {
    console.error('[admin/committee-meeting-email] send failed:', sent.error);
    return NextResponse.json({ error: 'The email could not be sent. Please try again in a moment.' }, { status: 502 });
  }
  await db.from('committee_meetings').update(kind === 'agenda' ? { agenda_sent_at: new Date().toISOString() } : { minutes_sent_at: new Date().toISOString() }).eq('id', meeting.id);
  return NextResponse.json({ ok: true, sent: Math.min(to.length, 100), skipped: committee.filter(m => !valid(m.email)).length });
}
