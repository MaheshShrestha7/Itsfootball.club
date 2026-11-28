'use client';

import React, { useState } from 'react';
import { ChevronRight, Search, Trophy } from 'lucide-react';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentStanding } from '@/lib/supabase/types';
import { GROUP_LETTERS } from '@/lib/tournament-engine';
import { gameOutcome, teamSummary } from '@/lib/hosted-tournaments';
import { DEFAULT_CREST } from '@/lib/crest';
import { DATE_LOCALE } from '@/lib/dates';

const OUTCOME_WORD = { W: 'Won', D: 'Drawn', L: 'Lost' } as const;

function when(m: Match, oneDay: boolean) {
  const day = m.match_date?.slice(0, 10);
  if (!day) return 'time to be set';
  const d = new Date(`${day}T${m.match_time?.slice(0, 5) || '12:00'}`);
  const time = m.match_time ? d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit' }) : '';
  const date = d.toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
  return oneDay ? time || date : [date, time].filter(Boolean).join(', ');
}

/** Where a team got to, as a sentence: "Champions", "Runners-up", "Out in the semi-finals" */
function finishLine(finish: string) {
  if (finish === 'Winners') return 'Champions';
  if (finish === 'Runners-up' || finish.endsWith('place')) return finish;
  return `Out in the ${finish.toLowerCase()}`;
}

/** The public Teams tab: teams under their group, in table order once games are played (A to Z
 *  before), each with its kit, what's next for it (or where it finished) and its last results.
 *  Tapping a team opens its page. A search box shows from 8 teams. */
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

  const oneDay = new Set(matches.map(m => m.match_date?.slice(0, 10)).filter(Boolean)).size <= 1;
  const grouped = tournament.format === 'group_knockout' && participants.some(p => p.group);
  const sections = grouped
    ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ title: `Group ${g}`, group: g as string | undefined, teams: participants.filter(p => p.group === g) }))
    : [{ title: '', group: undefined as string | undefined, teams: participants }];
  const groupGames = (g?: string) => matches.filter(m => (m.tournament_stage || 'group') === 'group' && (!g || m.tournament_group === g));
  const hasTable = tournament.format !== 'knockout';
  const needle = q.trim().toLowerCase();

  return (
    <div className="tt">
      {participants.length >= 8 && (
        <label className="tt-search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Find a team</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a team" autoComplete="off" />
        </label>
      )}
      <div className="tt-groups">
        {sections.map(sec => {
          // Table order once a game in this group is played, else A to Z
          const table = hasTable && groupGames(sec.group).some(m => m.status === 'completed') ? standings(sec.group) : [];
          const rank = new Map(table.map((s, i) => [s.team_id, i]));
          const teams = [...sec.teams]
            .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.name.localeCompare(b.name))
            .filter(t => !needle || t.name.toLowerCase().includes(needle));
          if (!teams.length && needle) return null;
          return (
            <section key={sec.title || 'all'} className="tt-group" data-ranked={table.length > 0 || undefined} aria-label={sec.title || 'Teams'}>
              {sec.title && <h3>{sec.title}<span>{sec.teams.length} teams</span></h3>}
              <ul>
                {teams.map(t => {
                  const s = teamSummary(t.name, matches, events);
                  const st = table.find(x => x.team_id === t.id);
                  const live = s.games.find(m => m.status === 'live');
                  const next = s.games.find(m => m.status === 'upcoming');
                  const opp = (m: Match) => (m.home_team_name === t.name ? m.away_team_name : m.home_team_name);
                  const form = s.games.filter(m => m.status === 'completed').map(m => gameOutcome(m, m.home_team_name === t.name ? 'home' : 'away')!).slice(-3);
                  const champs = s.finish === 'Winners';
                  const line = live ? <><b className="tt-live">Playing now</b> v {opp(live)}, {live.home_team_name === t.name ? live.home_score : live.away_score}-{live.home_team_name === t.name ? live.away_score : live.home_score}</>
                    : s.finish ? finishLine(s.finish)
                    : next ? <>{s.played ? 'Next' : 'First game'} {when(next, oneDay)} v {opp(next)}{next.pitch_label ? `, ${next.pitch_label}` : ''}</>
                    : null;
                  return (
                    <li key={t.id}>
                      <button type="button" className="tt-row" data-champs={champs || undefined} onClick={() => onOpen(t.id)}>
                        {table.length > 0 && <span className="tt-pos" aria-label={st ? `Position ${rank.get(t.id)! + 1}` : undefined}>{st ? rank.get(t.id)! + 1 : ''}</span>}
                        <span className="tt-crest">
                          <img loading="lazy" decoding="async" width={36} height={36} src={t.logo_url || DEFAULT_CREST} alt="" />
                          {t.color && <i className="tt-kit" style={{ '--k1': t.color, '--k2': t.secondary_color || t.color } as React.CSSProperties} title="Kit colours" />}
                        </span>
                        <span className="tt-main">
                          <span className="tt-name">{champs && <Trophy size={14} aria-hidden />}{t.name}</span>
                          {line && <span className="tt-line">{line}</span>}
                        </span>
                        <span className="tt-side">
                          {st && <span className="tt-pts"><b>{st.points}</b> pts</span>}
                          {form.length > 0 && (
                            <ol className="ht-formline tt-form" aria-label="Last results">
                              {form.map((o, i) => <li key={i} className={`is-${o}`}><span aria-hidden="true">{o}</span><span className="sr-only">{OUTCOME_WORD[o]}</span></li>)}
                            </ol>
                          )}
                        </span>
                        <ChevronRight size={16} className="tt-go" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {needle && !participants.some(t => t.name.toLowerCase().includes(needle)) && <p className="tt-empty">No team called &ldquo;{q.trim()}&rdquo;.</p>}
    </div>
  );
}
