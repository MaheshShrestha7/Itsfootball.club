'use client';

// The Teams tab of a hosted tournament (plan 18 Nov 2026): guest clubs with their crest, colours,
// staff and contact; each team's private entry link; entry fees; the check-in desk on the day; kit
// clashes. Shown once migration 20261180 has run (the old list shows before it).

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, Link2, Copy, Check, Mail, Users, CreditCard, ClipboardCheck, Send, AlertTriangle, Info, X, RefreshCw, Shirt, Search, Unlink, Loader2,
} from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { DEFAULT_CREST, crestOnError } from '@/lib/crest';
import { confirmAction } from '@/components/ConfirmDialog';
import ImageUploadZone from '@/components/ImageUploadZone';
import PopupPanel from '@/components/PopupPanel';
import { GROUP_LETTERS, effectiveGroupRules } from '@/lib/tournament-engine';
import { ENTRY_POSITIONS, kitClashes, money, parseEntry, parsePlayers, parseTeamList, shortCode, kickoffLabel, type EntryPlayer } from '@/lib/hosted-tournaments';
import { useTournamentEntries } from '@/lib/use-tournament-entries';
import { findClubs, removeLink, saveLink, useTournamentLinks, type FoundClub, type LinkPick, type TournamentLink } from '@/lib/tournament-links';
import { ourSide } from '@/lib/friendlies';
import type { Club, Match, Tournament, TournamentEntry, TournamentParticipant } from '@/lib/supabase/types';
import '@/components/tournament/hosted.css';

const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.35rem' };

const ENTRY_STATUS: Record<TournamentEntry['status'], { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'muted' },
  in_progress: { label: 'In progress', tone: 'warn' },
  submitted: { label: 'Entry sent', tone: 'ok' },
};

const hexOr = (c: string | null | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);

function Crest({ team, size = 40 }: { team: Pick<TournamentParticipant, 'logo_url' | 'color' | 'secondary_color'>; size?: number }) {
  return (
    <span className="ht-crest" style={{ width: size, height: size, '--ht-c1': hexOr(team.color, '') || undefined, '--ht-c2': hexOr(team.secondary_color, hexOr(team.color, '')) || undefined } as React.CSSProperties}>
      <img loading="lazy" decoding="async" src={team.logo_url || DEFAULT_CREST} onError={crestOnError} alt="" />
    </span>
  );
}

