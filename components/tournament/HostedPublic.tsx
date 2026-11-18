'use client';

// Public side of hosted tournaments: the age group switch (TX-3) and one team's page (TX-9) with its
// crest, colours, staff, squad (junior names shortened by tournament_squads_public), games, how they
// did, and the "How we did" share graphic (TX-10).
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, X } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { ageGroupFamily, ageGroupLabel, teamSummary, kickoffLabel } from '@/lib/hosted-tournaments';
import { drawTeamCard } from '@/lib/team-card';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentSquadPlayer } from '@/lib/supabase/types';
import '@/components/tournament/hosted.css';

export function AgeGroupTabs({ tournaments, tournament, href }: { tournaments: Tournament[]; tournament: Tournament; href: (t: Tournament) => string }) {
  const family = ageGroupFamily(tournaments, tournament);
  if (family.length < 2) return null;
  return (
    <nav className="ht-ages" aria-label="Age groups">
      {family.map(t => (
        <Link key={t.id} href={href(t)} className="ht-age" aria-current={t.id === tournament.id ? 'page' : undefined}>
          {ageGroupLabel(t)}
        </Link>
      ))}
    </nav>
  );
}

export function TeamDetail({ team, tournament, matches, events, squad, host, showName, onClose }: {
  team: TournamentParticipant;
  tournament: Tournament;
  matches: Match[];
  events: MatchEvent[];
  squad: TournamentSquadPlayer[];
  host: { name: string; logo_url?: string | null };
  showName: (n: string) => string;
  onClose: () => void;
}) {
  const ids = new Set(matches.map(m => m.id));
  const s = teamSummary(team.name, matches, events.filter(e => ids.has(e.match_id)));
  const players = squad.filter(p => p.participant_id === team.id);
  const done = s.games.length > 0 && s.games.every(g => g.status === 'completed');
  const title = tournament.age_group ? `${tournament.name} (${tournament.age_group})` : tournament.name;
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const share = async () => {
    setBusy(true);
    try {
      const c = canvas.current || (canvas.current = document.createElement('canvas'));
      await drawTeamCard(c, { team, tournament: title, host, summary: s, showName });
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `${team.name.replace(/[^\w]+/g, '-').toLowerCase()}-tournament.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${team.name} at ${title}` }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally { setBusy(false); }
  };

  const staff = [team.manager_name && `Manager ${team.manager_name}`, team.coach_name && `coach ${team.coach_name}`].filter(Boolean).join(', ');

  return (
    <section className="ht-team glass-panel" aria-labelledby="ht-team-name"
      style={{ '--ht-c1': team.color || undefined, '--ht-c2': team.secondary_color || team.color || undefined } as React.CSSProperties}>
      {/* The team's two kit colours run along the top: the one thing every club recognises as its own */}
      <header className="ht-team-head">
        <span className="ht-crest ht-crest-lg"><img src={team.logo_url || DEFAULT_CREST} alt="" width={72} height={72} /></span>
        <div className="min-w-0">
          <h2 id="ht-team-name">{team.name}</h2>
          {(staff || s.finish) && <p className="ht-team-meta">{[s.finish, staff].filter(Boolean).join('. ')}</p>}
        </div>
        <button type="button" className="ht-icon-btn" onClick={onClose} aria-label="Close team"><X size={18} /></button>
      </header>

      {s.played > 0 && (
        <table className="ht-results">
          <caption className="sr-only">{team.name} results</caption>
          <thead><tr><th scope="col"><abbr title="Played">P</abbr></th><th scope="col"><abbr title="Won">W</abbr></th><th scope="col"><abbr title="Drawn">D</abbr></th><th scope="col"><abbr title="Lost">L</abbr></th><th scope="col"><abbr title="Goals for">GF</abbr></th><th scope="col"><abbr title="Goals against">GA</abbr></th></tr></thead>
          <tbody><tr><td>{s.played}</td><td>{s.won}</td><td>{s.drawn}</td><td>{s.lost}</td><td>{s.goalsFor}</td><td>{s.goalsAgainst}</td></tr></tbody>
        </table>
      )}

      <div className="ht-team-cols">
        <div>
          <h3>Games</h3>
          {s.games.length ? (
            <table className="ht-table ht-fixtures">
              <caption className="sr-only">{team.name} games</caption>
              <tbody>
                {s.games.map(m => {
                  const home = m.home_team_name === team.name;
                  const opp = home ? m.away_team_name : m.home_team_name;
                  return (
                    <tr key={m.id}>
                      <td><span className="ht-when">{kickoffLabel(m)}</span>{m.pitch_label && <span className="ht-sub">{m.pitch_label}</span>}</td>
                      <th scope="row">v {opp}</th>
                      <td className="ht-score">{m.status === 'completed' ? `${home ? m.home_score : m.away_score}-${home ? m.away_score : m.home_score}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="ht-hint">The draw isn&apos;t out yet.</p>}
          {s.scorers.length > 0 && (
            <>
              <h3>Goals</h3>
              <table className="ht-table">
                <caption className="sr-only">{team.name} scorers</caption>
                <tbody>{s.scorers.map(p => <tr key={p.name}><th scope="row">{showName(p.name)}</th><td className="ht-score">{p.goals}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
        <div>
          <h3>Team sheet</h3>
          {players.length ? (
            <table className="ht-table ht-sheet">
              <caption className="sr-only">{team.name} players</caption>
              <thead><tr><th scope="col" className="ht-num-col">No.</th><th scope="col">Name</th><th scope="col">Position</th></tr></thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}><td className="ht-num-col">{p.shirt_number ?? ''}</td><th scope="row">{p.name}</th><td>{p.position || ''}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="ht-hint">The squad hasn&apos;t been sent yet.</p>}
        </div>
      </div>

      {done && (
        <button type="button" className="btn btn-primary ht-share" onClick={share} disabled={busy}>
          <Share2 size={16} aria-hidden="true" /> {busy ? 'Making the graphic…' : 'Share how we did'}
        </button>
      )}
    </section>
  );
}
