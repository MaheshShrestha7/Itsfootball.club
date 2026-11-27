'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Plus } from 'lucide-react';
import { newItemHref } from '@/lib/admin-calendar';
import { KO_ROUNDS, roundName, type CupAsk, type KoStage } from '@/lib/cup-progress';
import { clubTeamsOf, teamLabel, teamOfMatch } from '@/lib/teams';
import type { Club, ClubEvent, ClubTeam } from '@/lib/supabase/types';

/** "the Seniors" when the club has several teams, else the club's name (as Mark as completed asks) */
export function cupTeamName(club: Pick<Club, 'id' | 'name' | 'short_name'>, clubTeams: ClubTeam[], ask: CupAsk): string {
  const t = teamOfMatch(ask.last, clubTeams);
  return clubTeamsOf(clubTeams, club.id).length > 1 && t ? `the ${teamLabel(t)}` : club.short_name || club.name;
}

const laterKey = (ask: CupAsk) => `cup-ask-later:${ask.last.id}`;

/**
 * "Did we go through?" after an outside cup's last game so far. Yes: pick the round, then the usual
 * Add fixture form opens filled in from the cup (opponent name, short name, crest, date and ground to add).
 * No: Mark as completed (onOut, or a link to the Events page where it lives).
 */
export default function CupAskPanel({ clubSlug, event, ask, teamName, onOut }: {
  clubSlug: string;
  event: Pick<ClubEvent, 'id' | 'title'>;
  ask: CupAsk;
  /** "the Seniors", or the club's name when it has one team */
  teamName: string;
  onOut?: () => void;
}) {
  const [later, setLater] = useState(() => { try { return localStorage.getItem(laterKey(ask)) === '1'; } catch { return false; } });
  const [picking, setPicking] = useState(false);
  const [round, setRound] = useState<KoStage>(ask.next || 'quarter_final');
  if (later) return null;

  const last = roundName(ask.last.tournament_stage);
  const q = {
    groups: `That's all the group games in ${event.title}. Did ${teamName} go through to the knockouts?`,
    won: `${teamName} won${last ? ` the ${last.toLowerCase()}` : ''}. On to the next round?`,
    drew: `A draw${last ? ` in the ${last.toLowerCase()}` : ''}. Did ${teamName} go through on penalties?`,
    lost: `${teamName} went out${last ? ` in the ${last.toLowerCase()}` : ''}.`,
  }[ask.kind];
  const question = q.charAt(0).toUpperCase() + q.slice(1);
  const day = new Date(ask.last.match_date);
  const addHref = newItemHref(`/${clubSlug}/admin/matches`, Number.isNaN(day.getTime()) ? new Date() : day, undefined, ask.team_id || undefined, event.id, round);
  const hide = () => { try { localStorage.setItem(laterKey(ask), '1'); } catch { /* still hidden for now */ } setLater(true); };
  const outLabel = ask.kind === 'lost' ? 'Mark as completed' : "No, we're out";
  const out = onOut
    ? <button type="button" className="btn btn-secondary btn-sm" onClick={onOut}>{outLabel}</button>
    : <Link href={`/${clubSlug}/admin/events?complete=${event.id}`} className="btn btn-secondary btn-sm">{outLabel}</Link>;

  return (
    <div role="group" aria-label={`Next round in ${event.title}`} style={{ marginTop: '1rem', padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(var(--club-primary-rgb), 0.07)', border: '1px solid rgba(var(--club-primary-rgb), 0.25)' }}>
      <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem', overflowWrap: 'anywhere' }}>{question}</strong>
      {picking ? (
        <>
          <div className="form-label" style={{ margin: '0.75rem 0 0.45rem' }}>Which round is next?</div>
          <div className="admin-chips" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
            {KO_ROUNDS.map(([k, label]) => (
              <button key={k} type="button" className="admin-chip" aria-pressed={round === k} onClick={() => setRound(k)}>{label}</button>
            ))}
          </div>
          <div className="row row-wrap" style={{ gap: '0.5rem', marginTop: '0.75rem' }}>
            <Link href={addHref} className="btn btn-primary btn-sm row"><Plus size={14} aria-hidden="true" /> <span>Set up the {roundName(round).toLowerCase()}</span></Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPicking(false)}>Back</button>
          </div>
          <div className="text-meta" style={{ marginTop: '0.4rem' }}>The fixture form opens with the cup, team and round filled in. Add the opponent, their short name and crest, and when and where.</div>
        </>
      ) : (
        <div className="row row-wrap" style={{ gap: '0.5rem', marginTop: '0.7rem' }}>
          {ask.kind !== 'lost' && (
            <button type="button" className="btn btn-primary btn-sm row" onClick={() => setPicking(true)}>
              <CheckCircle2 size={14} aria-hidden="true" /> <span>{ask.kind === 'won' ? 'Add our next game' : 'Yes, add our next game'}</span>
            </button>
          )}
          {ask.kind !== 'won' && out}
          <button type="button" className="btn btn-secondary btn-sm" onClick={hide}>{ask.kind === 'groups' ? 'Not known yet' : 'Later'}</button>
        </div>
      )}
    </div>
  );
}
