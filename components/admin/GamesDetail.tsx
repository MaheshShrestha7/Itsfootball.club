'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import LocalTime from '@/components/LocalTime';
import { DATE_LOCALE } from '@/lib/dates';
import { matchPath } from '@/lib/slugs';
import {
  byDay, formSummary, opponentLine, playedGames, playersNeeded, pct, topScorers,
  type OverviewRange, type Outcome, type PlayedGame, type SideRecord,
} from '@/lib/club-overview';
import type { ClubMember, Match, MatchEvent } from '@/lib/supabase/types';

export interface Reply { match_id: string; available: number; maybe: number; unavailable: number; pending: number; pending_ids: string[] }

interface Props {
  clubSlug: string;
  games: Match[];
  next: Match[];
  range: OverviewRange;
  events: MatchEvent[];
  /** null while the replies aren't known (no permission, or not loaded) */
  replies: Map<string, Reply> | null;
  byMember: Map<string, ClubMember>;
  canAvailability: boolean;
  canFixtures: boolean;
  canSchedule: boolean;
}

const OUTCOME_CLASS: Record<Outcome, string> = { W: 'is-w', D: 'is-d', L: 'is-l' };
const OUTCOME_WORD: Record<Outcome, string> = { W: 'Won', D: 'Drawn', L: 'Lost' };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
const shortName = (name: string) => name.replace(/\b(FC|SC|AFC|Football Club|Soccer Club)\b/gi, '').trim() || name;
const opponentOf = (m: Match) => m.opponent_name || (m.is_club_home !== false ? m.away_team_name : m.home_team_name);

function Pill({ o, small }: { o: Outcome; small?: boolean }) {
  return <span className={`gv-pill ${OUTCOME_CLASS[o]}${small ? ' is-small' : ''}`} aria-label={OUTCOME_WORD[o]}>{o}</span>;
}

