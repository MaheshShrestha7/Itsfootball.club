'use client';

// Public side of hosted tournaments: the age group switch (TX-3) and one team's page (TX-9) with its
// crest, colours, staff, squad (junior names shortened by tournament_squads_public), games, how they
// did, and the "How we did" share graphic (TX-10).
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Share2, X } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { ageGroupFamily, ageGroupLabel, teamSummary } from '@/lib/hosted-tournaments';
import { fixtureWhenLabel } from '@/lib/tournament-engine';
import { drawTeamCard } from '@/lib/team-card';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentSquadPlayer } from '@/lib/supabase/types';

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

  return (
    <section className="ht-team glass-panel" aria-label={team.name}
      style={{ '--ht-c1': team.color || 'var(--club-primary)', '--ht-c2': team.secondary_color || 'rgba(var(--tint-rgb),0.2)' } as React.CSSProperties}>
      <header className="ht-team-head">
        <span className="ht-crest ht-crest-lg"><img src={team.logo_url || DEFAULT_CREST} alt="" width={72} height={72} /></span>
        <div className="min-w-0">
          <h2>{team.name}</h2>
          <div className="ht-team-meta">
            {team.manager_name && <span>Manager: {team.manager_name}</span>}
            {team.coach_name && <span>Coach: {team.coach_name}</span>}
            {s.finish && <span className="ht-pill ok">{s.finish}</span>}
          </div>
        </div>
        <button type="button" className="ht-icon-btn" onClick={onClose} aria-label="Close team"><X size={18} /></button>
      </header>

      {s.played > 0 && (
        <div className="ht-stats" aria-label="Results">
          {([['Played', s.played], ['Won', s.won], ['Drawn', s.drawn], ['Lost', s.lost], ['Goals', `${s.goalsFor}-${s.goalsAgainst}`]] as const).map(([k, v]) => (
            <div key={k}><b>{v}</b><span>{k}</span></div>
          ))}
        </div>
      )}

      <div className="ht-team-cols">
        <div>
          <h3>Games</h3>
          {s.games.length ? (
            <ul className="ht-list">
              {s.games.map(m => {
                const home = m.home_team_name === team.name;
                const opp = home ? m.away_team_name : m.home_team_name;
                return (
                  <li key={m.id}>
                    <span>{fixtureWhenLabel(m)}{m.pitch_label ? ` · ${m.pitch_label}` : ''}</span>
                    <b>v {opp}{m.status === 'completed' ? ` ${home ? m.home_score : m.away_score}-${home ? m.away_score : m.home_score}` : ''}</b>
                  </li>
                );
              })}
            </ul>
          ) : <p className="ht-hint">The draw isn&apos;t out yet.</p>}
          {s.scorers.length > 0 && (
            <>
              <h3>Goals</h3>
              <ul className="ht-list">{s.scorers.map(p => <li key={p.name}><span>{showName(p.name)}</span><b>{p.goals}</b></li>)}</ul>
            </>
          )}
        </div>
        <div>
          <h3>Squad</h3>
          {players.length ? (
            <ul className="ht-list">
              {players.map(p => (
                <li key={p.id}><span>{p.shirt_number != null ? <b className="ht-num">{p.shirt_number}</b> : null}{p.name}</span>{p.position && <span className="ht-hint">{p.position}</span>}</li>
              ))}
            </ul>
          ) : <p className="ht-hint">The squad hasn&apos;t been sent yet.</p>}
        </div>
      </div>

      {done && (
        <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>
          <Share2 size={16} /> {busy ? 'Making the graphic…' : 'Share how we did'}
        </button>
      )}
    </section>
  );
}
