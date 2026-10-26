'use client';

import React, { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { publicPlayerIds, teamsOfMember } from '@/lib/teams';
import { defaultSeasonLabel } from '@/lib/season';
import { clubResult, latestFirst } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import PlayerAvatar from '@/components/PlayerAvatar';
import ResultChip from '@/components/ResultChip';
import LocalTime from '@/components/LocalTime';

const POSITION_NAMES: Record<string, string> = {
  GK: 'Goalkeeper', CB: 'Centre-back', LB: 'Left-back', RB: 'Right-back', LWB: 'Left wing-back', RWB: 'Right wing-back',
  CDM: 'Defensive midfielder', CM: 'Midfielder', CAM: 'Attacking midfielder', LM: 'Left midfielder', RM: 'Right midfielder',
  LW: 'Left winger', RW: 'Right winger', ST: 'Striker', CF: 'Centre-forward',
};

/** /club/squad/{member id}: one adult player's public page. Juniors never get one (safeguarding). */
export default function PlayerPage({ params }: { params: Promise<{ clubSlug: string; playerId: string }> }) {
  const { clubSlug, playerId } = use(params);
  const { clubs, selectClubBySlug, members, clubTeams, clubTeamMembers, playerStats, matches, getActiveSeason, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const player = useMemo(() => {
    const clubMembers = members.filter(m => m.club_id === club.id);
    const open = publicPlayerIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    return open.has(playerId) ? clubMembers.find(x => x.id === playerId) : undefined;
  }, [members, club, clubTeams, clubTeamMembers, playerId]);

  const season = getActiveSeason?.(club.id)?.name || defaultSeasonLabel();
  const stats = player ? playerStats.find(s => s.member_id === player.id && s.season === season) : undefined;
  const career = player ? playerStats.filter(s => s.member_id === player.id) : [];
  const total = (k: 'appearances' | 'goals' | 'assists' | 'motm_awards') => career.reduce((n, s) => n + (s[k] || 0), 0);
  const teams = player ? teamsOfMember(clubTeamMembers, clubTeams.filter(t => t.club_id === club.id && !t.is_junior), player.id) : [];

  // Finished games they were picked for, newest first
  const recent = useMemo(() => {
    if (!player) return [];
    return matches
      .filter(m => m.club_id === club.id && m.status === 'completed' &&
        [...(m.home_lineup_coords || []), ...(m.away_lineup_coords || [])].some(p => p.member_id === player.id))
      .sort(latestFirst)
      .slice(0, 5);
  }, [matches, club.id, player]);

  const back = (
    <Link href={`/${club.slug}/squad`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
      <ArrowLeft size={16} /> Squad
    </Link>
  );

  if (!player) {
    return (
      <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          {back}
          <div className="glass-panel row" style={{ padding: '1.25rem' }}>
            {isHydrated ? <><Lock size={16} color="var(--text-muted)" className="shrink-0" aria-hidden="true" /><span className="text-body">This player&apos;s page isn&apos;t public.</span></> : 'Loading…'}
          </div>
        </div>
      </div>
    );
  }

  const tiles: [string, number][] = [
    ['Games', stats?.appearances ?? 0],
    ['Goals', stats?.goals ?? 0],
    ['Assists', stats?.assists ?? 0],
    [player.player_position === 'GK' ? 'Clean sheets' : 'Player of the Match', (player.player_position === 'GK' ? stats?.clean_sheets : stats?.motm_awards) ?? 0],
  ];
  const position = player.player_position ? POSITION_NAMES[player.player_position] || player.player_position : null;

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '760px' }}>
        {back}

        <div className="glass-panel player-hero">
          <PlayerAvatar name={player.full_name} photoUrl={player.photo_url} size={88} />
          <div className="min-w-0">
            {player.jersey_number != null && <div className="player-hero-number">#{player.jersey_number}</div>}
            <h1 className="player-hero-name">{player.full_name}</h1>
            <div className="text-body">{[position, club.name].filter(Boolean).join(' · ')}</div>
            {teams.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                {teams.map(t => <Link key={t.id} href={`/${club.slug}/teams/${t.slug}`} className="badge badge-primary">{t.name}</Link>)}
              </div>
            )}
          </div>
        </div>

        <section aria-labelledby="player-season" style={{ marginTop: '2rem' }}>
          <h2 id="player-season" className="prematch-label" style={{ marginBottom: '0.75rem' }}>This season ({season})</h2>
          <div className="player-stat-grid">
            {tiles.map(([label, n]) => (
              <div key={label} className="glass-panel player-stat">
                <span className="player-stat-num">{n}</span>
                <span className="text-meta">{label}</span>
              </div>
            ))}
          </div>
          {career.length > 1 && (
            <p className="text-meta" style={{ marginTop: '0.6rem' }}>
              All seasons: {total('appearances')} games · {total('goals')} goals · {total('assists')} assists · {total('motm_awards')} Player of the Match
            </p>
          )}
        </section>

        <section aria-labelledby="player-recent" style={{ marginTop: '2rem' }}>
          <h2 id="player-recent" className="prematch-label" style={{ marginBottom: '0.75rem' }}>Recent games</h2>
          {recent.length === 0 ? (
            <p className="glass-panel text-note" style={{ padding: '1rem 1.25rem', margin: 0 }}>No games in a published line-up yet.</p>
          ) : (
            <div className="stack stack-sm">
              {recent.map(m => {
                const r = clubResult(m);
                const opponent = m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name);
                return (
                  <Link key={m.id} href={matchPath(club.slug, m)} className="glass-panel glass-panel-interactive player-game">
                    {r.outcome ? <ResultChip outcome={r.outcome} /> : <span className="player-game-chip-gap" aria-hidden="true" />}
                    <div className="min-w-0" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', overflowWrap: 'anywhere' }}>
                        {m.match_type === 'internal' ? `${m.home_team_name} vs ${m.away_team_name}` : `${m.is_club_home ? 'vs' : 'at'} ${opponent}`}
                      </div>
                      <div className="text-meta"><LocalTime value={m.match_date} options={{ day: 'numeric', month: 'short', year: 'numeric' }} /></div>
                    </div>
                    <span className="player-game-score">{r.us} - {r.them}</span>
                    <ChevronRight size={16} color="var(--text-muted)" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <Link href="/tools/player-card-maker" className="glass-panel glass-panel-interactive player-card-cta">
          <Sparkles size={18} color="var(--club-primary)" aria-hidden="true" />
          <span style={{ flex: 1 }}>Make a player card for {player.full_name.split(' ')[0]}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