/** The Games and availability detail screen: form, goals per game, what's coming up, scorers and results. */
export default function GamesDetail({ clubSlug, games, next, range, events, replies, byMember, canAvailability, canFixtures, canSchedule }: Props) {
  const played = useMemo(() => playedGames(games, range), [games, range]);
  const form = useMemo(() => formSummary(played), [played]);
  const scorers = useMemo(() => topScorers(events, played), [events, played]);
  const [scorerTab, setScorerTab] = useState<'goals' | 'assists'>('goals');
  const ranked = scorers.filter(s => s[scorerTab] > 0).sort((a, b) => b[scorerTab] - a[scorerTab] || a.name.localeCompare(b.name)).slice(0, 5);
  const days = useMemo(() => byDay(played), [played]);
  const base = `/${clubSlug}/admin`;
  const gd = form.goalsFor - form.goalsAgainst;
  const chart = played.slice(-10);
  const chartMax = Math.max(1, ...chart.map(g => Math.max(g.us, g.them)));

  return (
    <div className="gv">
      <div className="gv-main">
      {/* Form */}
      <section className="admin-panel ov-card" aria-labelledby="gv-form">
        <div className="admin-panel-head"><h2 id="gv-form">Form</h2><span className="admin-meta">{form.played === 1 ? '1 game played' : `${form.played} games played`}</span></div>
        {form.played === 0 ? <p className="ov-empty">No results in this range yet.</p> : (
          <>
            <div className="gv-form">
              <WinRing won={form.won} drawn={form.drawn} lost={form.lost} />
              <dl className="gv-wdl">
                <div className="is-w"><dd>{form.won}</dd><dt>Won</dt></div>
                <div className="is-d"><dd>{form.drawn}</dd><dt>Drawn</dt></div>
                <div className="is-l"><dd>{form.lost}</dd><dt>Lost</dt></div>
              </dl>
            </div>
            <div className="gv-last">
              <span>Last {form.last5.length} <small>(newest on the right)</small></span>
              <span className="gv-pills">{form.last5.map((o, i) => <Pill key={i} o={o} />)}</span>
            </div>
            <dl className="gv-nums">
              <div><dd>{form.goalsFor}</dd><dt>Scored</dt></div>
              <div><dd>{form.goalsAgainst}</dd><dt>Conceded</dt></div>
              <div><dd className={gd > 0 ? 'is-pos' : gd < 0 ? 'is-neg' : undefined}>{gd > 0 ? `+${gd}` : gd < 0 ? `−${-gd}` : '0'}</dd><dt>Goal diff</dt></div>
              <div><dd>{form.cleanSheets}</dd><dt>Clean sheets</dt></div>
            </dl>
          </>
        )}
      </section>

      {/* Goals per game */}
      {chart.length > 0 && (
        <section className="admin-panel ov-card" aria-labelledby="gv-goals">
          <div className="admin-panel-head"><h2 id="gv-goals">Goals per game</h2><span className="admin-meta">{chart.length < played.length ? `Last ${chart.length}, oldest first` : 'Oldest first'}</span></div>
          <div className="gv-chart" role="img" aria-label={chart.map(g => `${opponentOf(g.match)} ${g.us} to ${g.them}`).join(', ')}>
            <div className="gv-plot">
              {chart.map(g => (
                <div key={g.match.id} className="gv-col" title={`${opponentLine(g.match)}: ${g.us} – ${g.them}`}>
                  <div className="up">{g.us > 0 && <i style={{ height: `${(g.us / chartMax) * 100}%` }}><em>{g.us}</em></i>}</div>
                  <div className="dn">{g.them > 0 && <i style={{ height: `${(g.them / chartMax) * 100}%` }}><em>{g.them}</em></i>}</div>
                </div>
              ))}
            </div>
            <div className="gv-x" aria-hidden="true">
              {chart.map(g => <span key={g.match.id}><Pill o={g.outcome} small /><span>{shortName(opponentOf(g.match))}</span></span>)}
            </div>
          </div>
          <p className="gv-legend"><span><i className="is-for" />Scored</span><span><i className="is-against" />Conceded</span></p>
          <div className="gv-ha">
            <Side label="Home" r={form.home} />
            <Side label="Away" r={form.away} />
          </div>
        </section>
      )}

      {/* Results, by day */}
      <section className="admin-panel ov-card gv-o5" aria-labelledby="gv-results">
        <div className="admin-panel-head"><h2 id="gv-results">Results</h2><span className="admin-meta">{range.label}</span></div>
        {days.length === 0 ? <p className="ov-empty">No results in this range.</p> : days.map(day => (
          <div key={day.key}>
            <div className="gv-day">
              <span>{new Date(`${day.key}T00:00:00`).toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              {day.items.length > 1 && <span>{day.items.length} games</span>}
            </div>
            <ul className="gv-results">
              {day.items.map(g => <ResultRow key={g.match.id} g={g} href={matchPath(clubSlug, g.match)} />)}
            </ul>
          </div>
        ))}
        {canFixtures && <div className="ov-foot"><span>Tap a game for its match page</span><Link href={`${base}/matches`}>All fixtures<ChevronRight size={14} aria-hidden="true" /></Link></div>}
      </section>
      </div>

      <div className="gv-side">
      {/* Coming up, with who can play */}
      <section className="admin-panel ov-card gv-o3" aria-labelledby="gv-next">
        <div className="admin-panel-head">
          <h2 id="gv-next">Coming up</h2>
          {canAvailability && next.length > 0 && <Link href={`${base}/availability`} className="admin-dash-link gv-headlink">Player availability<ChevronRight size={14} aria-hidden="true" /></Link>}
        </div>
        {next.length === 0 ? (
          <div className="gv-empty">
            <span className="gv-empty-mark"><CalendarPlus size={22} aria-hidden="true" /></span>
            <b>No games in the diary</b>
            <span>Add your next game and players can say if they can make it.</span>
            {canSchedule && <Link href={`${base}/matches`} className="btn btn-primary">Schedule a game</Link>}
          </div>
        ) : (
          <ul className="gv-next">
            {next.map(m => <NextGame key={m.id} m={m} r={replies?.get(m.id)} known={!!replies} byMember={byMember} href={canAvailability ? `${base}/availability` : null} />)}
          </ul>
        )}
      </section>

      {/* Top scorers */}
      <section className="admin-panel ov-card gv-o4" aria-labelledby="gv-scorers">
        <div className="admin-panel-head">
          <h2 id="gv-scorers">Top scorers</h2>
          <div className="gv-tabs" role="group" aria-label="Show">
            <button type="button" aria-pressed={scorerTab === 'goals'} onClick={() => setScorerTab('goals')}>Goals</button>
            <button type="button" aria-pressed={scorerTab === 'assists'} onClick={() => setScorerTab('assists')}>Assists</button>
          </div>
        </div>
        {ranked.length === 0 ? (
          <p className="ov-empty">{scorerTab === 'goals' ? 'No goals logged in Match Centre for these games.' : 'No assists logged in Match Centre for these games.'}</p>
        ) : (
          <ol className="gv-scorers">
            {ranked.map((s, i) => (
              <li key={s.name}>
                <span className="r">{i + 1}</span>
                <span className="ov-ava" aria-hidden="true">{initials(s.name)}</span>
                <span className="who">{s.name}<span className="bar" style={{ width: `${pct(s[scorerTab], ranked[0][scorerTab])}%` }} /></span>
                <span className="n">{s[scorerTab]}<small>{scorerTab === 'goals' ? (s.goals === 1 ? 'goal' : 'goals') : (s.assists === 1 ? 'assist' : 'assists')}</small></span>
              </li>
            ))}
          </ol>
        )}
        <div className="ov-foot"><span>From goals logged in Match Centre</span></div>
      </section>

      </div>
    </div>
  );
}

function WinRing({ won, drawn, lost }: { won: number; drawn: number; lost: number }) {
  const total = won + drawn + lost || 1;
  const C = 100; // circumference in the viewBox's units (r = 15.915)
  const seg = [
    { n: won, cls: 'is-w' },
    { n: drawn, cls: 'is-d' },
    { n: lost, cls: 'is-l' },
  ];
  let at = 0;
  return (
    <div className="gv-ring" role="img" aria-label={`Won ${pct(won, total)} percent of games`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15.915" className="track" />
        {seg.map(s => {
          const len = (s.n / total) * C;
          const el = len > 0 ? <circle key={s.cls} cx="18" cy="18" r="15.915" className={s.cls} strokeDasharray={`${Math.max(0, len - 1)} ${C}`} strokeDashoffset={-at} /> : null;
          at += len;
          return el;
        })}
      </svg>
      <div className="c"><b>{pct(won, total)}%</b><small>won</small></div>
    </div>
  );
}

function Side({ label, r }: { label: string; r: SideRecord }) {
  return (
    <div>
      <div className="k"><span>{label}</span><span>{r.played === 1 ? '1 game' : `${r.played} games`}</span></div>
      <div className="gv-bar" aria-hidden="true">
        {r.played === 0 ? <i className="is-none" style={{ flex: 1 }} /> : <>
          {r.won > 0 && <i className="is-w" style={{ flex: r.won }} />}
          {r.drawn > 0 && <i className="is-d" style={{ flex: r.drawn }} />}
          {r.lost > 0 && <i className="is-l" style={{ flex: r.lost }} />}
        </>}
      </div>
      <div className="t"><b>{r.won}</b>W&nbsp; <b>{r.drawn}</b>D&nbsp; <b>{r.lost}</b>L &nbsp;·&nbsp; goals {r.goalsFor}–{r.goalsAgainst}</div>
    </div>
  );
}

function NextGame({ m, r, known, byMember, href }: { m: Match; r?: Reply; known: boolean; byMember: Map<string, ClubMember>; href: string | null }) {
  const need = playersNeeded(m.match_format);
  const home = m.is_club_home !== false;
  const total = r ? r.available + r.maybe + r.unavailable + r.pending : 0;
  const missing = (r?.pending_ids || []).map(id => byMember.get(id)?.full_name).filter(Boolean) as string[];
  return (
    <li>
      <span className="gv-date" aria-hidden="true">
        <small><LocalTime value={m.match_date} options={{ weekday: 'short' }} /></small>
        <b><LocalTime value={m.match_date} options={{ day: 'numeric' }} /></b>
        <span><LocalTime value={m.match_date} options={{ month: 'short' }} /></span>
      </span>
      <div className="gv-next-body">
        <div className="name">{opponentLine(m)}<span className="gv-tag">{home ? 'Home' : 'Away'}</span></div>
        <div className="sub"><LocalTime value={m.match_date} options={{ weekday: 'long', day: 'numeric', month: 'short' }} /> · <LocalTime value={m.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />{m.venue ? ` · ${m.venue}` : ''}</div>
        {!known ? null : !r || total === 0 ? (
          <p className="gv-note">Nobody has been asked yet.{href && <> <Link href={href}>Ask the squad</Link></>}</p>
        ) : (
          <>
            <div className="gv-avail" aria-hidden="true">
              <i className="a-in" style={{ width: `${pct(r.available, total)}%` }} />
              <i className="a-maybe" style={{ width: `${pct(r.maybe, total)}%` }} />
              <i className="a-out" style={{ width: `${pct(r.unavailable, total)}%` }} />
              <i className="a-none" style={{ width: `${pct(r.pending, total)}%` }} />
            </div>
            <div className="gv-avail-row">
              <span className="gv-avail-k"><span><i className="a-in" /><b>{r.available}</b> in</span><span><i className="a-maybe" /><b>{r.maybe}</b> maybe</span><span><i className="a-out" /><b>{r.unavailable}</b> out</span></span>
              {r.available >= need
                ? <span className="gv-enough">Enough for {need}-a-side</span>
                : <span className="gv-short">{need - r.available} short of {need}</span>}
            </div>
            {r.pending > 0 && (
              <div className="gv-need">
                <span className="gv-faces" aria-hidden="true">
                  {missing.slice(0, 3).map(n => <span key={n}>{initials(n)}</span>)}
                  {r.pending > 3 && <span>+{r.pending - 3}</span>}
                </span>
                <span title={missing.join(', ')}><b>{r.pending}</b> {r.pending === 1 ? "hasn't" : "haven't"} replied</span>
                {href && <Link href={href}>Remind</Link>}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function ResultRow({ g, href }: { g: PlayedGame; href: string }) {
  return (
    <li className={OUTCOME_CLASS[g.outcome]}>
      <Link href={href}>
        <span className="edge" aria-hidden="true" />
        <Pill o={g.outcome} />
        <span className="who">{opponentOf(g.match)}<small>{g.home ? 'Home' : 'Away'}</small></span>
        <span className="score" aria-label={`${OUTCOME_WORD[g.outcome]} ${g.us} to ${g.them}`}>{g.us} – {g.them}</span>
        <ChevronRight size={16} aria-hidden="true" className="chev" />
      </Link>
    </li>
  );
}
