'use client';

// The Teams tab of a hosted tournament (plan 18 Nov 2026): guest clubs with their crest, colours,
// staff and contact; each team's private entry link; entry fees; the check-in desk on the day; kit
// clashes. Shown once migration 20261180 has run (the old list shows before it).

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, Link2, Copy, Check, Mail, Users, CreditCard, ClipboardCheck, Send, AlertTriangle, Info, X, RefreshCw, Shirt,
} from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { DEFAULT_CREST, crestOnError } from '@/lib/crest';
import { confirmAction } from '@/components/ConfirmDialog';
import ImageUploadZone from '@/components/ImageUploadZone';
import PopupPanel from '@/components/PopupPanel';
import { GROUP_LETTERS, effectiveGroupRules } from '@/lib/tournament-engine';
import { kitClashes, money, parseTeamList, shortCode, kickoffLabel } from '@/lib/hosted-tournaments';
import { useTournamentEntries } from '@/lib/use-tournament-entries';
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
  const { addTournamentParticipant, updateTournamentParticipant, deleteTournamentParticipant, saveNow } = useClub();
  const hosted = useTournamentEntries(tournament.id, !isEvent);
  const [editing, setEditing] = useState<TournamentParticipant | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [squadOf, setSquadOf] = useState<TournamentParticipant | null>(null);
  const [desk, setDesk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const bill = () => run('bill', async () => {
    const res = await hosted.act(club.id, 'bill');
    if (!res.ok) return onFeedback('error', res.error || 'Could not add the entry fees.');
    onFeedback('success', res.billed ? `Entry fee added for ${res.billed} team${res.billed === 1 ? '' : 's'}. They can pay from their entry link.` : 'Every guest team already has its entry fee.');
  });

  const remove = async (p: TournamentParticipant) => {
    const played = matches.some(m => m.status !== 'upcoming' && (m.home_team_name === p.name || m.away_team_name === p.name));
    if (!(await confirmAction({
      title: `Remove ${p.name}?`,
      message: `Their entry, players and link go too.${played ? ' They have played already: generate the tiesheet again afterwards to redo the draw.' : ' Generate the tiesheet again to redo the draw without them.'}`,
      confirmLabel: 'Remove team', danger: true,
    }))) return;
    deleteTournamentParticipant(p.id);
    onFeedback('success', `Removed ${p.name}. Generate the tiesheet again to redo the draw.`);
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
                const staff = [p.manager_name && `Manager ${p.manager_name}`, p.coach_name && `coach ${p.coach_name}`].filter(Boolean).join(', ');
                return (
                  <tr key={p.id} data-here={desk && here ? 'true' : undefined}>
                    <th scope="row">
                      <div className="ht-team-cell">
                        <Crest team={p} size={36} />
                        <div className="min-w-0">
                          <div className="ht-name">{p.name}</div>
                          <div className="ht-sub">
                            {guest ? 'Guest club' : 'Our team'}{staff ? `. ${staff}` : ''}
                          </div>
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
                    {!isEvent && <td data-label="Entry">{guest ? <span className="ht-state" data-tone={status.tone}>{status.label}</span> : <span className="ht-sub">Club squad</span>}</td>}
                    {!isEvent && (
                      <td data-label="Players">
                        {guest ? (
                          <button type="button" className="ht-link-btn" onClick={() => setSquadOf(p)} data-view-ok>
                            <Users size={14} aria-hidden="true" />
                            {desk ? `${players.filter(x => x.present).length} of ${players.length} here` : `${players.length} player${players.length === 1 ? '' : 's'}`}
                          </button>
                        ) : <span className="ht-sub">From Club teams</span>}
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
                          <button type="button" className="ht-icon-btn" disabled={!!busy} onClick={() => email('invite', [p.id])}
                            aria-label={`Email the link to ${p.name}`} title={e?.contact_email ? `Email the link to ${e.contact_email}` : 'Add their contact email first'}>
                            <Mail size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <button type="button" className="ht-icon-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`} title="Edit">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button type="button" className="ht-icon-btn is-danger" onClick={() => remove(p)} aria-label={`Remove ${p.name}`} title="Remove">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          onClose={() => setEditing(null)}
          onSave={async (fields, contact) => {
            if (editing === 'new') {
              const created = addTournamentParticipant({ tournament_id: tournament.id, team_type: 'external', seed: participants.length + 1, ...fields });
              if (!isEvent && (contact.contact_name || contact.contact_email || contact.contact_phone)) {
                saveAfterTeam(async () => {
                  const err = await hosted.saveEntry(created.id, contact);
                  if (err) onFeedback('error', `Contact not saved: ${err}. Open Edit to add it again.`);
                });
              }
              onFeedback('success', `Added ${fields.name}. Generate the tiesheet again to put them in the draw.`);
            } else {
              updateTournamentParticipant(editing.id, fields);
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
              team: addTournamentParticipant({ tournament_id: tournament.id, team_type: 'external', name: t.name, short_name: shortCode(t.name), logo_url: DEFAULT_CREST, color: '#2563EB', seed: participants.length + i + 1 }),
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
          onPresent={hosted.setPresent}
          onClose={() => setSquadOf(null)}
          link={linkFor(entryOf(squadOf.id))}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------

type TeamFields = Pick<TournamentParticipant, 'name' | 'short_name' | 'logo_url' | 'color' | 'secondary_color' | 'manager_name' | 'coach_name'>;
type ContactFields = Pick<TournamentEntry, 'contact_name' | 'contact_email' | 'contact_phone'>;

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

function TeamEditor({ club, tournament, team, entry, isEvent, taken, onClose, onSave }: {
  club: Club;
  tournament: Tournament;
  team: TournamentParticipant | null;
  entry?: TournamentEntry;
  isEvent: boolean;
  taken: string[];
  onClose: () => void;
  onSave: (fields: TeamFields, contact: ContactFields) => void;
}) {
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
  const [error, setError] = useState<string | null>(null);
  const guest = !team || team.team_type === 'external';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return setError('Give the team a name.');
    if (taken.includes(n.toLowerCase())) return setError(`"${n}" is already in this tournament. Team names must be unique.`);
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError('That email address doesn\'t look right.');
    onSave(
      { name: n, short_name: (code.trim() || shortCode(n)).slice(0, 16).toUpperCase(), logo_url: logo || DEFAULT_CREST, color: c1, secondary_color: c2, manager_name: manager.trim() || null, coach_name: coach.trim() || null },
      { contact_name: contactName.trim() || null, contact_email: contactEmail.trim().toLowerCase() || null, contact_phone: contactPhone.trim() || null },
    );
  };

  return (
    <Shell label={team ? `Edit ${team.name}` : 'Add a club'} onClose={onClose} wide>
      <form onSubmit={submit} className="ht-form">
        {team && name.trim() !== team.name && (
          <p className="ht-hint"><AlertTriangle size={14} aria-hidden="true" /> The new name also shows on {team.name}&rsquo;s fixtures.</p>
        )}
        <div className="ht-two">
          <div className="form-group">
            <label className="form-label" htmlFor="ht-name">Club or team name</label>
            <input id="ht-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bayside United U11" maxLength={128} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ht-code">Short code</label>
            <input id="ht-code" className="form-input" value={code} onChange={e => setCode(e.target.value)} placeholder={shortCode(name || 'Bayside United')} maxLength={16} />
          </div>
        </div>

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
          </fieldset>
        )}
        {!team && tournament.status !== 'draft' && <p className="ht-hint"><RefreshCw size={14} aria-hidden="true" /> Generate the tiesheet again afterwards to put them in the draw.</p>}
        {error && <p role="alert" className="ht-error">{error}</p>}
        <div className="ht-foot">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm">{team ? 'Save team' : 'Add club'}</button>
        </div>
      </form>
    </Shell>
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

function SquadPopup({ team, players, entry, desk, juniorTournament, onPresent, onClose, link }: {
  team: TournamentParticipant;
  players: ReturnType<typeof useTournamentEntries>['squads'];
  entry?: TournamentEntry;
  desk: boolean;
  juniorTournament: boolean;
  onPresent: (id: string, present: boolean) => void;
  onClose: () => void;
  link: string | null;
}) {
  const here = players.filter(p => p.present).length;
  return (
    <Shell label={`${team.name}: players`} onClose={onClose}>
      <div className="ht-squad-head">
        <Crest team={team} size={34} />
        <span>{players.length ? `${players.length} player${players.length === 1 ? '' : 's'}${desk ? `, ${here} here` : ''}` : 'No players entered yet.'}</span>
      </div>
      {(entry?.assistant_name || entry?.first_aid_name) && (
        <dl className="ht-staff">
          {entry.assistant_name && <><dt>Assistant</dt><dd>{entry.assistant_name}</dd></>}
          {entry.first_aid_name && <><dt>First aid</dt><dd>{entry.first_aid_name}</dd></>}
        </dl>
      )}
      {players.length > 0 && (
        <table className="ht-table ht-sheet">
          <caption className="sr-only">{team.name} players</caption>
          <thead>
            <tr>
              {desk && <th scope="col">Here</th>}
              <th scope="col" className="ht-num-col">No.</th>
              <th scope="col">Name</th>
              <th scope="col">Position</th>
              <th scope="col">Public page</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id}>
                {desk && <td><input type="checkbox" className="ht-check" checked={!!p.present} onChange={e => onPresent(p.id, e.target.checked)} aria-label={`${p.name} is here`} /></td>}
                <td className="ht-num-col">{p.shirt_number ?? ''}</td>
                <th scope="row">{p.name}</th>
                <td>{p.position || ''}</td>
                <td className="ht-sub">{p.hide_public ? 'Hidden' : (p.is_junior || juniorTournament) ? 'First name and initial' : 'Full name'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!players.length && link && (
        <p className="ht-hint">They add players from their entry link. <Link href={link} target="_blank">Open it</Link> to see what they see.</p>
      )}
      <div className="ht-foot">
        {link && (
          <button type="button" className="btn btn-secondary btn-sm" style={btn} onClick={() => navigator.clipboard?.writeText(link)}>
            <Copy size={14} aria-hidden="true" /><span>Copy their link</span>
          </button>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
      </div>
    </Shell>
  );
}
