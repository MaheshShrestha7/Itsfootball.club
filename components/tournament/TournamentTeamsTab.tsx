'use client';

import React, { useId, useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentStanding } from '@/lib/supabase/types';
import { GROUP_LETTERS } from '@/lib/tournament-engine';
import { teamSummary } from '@/lib/hosted-tournaments';

// How far a team got, best first: the sections once the cup is over
const FINISH_ORDER = ['Winners', 'Runners-up', 'Third place', 'Fourth place', 'Semi-Finals', 'Quarter-Finals', 'Round of 16', 'Round of 32', 'Group stage'];
const FINISH_TITLE: Record<string, string> = { Winners: 'Champions', 'Semi-Finals': 'Semi-finals', 'Quarter-Finals': 'Quarter-finals' };

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const monogram = (t: TournamentParticipant) => (t.short_name?.trim() || t.name.split(/\s+/).map(w => w[0]).join('')).slice(0, 3).toUpperCase();
// Dark or light letters, whichever reads on the kit colour
const inkOn = (hex?: string | null) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 'var(--tt-ink-light)';
  const n = parseInt(m[1], 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? 'var(--tt-ink-dark)' : 'var(--tt-ink-light)';
};

/** The team's crest, or without one a shield in its own kit colours with its short name */
export function TeamCrest({ team, size }: { team: TournamentParticipant; size: number }) {
  const clip = useId();
  if (team.logo_url) return <img className="tt-crest" src={team.logo_url} alt="" width={size} height={size} loading="lazy" decoding="async" />;
  const shield = 'M50 4 10 18v30c0 25 17 42 40 48 23-6 40-23 40-48V18L50 4Z';
  return (
    <svg className="tt-crest" viewBox="0 0 100 100" width={size} height={size} aria-hidden="true"
      style={{ '--k1': team.color || 'var(--club-primary)', '--k2': team.secondary_color || team.color || 'var(--club-secondary)' } as React.CSSProperties}>
      <clipPath id={clip}><path d={shield} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill="var(--k1)" />
        <rect x="0" y="62" width="100" height="12" fill="var(--k2)" />
      </g>
      <path d={shield} fill="none" stroke="var(--border-medium)" strokeWidth="2.5" />
      <text x="50" y="49" textAnchor="middle" dominantBaseline="middle" fill={inkOn(team.color)} fontFamily="var(--font-heading)" fontWeight="800" fontSize="25">{monogram(team)}</text>
    </svg>
  );
}

/** The public Teams tab, laid out like a European clubs page: a grid of crests and names. Under each
 *  group while the cup is on (table order once games are played), under how far each team got once
 *  it's over. Tapping a crest opens the team's page. A search box shows from 8 teams. */
export default function TournamentTeamsTab({ tournament, participants, matches, events, standings, onOpen }: {
  tournament: Tournament;
  participants: TournamentParticipant[];
  matches: Match[];
  events: MatchEvent[];
  standings: (group?: string) => TournamentStanding[];
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  if (!participants.length) {
    return <p className="tt-empty">Teams show here once entries are in.</p>;
  }

  const grouped = tournament.format === 'group_knockout' && participants.some(p => p.group);
  const needle = q.trim().toLowerCase();
  const finish = new Map(participants.map(t => [t.id, teamSummary(t.name, matches, events).finish]));

  // Each team's place in its table, once a game in that table is played
  const place = new Map<string, number>();
  if (tournament.format !== 'knockout') {
    for (const g of grouped ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1) : [undefined]) {
      if (matches.some(m => (m.tournament_stage || 'group') === 'group' && (!g || m.tournament_group === g) && m.status === 'completed')) {
        standings(g).forEach((s, i) => place.set(s.team_id, i + 1));
      }
    }
  }
  const byPlace = (a: TournamentParticipant, b: TournamentParticipant) => (place.get(a.id) ?? 99) - (place.get(b.id) ?? 99) || a.name.localeCompare(b.name);

  const over = participants.every(t => finish.get(t.id));
  const sections = over
    ? [...FINISH_ORDER, null].map(f => ({
      key: f || 'other', title: f ? FINISH_TITLE[f] || f : 'Other',
      teams: participants.filter(t => (f ? finish.get(t.id) === f : !FINISH_ORDER.includes(finish.get(t.id)!))).sort(byPlace),
    }))
    : grouped
      ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ key: g, title: `Group ${g}`, teams: participants.filter(p => p.group === g).sort(byPlace) }))
      : [{ key: 'all', title: '', teams: [...participants].sort(byPlace) }];

  return (
    <div className="tt">
      {participants.length >= 8 && (
        <label className="tt-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Find a team</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a team" autoComplete="off" />
        </label>
      )}
      {sections.map(sec => {
        const teams = sec.teams.filter(t => !needle || t.name.toLowerCase().includes(needle));
        if (!teams.length) return null;
        return (
          <section key={sec.key} className="tt-sec" aria-label={sec.title || 'Teams'}>
            {sec.title && <h3>{sec.key === 'Winners' && <Trophy size={18} aria-hidden />}{sec.title}</h3>}
            <ul className="tt-grid">
              {teams.map(t => {
                const pos = place.get(t.id);
                // Under the name: the group once teams are sorted by finish, else the place in the group
                const sub = over || !grouped ? (t.group ? `Group ${t.group}` : null) : pos ? ordinal(pos) : null;
                return (
                  <li key={t.id}>
                    <button type="button" className="tt-club" onClick={() => onOpen(t.id)}>
                      <TeamCrest team={t} size={72} />
                      <span className="tt-name">{t.name}</span>
                      {sub && <span className="tt-sub">{sub}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {needle && !participants.some(t => t.name.toLowerCase().includes(needle)) && <p className="tt-empty">No team called &ldquo;{q.trim()}&rdquo;.</p>}
    </div>
  );
}
