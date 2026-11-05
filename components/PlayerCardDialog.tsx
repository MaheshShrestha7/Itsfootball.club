'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { defaultSeasonLabel } from '@/lib/season';
import { publicPlayerIds, teamsOfMember } from '@/lib/teams';
import { POSITION_NAMES, initialsOf } from '@/lib/positions';
import { playerFigures } from '@/lib/top-players';
import { playerCardLink } from '@/lib/player-card';
import { teamColourVars } from '@/lib/theme-utils';
import type { Club } from '@/lib/supabase/types';
import PlayerAvatar from '@/components/PlayerAvatar';
import SilkBackdrop from '@/components/SilkBackdrop';

/** A player's card over the page: who they are and their season, with links to their full page and the
 *  card maker, so people can browse a squad without losing their place. Only for someone with a public
 *  player page: anyone else (a junior) gets nothing, whatever id it's given. Render it to open it. */
export default function PlayerCardDialog({ club, playerId, colour, onClose }: {
  club: Club;
  playerId: string;
  /** The team they were opened from; otherwise their first team's colour */
  colour?: string | null;
  onClose: () => void;
}) {
  const { members, clubTeams, clubTeamMembers, playerStats, getActiveSeason } = useClub();
  const ref = useRef<HTMLDialogElement>(null);

  const player = useMemo(() => {
    const clubMembers = members.filter(m => m.club_id === club.id);
    const open = publicPlayerIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    return open.has(playerId) ? clubMembers.find(m => m.id === playerId) : undefined;
  }, [members, club, clubTeams, clubTeamMembers, playerId]);

  const hasPlayer = !!player;
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, [hasPlayer]);

  if (!player) return null;

  const season = getActiveSeason?.(club.id)?.name || defaultSeasonLabel();
  const stats = playerStats.find(s => s.member_id === player.id && s.season === season);
  const teams = teamsOfMember(clubTeamMembers, clubTeams.filter(t => t.club_id === club.id && !t.is_junior), player.id);
  const silk = colour || teams[0]?.color || club.primary_color;
  const position = player.player_position ? POSITION_NAMES[player.player_position] || player.player_position : null;

  return (
    <dialog ref={ref} className="pc-dialog" aria-labelledby="pc-name" onClose={onClose}
      // The card fills the dialog, so a click landing on the dialog itself is on the dimmed area
      onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="team-band" style={teamColourVars(silk) as React.CSSProperties}>
        <SilkBackdrop primary={silk} secondary={club.secondary_color} numberSelector=".pc-no-print" number={null} />
        <div className="pc-in">
          <div className="pc-top">
            <span className={`pc-tile${!player.photo_url && player.jersey_number == null ? ' pc-tile-none' : ''}`}>
              {player.photo_url
                ? <PlayerAvatar photoUrl={player.photo_url} name={player.full_name} fill eager />
                : <span aria-hidden="true">{player.jersey_number ?? initialsOf(player.full_name)}</span>}
            </span>
            <button type="button" className="pc-close" aria-label={`Close ${player.full_name}'s card`} onClick={() => ref.current?.close()}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div>
            <h2 id="pc-name" className="pc-name">{player.full_name}</h2>
            <p className="pc-pos">{[player.jersey_number != null ? `#${player.jersey_number}` : null, position].filter(Boolean).join(' · ')}</p>
            {teams.length > 0 && <div className="pc-teams">{teams.map(t => <span key={t.id}>{t.name}</span>)}</div>}
          </div>
          <div className="pc-season">
            <p>{season} season</p>
            <dl className="tp-leader-stats">
              {playerFigures(player.player_position, stats).map(f => (
                <div key={f.key}><dd>{f.n}</dd><dt>{f.abbr ? <abbr title={f.label}>{f.abbr}</abbr> : f.label}</dt></div>
              ))}
            </dl>
          </div>
          <div className="pc-links">
            <Link href={`/${club.slug}/squad/${player.id}`} className="pp-btn pp-btn-light">Open full player page</Link>
            <Link href={playerCardLink(player, club, season, stats)} className="pp-btn pp-btn-ghost">Make a player card</Link>
          </div>
        </div>
      </div>
    </dialog>
  );
}