export default function GuestTeamsPanel({ club, tournament, participants, matches, isEvent, onFeedback, onRedraw }: {
  club: Club;
  tournament: Tournament;
  participants: TournamentParticipant[];
  matches: Match[];
  /** A free public tournament: no entry links, fees or emails, only teams, crests and colours */
  isEvent: boolean;
  onFeedback: (tone: 'success' | 'error', message: string) => void;
  /** Redo the draw keeping the groups set here */
  onRedraw: () => void;
}) {
  const { addTournamentParticipant, updateTournamentParticipant, deleteTournamentParticipant, deleteMatch, saveTournament, saveNow } = useClub();
  const hosted = useTournamentEntries(tournament.id, !isEvent);
  const linking = useTournamentLinks(isEvent ? undefined : tournament.id);
  const [editing, setEditing] = useState<TournamentParticipant | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [squadOf, setSquadOf] = useState<TournamentParticipant | null>(null);
  const [desk, setDesk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [rowNote, setRowNote] = useState<{ id: string; tone: 'success' | 'error'; text: string } | null>(null);

  const entryOf = (id: string) => hosted.entries.find(e => e.participant_id === id);
  const playersOf = (id: string) => hosted.squads.filter(s => s.participant_id === id);
  const guests = participants.filter(p => p.team_type === 'external');
  const clashes = useMemo(() => kitClashes(matches, participants), [matches, participants]);
  const fee = tournament.entry_fee_cents || 0;
  const checkedIn = participants.filter(p => entryOf(p.id)?.checked_in_at).length;
  // Groups set by hand (group stage + knockout). The draw is out of date once a team sits in a
  // different group from its group games.
  const grouped = tournament.format === 'group_knockout';
  const groupLetters = grouped ? GROUP_LETTERS.slice(0, effectiveGroupRules(tournament, participants.length).groupCount) : [];
  const groupGames = matches.filter(m => m.tournament_stage === 'group');
  const drawStale = grouped && groupGames.length > 0 && participants.some(p =>
    groupGames.some(m => (m.home_team_name === p.name || m.away_team_name === p.name) && m.tournament_group !== `Group ${p.group}`));
  const groupsOk = groupLetters.every(l => participants.filter(p => p.group === l).length >= 2)
    && participants.every(p => p.group && groupLetters.includes(p.group));
  const linkFor = (e?: TournamentEntry) => (e?.entry_key ? `${window.location.origin}/${club.slug}/tournament-entry/${e.entry_key}` : null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } finally { setBusy(null); }
  };

  const copyLink = (p: TournamentParticipant) => run(`copy-${p.id}`, async () => {
    const e = entryOf(p.id);
    const key = e?.entry_key || `te-${crypto.randomUUID().replace(/-/g, '')}`;
    if (!e?.entry_key) {
      const err = await hosted.saveEntry(p.id, { entry_key: key });
      if (err) return onFeedback('error', `Could not make the link: ${err}`);
    }
    const link = `${window.location.origin}/${club.slug}/tournament-entry/${key}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(p.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this link', link);
    }
  });

  // A team added a moment ago is saved in the background; its private entry row needs it in the
  // database first (the entry points at it)
  const saveAfterTeam = async (fn: () => Promise<unknown>) => {
    await new Promise(resolve => setTimeout(resolve, 50));
    await saveNow();
    await fn();
  };

  const email = (action: 'invite' | 'remind' | 'info', ids?: string[]) => run(action, async () => {
    const res = await hosted.act(club.id, action, ids);
    if (!res.ok && !res.sent) return onFeedback('error', res.error || 'That didn\'t send.');
    const skipped = res.skipped?.length ? ` No email address for ${res.skipped.join(', ')}: copy their link instead.` : '';
    onFeedback(res.sent ? 'success' : 'error', `${res.sent ? `Sent to ${res.sent} team${res.sent === 1 ? '' : 's'}.` : 'Nothing sent.'}${skipped}${res.error && res.sent ? ` ${res.error}` : ''}`);
  });

  // One team's link, from its row. The answer shows on that row: the page banner is off screen on a phone.
  const emailLink = async (p: TournamentParticipant, to: string) => {
    if (!(await confirmAction({
      title: `Email ${p.name} their entry link?`,
      message: `It goes to ${to}. They use the link to enter their players, staff and contact details for this tournament.`,
      confirmLabel: 'Send email',
    }))) return;
    setRowNote(null);
    await run(`email-${p.id}`, async () => {
      const res = await hosted.act(club.id, 'invite', [p.id]);
      setRowNote(res.sent
        ? { id: p.id, tone: 'success', text: `Entry link emailed to ${to}.` }
        : { id: p.id, tone: 'error', text: res.error || (res.skipped?.length ? 'Their email address doesn\'t look right. Check it in Edit, or copy the link and send it yourself.' : 'That didn\'t send. Copy the link and send it yourself.') });
    });
  };

  const bill = () => run('bill', async () => {
    const res = await hosted.act(club.id, 'bill');
    if (!res.ok) return onFeedback('error', res.error || 'Could not add the entry fees.');
    onFeedback('success', res.billed ? `Entry fee added for ${res.billed} team${res.billed === 1 ? '' : 's'}. They can pay from their entry link.` : 'Every guest team already has its entry fee.');
  });

  const remove = async (p: TournamentParticipant) => {
    const isPlayed = (m: Match) => m.status === 'completed' || m.status === 'live' || m.status === 'halftime';
    const theirs = matches.filter(m => m.home_team_name === p.name || m.away_team_name === p.name);
    const anyPlayed = matches.some(isPlayed);
    // Their unplayed group / league games go with them; a knockout game can't just vanish from the bracket
    const dropGames = theirs.filter(m => !isPlayed(m) && (m.tournament_stage || 'group') === 'group');
    const koLeft = theirs.filter(m => !isPlayed(m) && (m.tournament_stage || 'group') !== 'group');
    const koNote = koLeft.length
      ? ` They are still in knockout ${koLeft.length === 1 ? 'game' : 'games'} ${koLeft.map(m => `M#${m.tournament_match_number ?? '?'}`).join(', ')}: enter a result there for the other team.`
      : '';
    if (!(await confirmAction({
      title: `Remove ${p.name}?`,
      message: `Their entry, players and link go too.${
        !theirs.length ? ''
        : !anyPlayed ? ' No games are played yet, so the draw is made again without them.'
        : ` Their ${dropGames.length} unplayed ${dropGames.length === 1 ? 'game is' : 'games are'} taken out of the fixtures. Results already in stay.${koNote}`}`,
      confirmLabel: 'Remove team', danger: true,
    }))) return;
    if (theirs.length && !anyPlayed) {
      // Nothing to lose yet: one redraw without them, so no game is left pointing at a team that has gone
      saveTournament(tournament.id, {}, participants.filter(x => x.id !== p.id));
      onFeedback('success', `Removed ${p.name} and made the draw again without them.`);
      return;
    }
    deleteTournamentParticipant(p.id);
    dropGames.forEach(m => deleteMatch(m.id));
    onFeedback('success', theirs.length
      ? `Removed ${p.name} and ${dropGames.length} unplayed ${dropGames.length === 1 ? 'game' : 'games'}.${koNote}`
      : `Removed ${p.name}.`);
  };

  return (
    <div>
      <div className="ht-toolbar">
        <p className="ht-lede">
          {isEvent ? 'Teams in this tournament, with their crest and colours.' : 'Every team gets its own entry link to add its crest, colours, staff and players. No account needed.'}
        </p>
        <div className="ht-actions">
          {!isEvent && (
            <>
              <button type="button" className="btn btn-sm btn-secondary" style={btn} aria-pressed={desk} onClick={() => setDesk(d => !d)} data-view-ok>
                <ClipboardCheck size={14} aria-hidden="true" /><span>{desk ? 'Close check-in' : 'Check-in desk'}</span>
              </button>
              <button type="button" className="btn btn-sm btn-secondary" style={btn} disabled={!!busy || !guests.length} onClick={() => email('remind')} title="Email every guest team that hasn't sent its entry yet">
                <Send size={14} aria-hidden="true" /><span>{busy === 'remind' ? 'Sending…' : 'Remind teams'}</span>
              </button>
              <button type="button" className="btn btn-sm btn-secondary" style={btn} disabled={!!busy || !guests.length} onClick={() => email('info')} title="Email each guest team its games, the venue and the info for teams">
                <Info size={14} aria-hidden="true" /><span>{busy === 'info' ? 'Sending…' : 'Email info pack'}</span>
              </button>
              {fee > 0 && (
                <button type="button" className="btn btn-sm btn-secondary" style={btn} disabled={!!busy || !guests.length} onClick={bill}>
                  <CreditCard size={14} aria-hidden="true" /><span>{busy === 'bill' ? 'Adding…' : `Add ${money(fee)} entry fees`}</span>
                </button>
              )}
            </>
          )}
          <button type="button" className="btn btn-sm btn-secondary" style={btn} onClick={() => setBulkOpen(true)}>
            <Users size={14} aria-hidden="true" /><span>Add several clubs</span>
          </button>
          <button type="button" className="btn btn-sm btn-primary" style={btn} onClick={() => setEditing('new')}>
            <Plus size={14} aria-hidden="true" /><span>Add a club</span>
          </button>
        </div>
      </div>

      {desk && (
        <p className="ht-desk-strip" role="status">
          <ClipboardCheck size={16} aria-hidden="true" />
          <span><b>{checkedIn} of {participants.length}</b> teams checked in. Tap a team when it arrives, then Players to tick who is here.</span>
        </p>
      )}

      {clashes.length > 0 && (
        <div className="ht-warn" role="note">
          <Shirt size={16} aria-hidden="true" />
          <div>
            <b>Kit clash{clashes.length === 1 ? '' : 'es'}: same main colour</b>
            <ul>
              {clashes.slice(0, 6).map(c => (
                <li key={c.match.id}>{kickoffLabel(c.match)}{c.match.pitch_label ? `, ${c.match.pitch_label}` : ''}: {c.home.name} v {c.away.name}. One team needs bibs or a change kit.</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {drawStale && (
        <div className="ht-warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <b>The groups have changed since the draw</b>
            <p>{groupsOk
              ? 'Redo the draw to make the group games match. Scores already entered are cleared.'
              : 'Every team needs a group, and every group needs at least 2 teams, before the draw can be redone.'}</p>
            {groupsOk && (
              <button type="button" className="btn btn-sm btn-primary" style={{ ...btn, whiteSpace: 'nowrap' }} onClick={onRedraw}>
                <RefreshCw size={14} aria-hidden="true" /><span>Redo the draw with these groups</span>
              </button>
            )}
          </div>
        </div>
      )}

      {participants.length > 0 && (
        <div className="ht-board">
          <table className="ht-table ht-board-table">
            <caption className="sr-only">Teams in {tournament.name}</caption>
            <thead>
              <tr>
                <th scope="col">Team</th>
                {grouped && <th scope="col">Group</th>}
                <th scope="col" title="Optional. Keeps top teams apart in the draw. Leave blank for a random draw.">Seed (optional)</th>
                {!isEvent && <th scope="col">Entry</th>}
                {!isEvent && <th scope="col">Players</th>}
                {!isEvent && fee > 0 && <th scope="col">Entry fee</th>}
                {desk && !isEvent && <th scope="col">Arrived</th>}
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {participants.map(p => {
                const e = entryOf(p.id);
                const players = playersOf(p.id);
                const status = e ? ENTRY_STATUS[e.status] : ENTRY_STATUS.not_started;
                const billInfo = e?.payment_id ? hosted.bills[e.payment_id] : undefined;
                const guest = p.team_type === 'external';
                const here = !!e?.checked_in_at;
                const linkOf = linking.linkOf(p.id);
                const staff = [p.manager_name && `Manager ${p.manager_name}`, p.coach_name && `coach ${p.coach_name}`].filter(Boolean).join(', ');
                return (
                  <tr key={p.id} data-here={desk && here ? 'true' : undefined}>
                    <th scope="row">
                      <div className="ht-team-cell">
                        <Crest team={p} size={36} />
                        <div className="min-w-0">
                          <div className="ht-name">{p.name}</div>
                          <div className="ht-sub">
                            {linkOf ? <><Link2 size={12} aria-hidden="true" className="ht-inline-icon" />Linked to {linkOf.linked?.name || 'a club on itsfootball.club'}</> : guest ? 'Guest club' : 'Our team'}{staff ? `. ${staff}` : ''}
                          </div>
                          {linkOf && <span className="ht-state" data-tone={LINK_STATUS[linkOf.status].tone}>{linkOf.status === 'pending' ? `Waiting for ${linkOf.linked?.name || 'them'} to accept` : LINK_STATUS[linkOf.status].label}</span>}
                          {guest && !isEvent && (e?.contact_name || e?.contact_email || e?.contact_phone) && (
                            <div className="ht-sub">Contact: {[e?.contact_name, e?.contact_email, e?.contact_phone].filter(Boolean).join(', ')}</div>
                          )}
                        </div>
                      </div>
                    </th>
                    {grouped && (
                      <td data-label="Group">
                        <select className="ht-group-select" value={p.group || ''} aria-label={`Group for ${p.name}`}
                          onChange={ev => updateTournamentParticipant(p.id, { group: ev.target.value || undefined })}>
                          {!p.group && <option value="">None</option>}
                          {groupLetters.map(l => <option key={l} value={l}>Group {l}</option>)}
                        </select>
                      </td>
                    )}
                      <td data-label="Seed (optional)">
                        <input type="number" inputMode="numeric" min={1} max={participants.length} className="ht-group-select ht-seed-input"
                          value={p.seed ?? ''} placeholder="None" aria-label={`Seed for ${p.name} (optional)`}
                          onChange={ev => { const n = parseInt(ev.target.value, 10); updateTournamentParticipant(p.id, { seed: n > 0 ? n : undefined }); }} />
                      </td>
                    {!isEvent && <td data-label="Entry">{guest ? <span className="ht-state" data-tone={status.tone}>{e?.status === 'submitted' && !e.submitted_at ? 'Entered by you' : status.label}</span> : <span className="ht-sub">Club squad</span>}</td>}
                    {!isEvent && (
                      <td data-label="Players">
                        {guest ? (
                          <button type="button" className="ht-link-btn" onClick={() => setSquadOf(p)} data-view-ok>
                            {players.length || desk ? <Users size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                            {desk ? `${players.filter(x => x.present).length} of ${players.length} here` : players.length ? `${players.length} player${players.length === 1 ? '' : 's'}` : 'Add players'}
                          </button>
                        ) : <span className="ht-sub">From Tournament sides</span>}
                      </td>
                    )}
                    {!isEvent && fee > 0 && (
                      <td data-label="Entry fee">
                        {!guest ? <span className="ht-sub">No fee</span>
                          : !e?.payment_id ? <span className="ht-state" data-tone="muted">Not added</span>
                          : (
                            <span className="ht-fee">
                              <span className="ht-state" data-tone={billInfo?.status === 'paid' ? 'ok' : billInfo?.status === 'awaiting_review' ? 'warn' : billInfo ? 'due' : 'muted'}>
                                {billInfo?.status === 'paid' ? 'Paid' : billInfo?.status === 'awaiting_review' ? 'Receipt to check' : billInfo ? `Owes ${money(billInfo.amount_cents, billInfo.currency)}` : 'Billed'}
                              </span>
                              {billInfo && billInfo.status !== 'paid' && (
                                <button type="button" className="ht-link-btn" disabled={!!busy}
                                  onClick={() => run(`paid-${p.id}`, async () => {
                                    if (!(await confirmAction({ title: `Mark ${p.name}'s entry fee paid?`, message: 'Do this once their bank transfer is in the club\'s account.', confirmLabel: 'Mark paid' }))) return;
                                    const err = await hosted.markPaid(club.id, e.payment_id!);
                                    onFeedback(err ? 'error' : 'success', err || `${p.name}'s entry fee is marked paid.`);
                                  })}>
                                  Mark paid
                                </button>
                              )}
                            </span>
                          )}
                      </td>
                    )}
                    {desk && !isEvent && (
                      <td data-label="Arrived">
                        <button type="button" className={`btn btn-sm ${here ? 'btn-secondary' : 'btn-primary'}`} style={btn} aria-pressed={here} data-view-ok
                          onClick={async () => { const err = await hosted.setCheckedIn(p.id, !here); if (err) onFeedback('error', err); }}>
                          <Check size={14} aria-hidden="true" /><span>{here ? 'Here' : 'Check in'}</span>
                        </button>
                      </td>
                    )}
                    <td className="ht-row-actions">
                      {guest && !isEvent && (
                        <>
                          <button type="button" className="btn btn-sm btn-secondary" style={btn} disabled={busy === `copy-${p.id}`} onClick={() => copyLink(p)}>
                            {copied === p.id ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                            <span>{copied === p.id ? 'Copied' : e?.entry_key ? 'Copy link' : 'Make link'}</span>
                          </button>
                          {e?.contact_email ? (
                            <button type="button" className="btn btn-sm btn-secondary" style={btn} disabled={!!busy} onClick={() => emailLink(p, e.contact_email!)}>
                              {busy === `email-${p.id}` ? <Loader2 size={14} aria-hidden="true" className="spin" /> : <Mail size={14} aria-hidden="true" />}
                              <span>{busy === `email-${p.id}` ? 'Sending…' : 'Email link'}</span>
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-secondary" style={btn} onClick={() => setEditing(p)}
                              title="Their entry link is emailed to the contact. Add an email to send it.">
                              <Mail size={14} aria-hidden="true" /><span>Add email</span>
                            </button>
                          )}
                        </>
                      )}
                      <button type="button" className="ht-icon-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} title="Edit">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="ht-icon-btn is-danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`} title="Remove">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                      {rowNote?.id === p.id && (
                        <p className="ht-row-note" data-tone={rowNote.tone} role={rowNote.tone === 'error' ? 'alert' : 'status'}>
                          {rowNote.tone === 'error' ? <AlertTriangle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                          <span>{rowNote.text}</span>
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="ht-hint">Seeds are optional. They keep the top teams apart in the draw, so seeds 1 and 2 start in different groups. Leave them blank and the draw is random. Seeds only show here, never on the public page.</p>
        </div>
      )}
      {!participants.length && <p className="ht-empty">No teams yet. Add the clubs coming to your tournament, then generate the tiesheet.</p>}

      {editing && (
        <TeamEditor
          club={club}
          tournament={tournament}
          team={editing === 'new' ? null : editing}
          entry={editing === 'new' ? undefined : entryOf(editing.id)}
          isEvent={isEvent}
          taken={participants.filter(p => editing === 'new' || p.id !== editing.id).map(p => p.name.toLowerCase())}
          canLink={linking.ready}
          link={editing === 'new' ? undefined : linking.linkOf(editing.id)}
          onClose={() => setEditing(null)}
          onSave={async (fields, contact, pick) => {
            if (editing === 'new') {
              const created = addTournamentParticipant({ tournament_id: tournament.id, team_type: 'external', ...fields });
              if (pick) {
                saveAfterTeam(async () => {
                  const err = await saveLink(created.id, pick);
                  if (err) onFeedback('error', `Added ${fields.name}, but not linked to ${pick.club_name}: ${err}`);
                  linking.reload();
                });
              }
              if (!isEvent && (Object.values(contact).some(Boolean))) {
                saveAfterTeam(async () => {
                  const err = await hosted.saveEntry(created.id, contact);
                  if (err) onFeedback('error', `Contact not saved: ${err}. Open Edit to add it again.`);
                });
              }
              onFeedback('success', `Added ${fields.name}${pick ? `, linked to ${pick.club_name}. They get an invitation to accept` : ''}. Generate the tiesheet again to put them in the draw.`);
            } else {
              updateTournamentParticipant(editing.id, fields);
              if (pick !== undefined) {
                const err = pick ? await saveLink(editing.id, pick) : await removeLink(editing.id);
                linking.reload();
                if (err) return onFeedback('error', `Saved the team, but not the link: ${err}`);
              }
              if (!isEvent && editing.team_type === 'external') {
                const err = await hosted.saveEntry(editing.id, contact);
                if (err) return onFeedback('error', `Saved the team, but not the contact: ${err}`);
              }
              onFeedback('success', `Saved ${fields.name}.`);
            }
            setEditing(null);
          }}
        />
      )}

      {bulkOpen && (
        <BulkAdd
          taken={participants.map(p => p.name.toLowerCase())}
          onClose={() => setBulkOpen(false)}
          onAdd={list => {
            const created = list.map((t, i) => ({
              team: addTournamentParticipant({ tournament_id: tournament.id, team_type: 'external', name: t.name, short_name: shortCode(t.name), logo_url: DEFAULT_CREST }),
              email: t.email,
            }));
            const withEmail = created.filter(c => c.email);
            if (!isEvent && withEmail.length) {
              saveAfterTeam(async () => { for (const c of withEmail) await hosted.saveEntry(c.team.id, { contact_email: c.email }); });
            }
            setBulkOpen(false);
            onFeedback('success', `Added ${list.length} club${list.length === 1 ? '' : 's'}. Open Edit on each to add its crest and colours, or send them their link to do it themselves.`);
          }}
        />
      )}

      {squadOf && (
        <SquadPopup
          team={squadOf}
          players={playersOf(squadOf.id)}
          entry={entryOf(squadOf.id)}
          desk={desk}
          juniorTournament={!!tournament.is_junior}
          maxSquad={tournament.max_squad}
          onPresent={hosted.setPresent}
          onSave={async (list, done) => {
            const id = squadOf.id;
            await saveNow(); // a team added a moment ago must be in the database first
            const err = await hosted.saveSquad(id, list);
            if (err) return err;
            const e = entryOf(id);
            const status = done ? 'submitted' : list.length ? 'in_progress' : 'not_started';
            if (!e || e.status !== status) {
              const statusErr = await hosted.saveEntry(id, { status });
              if (statusErr) return `Players saved, but not the entry state: ${statusErr}`;
            }
            onFeedback('success', `Saved ${list.length} player${list.length === 1 ? '' : 's'} for ${squadOf.name}.`);
            return null;
          }}
          onClose={() => setSquadOf(null)}
          link={linkFor(entryOf(squadOf.id))}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------

export type TeamFields = Pick<TournamentParticipant, 'name' | 'short_name' | 'logo_url' | 'color' | 'secondary_color' | 'manager_name' | 'coach_name'>;
export type ContactFields = Pick<TournamentEntry, 'contact_name' | 'contact_email' | 'contact_phone' | 'assistant_name' | 'first_aid_name'>;

function Shell({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="ht-scrim" onClick={onClose}>
      <PopupPanel onClose={onClose} label={label} className="ht-dialog" style={{ maxWidth: wide ? 640 : 560 }} onClick={e => e.stopPropagation()}>
        <div className="ht-dialog-head">
          <h3>{label}</h3>
          <button type="button" className="ht-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </PopupPanel>
    </div>
  );
}

/** Add or edit one team. Also used by the tournament setup form, before the tournament exists (no tournament: no contact box) */
export function TeamEditor({ club, tournament, team, entry, isEvent, taken, canLink, link, onClose, onSave }: {
  club: Club;
  tournament?: Tournament;
  team: Pick<TournamentParticipant, 'name' | 'short_name' | 'logo_url' | 'color' | 'secondary_color' | 'manager_name' | 'coach_name' | 'team_type'> | null;
  entry?: Partial<ContactFields>;
  isEvent: boolean;
  taken: string[];
  /** The tournament_club_links table exists (migration 20261197): offer "Find a club on itsfootball.club" */
  canLink?: boolean;
  /** This team's link to a club on the platform, when editing one */
  link?: TournamentLink;
  onClose: () => void;
  /** pick: the club it's linked to (undefined: no change, null: unlink) */
  onSave: (fields: TeamFields, contact: ContactFields, pick?: LinkPick | null) => void;
}) {
  // A new team is only in the fixtures once the draw is made again
  const drawn = useClub().matches.some(m => m.tournament_id === tournament?.id);
  const [name, setName] = useState(team?.name ?? '');
  const [code, setCode] = useState(team?.short_name ?? '');
  const [logo, setLogo] = useState(team?.logo_url && team.logo_url !== DEFAULT_CREST ? team.logo_url : '');
  const [c1, setC1] = useState(hexOr(team?.color, '#2563EB'));
  const [c2, setC2] = useState(hexOr(team?.secondary_color, '#FFFFFF'));
  const [manager, setManager] = useState(team?.manager_name ?? '');
  const [coach, setCoach] = useState(team?.coach_name ?? '');
  const [contactName, setContactName] = useState(entry?.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(entry?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(entry?.contact_phone ?? '');
  const [assistant, setAssistant] = useState(entry?.assistant_name ?? '');
  const [firstAid, setFirstAid] = useState(entry?.first_aid_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const guest = !team || team.team_type === 'external';
  // Linking a club already on the platform: search, then its team; crest and colours are copied and can be changed
  const [mode, setMode] = useState<'find' | 'type'>(!team && canLink ? 'find' : 'type');
  const [found, setFound] = useState<FoundClub | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [show, setShow] = useState(link?.show_on_linked_site ?? true);
  const [unlink, setUnlink] = useState(false);
  const [changeLook, setChangeLook] = useState(false);
  const pickClub = (c: FoundClub, tId = c.teams[0]?.id || '') => {
    const t = c.teams.find(x => x.id === tId);
    const n = ourSide(c.name, c.teams.length > 1 ? t?.name : null);
    setFound(c); setTeamId(tId); setName(n); setCode(shortCode(n));
    setLogo(t?.logo_url || c.logo_url || '');
    setC1(hexOr(c.primary_color, hexOr(t?.color, '#2563EB'))); setC2(hexOr(c.secondary_color, '#FFFFFF'));
    setError(null);
  };
  const finding = mode === 'find' && !team;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return setError('Give the team a name.');
    if (taken.includes(n.toLowerCase())) return setError(`"${n}" is already in this tournament. Team names must be unique.`);
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError('That email address doesn\'t look right.');
    if (finding && !found) return setError('Pick a club from the search, or use Type it in.');
    const pick = finding && found ? { club_id: found.id, club_name: found.name, team_id: teamId || null, show }
      : link ? (unlink ? null : { club_id: link.linked_club_id, club_name: link.linked?.name || '', team_id: link.linked_team_id, show })
      : undefined;
    onSave(
      { name: n, short_name: (code.trim() || shortCode(n)).slice(0, 16).toUpperCase(), logo_url: logo || DEFAULT_CREST, color: c1, secondary_color: c2, manager_name: manager.trim() || null, coach_name: coach.trim() || null },
      { contact_name: contactName.trim() || null, contact_email: contactEmail.trim().toLowerCase() || null, contact_phone: contactPhone.trim() || null, assistant_name: assistant.trim() || null, first_aid_name: firstAid.trim() || null },
      pick,
    );
  };

  return (
    <Shell label={team ? `Edit ${team.name}` : found ? `Link ${found.name}` : 'Add a club'} onClose={onClose} wide>
      <form onSubmit={submit} className="ht-form">
        {!team && canLink && (
          <div className="ht-seg" role="group" aria-label="How to add the club">
            <button type="button" aria-pressed={mode === 'find'} onClick={() => setMode('find')}>Find a club on itsfootball.club</button>
            <button type="button" aria-pressed={mode === 'type'} onClick={() => { setMode('type'); setFound(null); }}>Type it in</button>
          </div>
        )}
        {finding && !found && <ClubSearch hostClubId={club.id} taken={taken} onPick={c => pickClub(c)} />}
        {finding && found && (
          <div className="ht-linked">
            <Crest team={{ logo_url: logo || DEFAULT_CREST, color: c1, secondary_color: c2 }} size={46} />
            <div className="min-w-0">
              <div className="ht-name">{found.name}</div>
              <div className="ht-sub">{changeLook ? 'Using your own crest and colours for this tournament' : 'Crest and colours copied from their club profile'}</div>
            </div>
            <div className="ht-linked-acts">
              {!changeLook && <button type="button" className="btn btn-sm btn-secondary" style={btn} onClick={() => setChangeLook(true)}><Pencil size={14} aria-hidden="true" /><span>Change</span></button>}
              <button type="button" className="ht-link-btn" onClick={() => { setFound(null); setChangeLook(false); setName(''); setCode(''); setLogo(''); }}>Pick another club</button>
            </div>
          </div>
        )}
        {link && (
          <div className="ht-linked">
            <Link2 size={18} aria-hidden="true" />
            <div className="min-w-0">
              <div className="ht-name">{unlink ? 'Will be unlinked when you save' : `Linked to ${link.linked?.name || 'a club on itsfootball.club'}`}</div>
              <div className="ht-sub">{unlink ? 'The team stays in your tournament as a typed-in team.' : LINK_STATUS[link.status].label}</div>
            </div>
            <div className="ht-linked-acts">
              <button type="button" className="ht-link-btn" onClick={() => setUnlink(u => !u)} style={btn}>
                {unlink ? 'Keep the link' : <><Unlink size={14} aria-hidden="true" /> Unlink</>}
              </button>
            </div>
          </div>
        )}
        {(!finding || found) && (<>
        {team && name.trim() !== team.name && (
          <p className="ht-hint"><AlertTriangle size={14} aria-hidden="true" /> The new name also shows on {team.name}&rsquo;s fixtures.</p>
        )}
        {finding && found && found.teams.length > 1 && (
          <div className="form-group">
            <label className="form-label" htmlFor="ht-which">Which of their teams</label>
            <select id="ht-which" className="form-input" value={teamId} onChange={e => pickClub(found, e.target.value)}>
              {found.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="ht-two">
          <div className="form-group">
            <label className="form-label" htmlFor="ht-name">{found ? 'Name in this tournament' : 'Club or team name'}</label>
            <input id="ht-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bayside United U11" maxLength={128} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ht-code">Short code</label>
            <input id="ht-code" className="form-input" value={code} onChange={e => setCode(e.target.value)} placeholder={shortCode(name || 'Bayside United')} maxLength={16} />
          </div>
        </div>

        {(!found || changeLook) && (<>
        <ImageUploadZone clubId={club.id} folder="tournaments" aspectRatio="1:1" label="Crest" recommendedText="Square PNG with a see-through background looks best"
          currentImageUrl={logo || undefined} onUploadComplete={setLogo} />

        <div className="ht-two">
          <div className="form-group">
            <label className="form-label" htmlFor="ht-c1">Main kit colour</label>
            <span className="ht-colour"><input id="ht-c1" type="color" value={c1} onChange={e => setC1(e.target.value.toUpperCase())} /><span>{c1}</span></span>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ht-c2">Second colour</label>
            <span className="ht-colour"><input id="ht-c2" type="color" value={c2} onChange={e => setC2(e.target.value.toUpperCase())} /><span>{c2}</span></span>
          </div>
        </div>
        </>)}

        <div className="ht-two">
          <div className="form-group">
            <label className="form-label" htmlFor="ht-manager">Team manager</label>
            <input id="ht-manager" className="form-input" value={manager} onChange={e => setManager(e.target.value)} maxLength={128} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ht-coach">Coach</label>
            <input id="ht-coach" className="form-input" value={coach} onChange={e => setCoach(e.target.value)} maxLength={128} />
          </div>
        </div>

        {guest && !isEvent && (
          <fieldset className="ht-fieldset">
            <legend>Contact at the club <small>Private: only your Tournaments staff see this</small></legend>
            <div className="ht-two">
              <div className="form-group">
                <label className="form-label" htmlFor="ht-cname">Name</label>
                <input id="ht-cname" className="form-input" value={contactName} onChange={e => setContactName(e.target.value)} maxLength={128} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ht-cphone">Phone</label>
                <input id="ht-cphone" className="form-input" type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} maxLength={40} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ht-cemail">Email (their entry link goes here)</label>
              <input id="ht-cemail" className="form-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} maxLength={254} />
            </div>
            <div className="ht-two">
              <div className="form-group">
                <label className="form-label" htmlFor="ht-assistant">Assistant</label>
                <input id="ht-assistant" className="form-input" value={assistant} onChange={e => setAssistant(e.target.value)} maxLength={128} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ht-firstaid">First aid</label>
                <input id="ht-firstaid" className="form-input" value={firstAid} onChange={e => setFirstAid(e.target.value)} maxLength={128} />
              </div>
            </div>
          </fieldset>
        )}
        {((finding && found) || (link && !unlink)) && (
          <label className="ht-linked is-check">
            <input type="checkbox" className="ht-check" checked={show} onChange={e => setShow(e.target.checked)} />
            <span>
              <span className="ht-name">Show these games on {(found || link?.linked)?.name || 'their'}&rsquo;s site too</span>
              <span className="ht-sub">They always show on your site. With this on, they also go in {(found || link?.linked)?.name || 'their'}&rsquo;s Fixtures and Results once they accept.</span>
            </span>
          </label>
        )}
        {finding && found && <p className="ht-hint"><Mail size={14} aria-hidden="true" /> <span>{found.name}&rsquo;s admins get an invitation on their dashboard to accept or decline.</span></p>}
        </>)}
        {!team && tournament && drawn && <p className="ht-hint"><RefreshCw size={14} aria-hidden="true" /> Generate the tiesheet again afterwards to put them in the draw.</p>}
        {error && <p role="alert" className="ht-error">{error}</p>}
        <div className="ht-foot">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={finding && !found}>{team ? 'Save team' : found ? 'Link club' : 'Add club'}</button>
        </div>
      </form>
    </Shell>
  );
}

const LINK_STATUS: Record<TournamentLink['status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting for them to accept', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'ok' },
  declined: { label: 'Declined: shows as a typed-in team', tone: 'muted' },
};

/** Clubs already on itsfootball.club, found by name */
function ClubSearch({ hostClubId, taken, onPick }: { hostClubId: string; taken: string[]; onPick: (c: FoundClub) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<FoundClub[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setList(null); return; }
    let stale = false;
    const id = setTimeout(() => { findClubs(q, hostClubId).then(r => { if (!stale) setList(r); }); }, 250);
    return () => { stale = true; clearTimeout(id); };
  }, [q, hostClubId]);
  return (
    <div>
      <div className="form-group ht-search">
        <label className="form-label" htmlFor="ht-find">Club name</label>
        <Search size={16} aria-hidden="true" />
        <input id="ht-find" className="form-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Start typing, e.g. ANCC" autoComplete="off" autoFocus />
      </div>
      {list && (
        <ul className="ht-found" aria-live="polite">
          {list.map(c => {
            const inAlready = taken.includes(c.name.toLowerCase());
            return (
              <li key={c.id}>
                <Crest team={{ logo_url: c.logo_url || DEFAULT_CREST, color: c.primary_color ?? undefined, secondary_color: c.secondary_color }} size={38} />
                <div className="min-w-0">
                  <div className="ht-name">{c.name}</div>
                  <div className="ht-sub">{c.teams.length > 1 ? `${c.teams.length} teams` : 'itsfootball.club/' + c.slug}</div>
                </div>
                <button type="button" className="btn btn-sm btn-secondary" style={btn} onClick={() => onPick(c)} disabled={inAlready} title={inAlready ? 'Already in this tournament' : undefined}>
                  <Link2 size={14} aria-hidden="true" /><span>{inAlready ? 'Added' : 'Link'}</span>
                </button>
              </li>
            );
          })}
          {!list.length && <li className="ht-sub">No club by that name on itsfootball.club. Use Type it in.</li>}
        </ul>
      )}
    </div>
  );
}

function BulkAdd({ taken, onClose, onAdd }: { taken: string[]; onClose: () => void; onAdd: (list: { name: string; email: string | null }[]) => void }) {
  const [text, setText] = useState('');
  const list = parseTeamList(text);
  const fresh = list.filter(t => !taken.includes(t.name.toLowerCase()));
  const dupes = list.length - fresh.length;
  return (
    <Shell label="Add several clubs" onClose={onClose}>
      <p className="ht-lede">One club per line. Add their contact email after a comma to send them their entry link later. Pasting from a spreadsheet works too.</p>
      <textarea className="form-input" rows={8} value={text} onChange={e => setText(e.target.value)} aria-label="Clubs, one per line"
        placeholder={'Bayside United U11, coach@bayside.com.au\nRiverside Rovers U11, sec@rovers.org.au\nNorthside FC U11'} />
      <p className="ht-hint">{fresh.length ? `${fresh.length} club${fresh.length === 1 ? '' : 's'} to add` : 'Nothing to add yet'}{dupes ? `, ${dupes} already in the tournament` : ''}.</p>
      <div className="ht-foot">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!fresh.length} onClick={() => onAdd(fresh)}>Add {fresh.length || ''} club{fresh.length === 1 ? '' : 's'}</button>
      </div>
    </Shell>
  );
}

function SquadPopup({ team, players, entry, desk, juniorTournament, maxSquad, onPresent, onSave, onClose, link }: {
  team: TournamentParticipant;
  players: ReturnType<typeof useTournamentEntries>['squads'];
  entry?: TournamentEntry;
  desk: boolean;
  juniorTournament: boolean;
  maxSquad: number | null | undefined;
  onPresent: (id: string, present: boolean) => void;
  /** Saves the list; returns an error message or null */
  onSave: (list: (EntryPlayer & { id?: string })[], done: boolean) => Promise<string | null>;
  onClose: () => void;
  link: string | null;
}) {
  const here = players.filter(p => p.present).length;
  const max = maxSquad && maxSquad > 0 ? maxSquad : 40;
  const [list, setList] = useState<(EntryPlayer & { id?: string })[]>(() =>
    players.map(p => ({ id: p.id, name: p.name, shirt_number: p.shirt_number, position: p.position, is_junior: !!p.is_junior, hide_public: !!p.hide_public })));
  const [paste, setPaste] = useState<string | null>(null);
  const [done, setDone] = useState(entry?.status === 'submitted');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, patch: Partial<EntryPlayer>) => { setError(null); setList(l => l.map((p, j) => (j === i ? { ...p, ...patch } : p))); };
  const named = list.filter(p => p.name.trim());
  const counts = [...ENTRY_POSITIONS.map(x => [x, named.filter(p => p.position === x).length] as const), ['not set', named.filter(p => !p.position).length] as const]
    .filter(([, n]) => n).map(([x, n]) => `${n} ${x}`).join(', ');

  const save = async () => {
    // Same checks as the club's own entry link (numbers 0 to 99, no shared number, squad size)
    const parsed = parseEntry({ players: list }, maxSquad);
    if (!parsed.ok) return setError(parsed.error);
    const ids = list.filter(p => p.name.trim()).map(p => p.id);
    setSaving(true);
    const err = await onSave(parsed.value.players.map((p, i) => ({ ...p, id: ids[i] })), done);
    setSaving(false);
    if (err) setError(err); else onClose();
  };

  // On the day (check-in desk) the popup is for ticking who is here
  if (desk) {
    return (
      <Shell label={`${team.name}: players`} onClose={onClose}>
        <div className="ht-squad-head">
          <Crest team={team} size={34} />
          <span>{players.length ? `${players.length} player${players.length === 1 ? '' : 's'}, ${here} here` : 'No players entered yet.'}</span>
        </div>
        {players.length > 0 && (
          <table className="ht-table ht-sheet">
            <caption className="sr-only">{team.name} players</caption>
            <thead>
              <tr>
                <th scope="col">Here</th>
                <th scope="col" className="ht-num-col">No.</th>
                <th scope="col">Name</th>
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td><input type="checkbox" className="ht-check" checked={!!p.present} onChange={e => onPresent(p.id, e.target.checked)} aria-label={`${p.name} is here`} /></td>
                  <td className="ht-num-col">{p.shirt_number ?? ''}</td>
                  <th scope="row">{p.name}</th>
                  <td>{p.position || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="ht-foot"><button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button></div>
      </Shell>
    );
  }

  return (
    <Shell label={`${team.name}: players`} onClose={onClose} wide>
      <div className="ht-squad-head">
        <Crest team={team} size={34} />
        <span>{named.length ? `${named.length}${maxSquad ? ` of ${maxSquad}` : ''} player${named.length === 1 ? '' : 's'}. ${counts}` : 'No players yet. Add them here, or send the club its link.'}</span>
      </div>
      {(entry?.assistant_name || entry?.first_aid_name) && (
        <dl className="ht-staff">
          {entry.assistant_name && <><dt>Assistant</dt><dd>{entry.assistant_name}</dd></>}
          {entry.first_aid_name && <><dt>First aid</dt><dd>{entry.first_aid_name}</dd></>}
        </dl>
      )}
      <p className="ht-hint" style={{ marginBottom: '0.6rem' }}>
        {juniorTournament ? 'Junior tournament: public pages show first names and last initials only.' : 'Tick Junior for a player under 18: public pages then show first name and last initial.'} Hide keeps a player off public pages.
      </p>
      {list.length > 0 && (
        <div className="te-sheet" role="table" aria-label={`${team.name} players`}>
          <div className="te-sheet-head" role="row">
            <span role="columnheader">No.</span>
            <span role="columnheader">Name</span>
            <span role="columnheader">Position</span>
            <span role="columnheader">Public page</span>
            <span role="columnheader"><span className="sr-only">Remove</span></span>
          </div>
          <ul className="te-players">
            {list.map((p, i) => (
              <li key={p.id || `new-${i}`} role="row">
                <input className="form-input te-num" inputMode="numeric" aria-label={`Shirt number, player ${i + 1}`} placeholder="#" value={p.shirt_number ?? ''}
                  onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); set(i, { shirt_number: v === '' ? null : Number(v) }); }} />
                <input className="form-input te-pname" aria-label={`Name, player ${i + 1}`} placeholder="Full name" value={p.name} maxLength={80} onChange={e => set(i, { name: e.target.value })} />
                <select className="form-select te-pos" aria-label={`Position, player ${i + 1}`} value={p.position || ''} onChange={e => set(i, { position: e.target.value || null })}>
                  <option value="">Position</option>
                  {ENTRY_POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <span className="te-ticks">
                  {!juniorTournament && <label className="te-tick"><input type="checkbox" checked={p.is_junior} onChange={e => set(i, { is_junior: e.target.checked })} /> Junior</label>}
                  <label className="te-tick"><input type="checkbox" checked={p.hide_public} onChange={e => set(i, { hide_public: e.target.checked })} /> Hide</label>
                </span>
                <button type="button" className="te-remove" aria-label={`Remove ${p.name || `player ${i + 1}`}`} onClick={() => setList(l => l.filter((_, j) => j !== i))}><Trash2 size={15} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {paste !== null ? (
        <div className="te-paste" style={{ marginTop: '0.6rem' }}>
          <textarea className="form-input" rows={6} value={paste} onChange={e => setPaste(e.target.value)} aria-label="Players, one per line" placeholder={'7 Sam Patel\n10 Leo Brooks\nAri Haddad'} />
          <div className="te-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setList(l => [...l, ...parsePlayers(paste)].slice(0, max)); setPaste(null); }}>Add {parsePlayers(paste).length || ''} players</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaste(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="te-row" style={{ marginTop: '0.6rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" style={btn} disabled={list.length >= max} onClick={() => setList(l => [...l, { name: '', shirt_number: null, position: null, is_junior: false, hide_public: false }])}>
            <Plus size={14} aria-hidden="true" /><span>Add a player</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={list.length >= max} onClick={() => setPaste('')}>Paste a list</button>
        </div>
      )}
      <label className="ht-linked is-check" style={{ marginTop: '0.9rem' }}>
        <input type="checkbox" className="ht-check" checked={done} onChange={e => setDone(e.target.checked)} />
        <span>
          <span className="ht-name">Mark their entry as done</span>
          <span className="ht-sub">{entry?.submitted_at ? 'They already sent their entry.' : 'The Entry column says "Entered by you" and they get no reminder emails.'} They can still make changes on their link.</span>
        </span>
      </label>
      {error && <p className="ht-hint" role="alert" style={{ color: 'var(--c-red)' }}><AlertTriangle size={14} aria-hidden="true" />{error}</p>}
      <div className="ht-foot">
        {link && (
          <button type="button" className="btn btn-secondary btn-sm" style={btn} onClick={() => navigator.clipboard?.writeText(link)}>
            <Copy size={14} aria-hidden="true" /><span>Copy their link</span>
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" style={btn} disabled={saving} onClick={save}>
          <Check size={14} aria-hidden="true" /><span>{saving ? 'Saving...' : 'Save players'}</span>
        </button>
      </div>
    </Shell>
  );
}
