import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { isUuid } from '@/lib/ids';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { looksLikeEmail, sendClubEmails, type ClubEmail } from '@/lib/email/club-emails';
import { tournamentTeamEmail } from '@/lib/email/templates';
import { money } from '@/lib/hosted-tournaments';
import { entryLink, gameLine, newEntryKey, teamGames, tournamentTitle, tournamentWhen } from '@/lib/tournament-entries-server';
import type { Tournament, TournamentEntry, TournamentParticipant } from '@/lib/supabase/types';

// The host club's side of guest team entries (hosted tournaments, migration 20261180).
//   POST { clubId, tournamentId, action, participantIds? }   staff who can edit Tournaments
//   invite   email each chosen team its entry link (a team without one gets one first)
//   remind   email every guest team that hasn't sent its entry yet
//   info     email every guest team its games, the venue and the info for teams (TX-6)
//   bill     an entry fee bill for every guest team that has none (TX-1); paid by card or bank
//            transfer from /{club}/pay/{id}, or marked paid by the treasurer
// Emails need the contact's address; the reply says who was skipped so the admin can copy the link.

type Action = 'invite' | 'remind' | 'info' | 'bill';
const ACTIONS: Action[] = ['invite', 'remind', 'info', 'bill'];
const KIND = { invite: 'tournament_entry', remind: 'tournament_reminder', info: 'tournament_info' } as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = ACTIONS.includes(body?.action) ? (body.action as Action) : null;
  if (!isUuid(body?.clubId) || !isUuid(body?.tournamentId) || !action) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const picked: string[] | null = Array.isArray(body.participantIds) ? body.participantIds.filter(isUuid).slice(0, 200) : null;

  const auth = await requireClubPerm(req, body.clubId, ['tournaments'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await durableRateLimit(`tournament-entries:${body.tournamentId}:${action}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That was sent a lot in the last hour. Please wait a little.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This is not available right now.' }, { status: 503 });

  const [{ data: t }, { data: club }, { data: teams }, { data: entries }, { data: settings }] = await Promise.all([
    db.from('tournaments').select('*').eq('id', body.tournamentId).eq('club_id', body.clubId).maybeSingle(),
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', body.clubId).maybeSingle(),
    db.from('tournament_participants').select('*').eq('tournament_id', body.tournamentId).eq('team_type', 'external'),
    db.from('tournament_entries').select('*').eq('tournament_id', body.tournamentId),
    db.from('club_payment_settings').select('currency').eq('club_id', body.clubId).maybeSingle(),
  ]);
  if (!t || !club) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  const tournament = t as Tournament;
  const row = club as ClubBrandRow & { contact_email?: string | null };
  const byTeam = new Map(((entries || []) as TournamentEntry[]).map(e => [e.participant_id, e]));
  let guests = ((teams || []) as TournamentParticipant[]).filter(p => !picked || picked.includes(p.id));
  const currency = settings?.currency || 'AUD';

  // Every guest team gets its entry row and link the first time the host acts on it
  const missing = guests.filter(p => !byTeam.get(p.id)?.entry_key);
  for (const p of missing) {
    const { data: e, error } = await db.from('tournament_entries')
      .upsert({ participant_id: p.id, tournament_id: tournament.id, club_id: row.id, entry_key: newEntryKey() }, { onConflict: 'participant_id' })
      .select('*').single();
    if (error) return NextResponse.json({ error: 'Could not make the entry links. Please try again.' }, { status: 500 });
    byTeam.set(p.id, e as TournamentEntry);
  }

  if (action === 'bill') {
    const fee = tournament.entry_fee_cents || 0;
    if (fee <= 0) return NextResponse.json({ error: 'Set an entry fee for this tournament first.' }, { status: 409 });
    const title = `Entry fee: ${tournamentTitle(tournament)}`;
    const due = (tournament.entry_deadline || tournament.start_date || '').slice(0, 10) || null;
    let billed = 0;
    for (const p of guests) {
      const e = byTeam.get(p.id)!;
      if (e.payment_id) continue;
      const { data: bill, error } = await db.from('payments').insert({
        club_id: row.id, kind: 'fee_request', category: 'registration_fees', member_id: null,
        request_id: tournament.id, request_title: title, description: `${title} (${p.name})`,
        amount_cents: fee, currency, method: 'bank_transfer', status: 'pending', due_on: due,
        payer_name: e.contact_name || p.name, payer_email: looksLikeEmail(e.contact_email) ? e.contact_email.trim().toLowerCase() : null,
      }).select('id').single();
      if (error || !bill) return NextResponse.json({ error: 'Could not add the entry fees. Please try again.' }, { status: 500 });
      await db.from('tournament_entries').update({ payment_id: bill.id }).eq('participant_id', p.id);
      billed++;
    }
    return NextResponse.json({ billed });
  }

  if (action === 'remind') guests = guests.filter(p => byTeam.get(p.id)?.status !== 'submitted');
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: 0, skipped: guests.map(p => p.name), error: 'Email isn\'t set up yet, so copy each team\'s link and send it yourself.' });
  }

  const payments = new Map<string, string>();
  const billIds = guests.map(p => byTeam.get(p.id)?.payment_id).filter((id): id is string => !!id);
  if (billIds.length) {
    const { data } = await db.from('payments').select('id, status').in('id', billIds);
    (data || []).forEach(b => payments.set(b.id, b.status));
  }
  const base = clubBaseUrl(row);
  const publicPage = `${base}/tournaments/${tournament.id}`;
  const replyTo = looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined;
  const stamp = new Date().toISOString().slice(0, 16);
  const skipped: string[] = [];
  const emails: ClubEmail[] = [];
  for (const p of guests) {
    const e = byTeam.get(p.id)!;
    if (!looksLikeEmail(e.contact_email)) { skipped.push(p.name); continue; }
    const games = action === 'info' ? (await teamGames(db, tournament.id, p.name)).filter(g => g.status !== 'completed').map(g => gameLine(g, p.name)) : [];
    emails.push({
      // One a minute at most per team and kind, so a double tap doesn't send twice
      key: `${KIND[action]}:${p.id}:${stamp}`,
      clubId: row.id, kind: KIND[action], refId: p.id, to: e.contact_email.trim(), fromName: row.name, replyTo,
      email: tournamentTeamEmail({
        brand: clubBrand(row), kind: action === 'remind' ? 'reminder' : action, contactName: e.contact_name || p.name, team: p.name,
        tournament: tournamentTitle(tournament), when: tournamentWhen(tournament), venue: tournament.venue || 'To be confirmed',
        deadline: tournament.entry_deadline ? new Date(tournament.entry_deadline).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: process.env.EMAIL_TIMEZONE || 'Australia/Sydney' }) : null,
        fee: tournament.entry_fee_cents ? money(tournament.entry_fee_cents, currency) : null,
        feePaid: e.payment_id ? payments.get(e.payment_id) === 'paid' : false,
        games, info: action === 'info' ? tournament.team_info : null,
        link: entryLink(row, e.entry_key!), publicLink: `${publicPage}?team=${p.id}`,
      }),
    });
  }
  const report = await sendClubEmails(db, emails);
  const sentIds = report.failed || report.error ? [] : emails.map(e => e.refId);
  if (sentIds.length && action !== 'invite') {
    await db.from('tournament_entries').update(action === 'info' ? { info_sent_at: new Date().toISOString() } : { reminded_at: new Date().toISOString() }).in('participant_id', sentIds);
  }
  if (report.error) console.error('[tournament-entries] email failed:', report.error);
  return NextResponse.json({ sent: report.sent + report.alreadySent, skipped, ...(report.failed ? { error: 'Some emails could not be sent. Copy those teams\' links instead.' } : {}) });
}
