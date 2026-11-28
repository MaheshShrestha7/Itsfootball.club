'use client';

// The public tournament page's Stats and News tabs, and the slim tab row above them.
import React from 'react';
import Link from 'next/link';
import LocalTime from '@/components/LocalTime';
import FairPlayTable from '@/components/tournament/FairPlayTable';
import { DEFAULT_CREST } from '@/lib/crest';
import { matchPath } from '@/lib/slugs';
import { plainText } from '@/lib/match-report';
import { tournamentStats } from '@/lib/tournament-stats';
import { WRITEUP_LABELS, type tournamentWriteups } from '@/lib/tournament-writeups';
import type { Match, MatchEvent, TournamentParticipant } from '@/lib/supabase/types';
import '@/components/tournament/hosted.css';

export type TournamentTab = 'bracket' | 'standings' | 'fixtures' | 'stats' | 'news' | 'teams';

/** One line of short tab names; scrolls sideways on a narrow phone */
export function TournamentTabRow({ tabs, active, onChange }: {
  tabs: { key: TournamentTab; label: string; count?: number }[];
  active: TournamentTab;
  onChange: (t: TournamentTab) => void;
}) {
  return (
    <div id="tournament-tabs" className="tp-tabs" role="tablist" aria-label="Tournament">
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={active === t.key} className="tp-tab" onClick={() => onChange(t.key)}>
          {t.label}{t.count != null && <span className="tp-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TournamentStatsTab({ matches, events, participants, clubSlug, showName, onTeam }: {
  matches: Match[];
  events: MatchEvent[];
  participants: TournamentParticipant[];
  clubSlug: string;
  /** Player names as the public may see them (junior names shortened) */
  showName: (n: string) => string;
  onTeam: (teamId: string) => void;
}) {
  const ids = new Set(matches.map(m => m.id));
  const ev = events.filter(e => ids.has(e.match_id));
  const s = tournamentStats(matches, ev, participants);
  if (!s.played) return <p className="ht-empty">Stats show here once the first game is played.</p>;

  const game = (m: Match) => (
    <Link className="tp-game" href={matchPath(clubSlug, m)}>
      {m.home_team_name} {m.home_score}-{m.away_score}{m.home_score === m.away_score && m.home_penalty_score != null ? ` (${m.home_penalty_score}-${m.away_penalty_score} pens)` : ''} {m.away_team_name}
    </Link>
  );

  return (
    <div className="tp-stats">
      <section className="tp-sofar glass-panel" aria-label="The tournament so far">
        <div><b>{s.played}{s.played < s.total && <small> of {s.total}</small>}</b><span>games played</span></div>
        <div><b>{s.goals}</b><span>{s.goals === 1 ? 'goal' : 'goals'}</span></div>
        <div><b>{(s.goals / s.played).toFixed(1)}</b><span>goals a game</span></div>
        <div><b>{s.shootouts}</b><span>penalty shoot-out{s.shootouts === 1 ? '' : 's'}</span></div>
      </section>

      <div className="tp-grid">
        <section className="glass-panel tp-card" aria-labelledby="tp-scorers">
          <h3 id="tp-scorers">Top scorers</h3>
          {s.scorers.length ? (
            <ScorerTable rows={s.scorers.map(r => ({ name: showName(r.name), team: r.team, n: r.goals, note: r.pens ? `${r.pens} pen` : '' }))} label="Top scorers" />
          ) : <p className="tp-note">No goals logged with a scorer&apos;s name yet.</p>}
          {s.unnamed > 0 && <p className="tp-note">{s.unnamed === 1 ? 'One goal was' : `${s.unnamed} goals were`} logged without a name. They count for the team, not here.</p>}
        </section>

        <section className="glass-panel tp-card" aria-labelledby="tp-records">
          <h3 id="tp-records">Records</h3>
          <dl className="tp-records">
            {s.mostScored && s.mostScored.value > 0 && <div><dt>Most goals scored</dt><dd><Teams participants={participants} onTeam={onTeam} names={s.mostScored.teams} /><b>{s.mostScored.value}</b></dd></div>}
            {s.fewestConceded && <div><dt>Fewest let in</dt><dd><Teams participants={participants} onTeam={onTeam} names={s.fewestConceded.teams} /><b>{s.fewestConceded.value}</b></dd></div>}
            {s.cleanSheets && <div><dt>Most clean sheets</dt><dd><Teams participants={participants} onTeam={onTeam} names={s.cleanSheets.teams} /><b>{s.cleanSheets.value}</b></dd></div>}
            {s.unbeaten.length > 0 && s.unbeaten.length <= 4 && <div><dt>{s.played < s.total ? 'Still unbeaten' : 'Unbeaten'}</dt><dd><Teams participants={participants} onTeam={onTeam} names={s.unbeaten} /><b>{s.unbeaten.length}</b></dd></div>}
            {s.biggestWin && <div><dt>Biggest win</dt><dd>{game(s.biggestWin)}</dd></div>}
            {s.mostGoals && <div><dt>Most goals in a game</dt><dd>{game(s.mostGoals)}</dd></div>}
            {s.fastest && <div><dt>Fastest goal</dt><dd><Link className="tp-game" href={matchPath(clubSlug, s.fastest.match)}>{showName(s.fastest.player)}, {s.fastest.minute}&prime; v {s.fastest.opponent}</Link></dd></div>}
          </dl>
        </section>

        {s.assists.length > 0 && (
          <section className="glass-panel tp-card" aria-labelledby="tp-assists">
            <h3 id="tp-assists">Most assists</h3>
            <ScorerTable rows={s.assists.map(r => ({ name: showName(r.name), team: r.team, n: r.assists, note: '' }))} label="Most assists" />
          </section>
        )}

        <section className="glass-panel tp-card" aria-labelledby="tp-fair">
          <h3 id="tp-fair">Fair play</h3>
          <FairPlayTable matches={matches} events={ev} participants={participants} showName={showName} />
        </section>
      </div>
    </div>
  );
}

function Teams({ names, participants, onTeam }: { names: string[]; participants: TournamentParticipant[]; onTeam: (teamId: string) => void }) {
  return (
    <span className="tp-teams">
      {names.slice(0, 2).map(n => {
        const p = participants.find(x => x.name === n);
        return p
          ? <button key={n} type="button" className="tp-team" onClick={() => onTeam(p.id)}><img src={p.logo_url || DEFAULT_CREST} alt="" width={22} height={22} loading="lazy" /><span>{n}</span></button>
          : <span key={n} className="tp-team">{n}</span>;
      })}
      {names.length > 2 && <span className="tp-more">and {names.length - 2} more</span>}
    </span>
  );
}

type Row = { name: string; team: string; n: number; note: string };
function ScorerTable({ rows, label }: { rows: Row[]; label: string }) {
  const [all, setAll] = React.useState(false);
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <>
      <table className="tp-list">
        <caption className="sr-only">{label}</caption>
        <tbody>
          {shown.map((r, i) => (
            <tr key={`${r.name}|${r.team}`} className={i === 0 ? 'is-lead' : undefined}>
              <td className="tp-rank">{i === 0 || r.n !== rows[i - 1].n ? i + 1 : ''}</td>
              <th scope="row"><span className="tp-player">{r.name}</span><span className="tp-sub">{r.team}{r.note ? `, ${r.note}` : ''}</span></th>
              <td className="tp-num">{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 6 && (
        <button type="button" className="tp-more-btn" aria-expanded={all} onClick={() => setAll(a => !a)}>
          {all ? 'Show the top 6' : `All ${rows.length}`}
        </button>
      )}
    </>
  );
}

export function TournamentNewsTab({ writeups, nextNote }: { writeups: ReturnType<typeof tournamentWriteups>; nextNote?: string }) {
  if (!writeups.length) {
    return <p className="ht-empty">The first write-up appears here once the group stage is over.</p>;
  }
  return (
    <div className="tn-list">
      {writeups.map(w => (
        <Link key={w.kind} href={w.href} className="glass-panel tn-row">
          <span className="tn-tag">{WRITEUP_LABELS[w.kind]}{w.at && <>, <LocalTime value={w.at} /></>}</span>
          <span className="tn-head">{w.writeup.headline}</span>
          <span className="tn-lead">{plainText(w.writeup.lead)}</span>
        </Link>
      ))}
      {nextNote && <p className="tp-note">{nextNote}</p>}
    </div>
  );
}
