'use client';

import { useState, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, MapPin, Search, Trophy, X } from 'lucide-react';
import type { Match } from '@/lib/supabase/types';
import type { MatchKind } from '@/lib/fixtures';
import { kickoffIso } from '@/lib/fixtures';
import { tournamentMatchLabel } from '@/lib/tournament-engine';
import { DEFAULT_CREST } from '@/lib/crest';
import LocalTime from '@/components/LocalTime';
import LiveMinute from '@/components/LiveMinute';
import PopupPanel from '@/components/PopupPanel';

const isLive = (m: Match) => m.status === 'live' || m.status === 'halftime';
const isDone = (m: Match) => m.status === 'completed' || m.status === 'cancelled';
const hasScore = (m: Match) => isLive(m) || m.status === 'completed';

/** "Group A" is saved with its word (the engine writes `Group ${letter}`); older rows may hold just "A" */
export const groupName = (g?: string | null) => (g ? (/^group\b/i.test(g) ? g : `Group ${g}`) : '');

const STATUS_TEXT: Record<string, string> = { upcoming: 'Not started', live: 'Live', halftime: 'Half time', completed: 'Full time', postponed: 'Postponed', cancelled: 'Cancelled' };

function Crest({ src, size }: { src?: string | null; size: number }) {
  return <img className="mc-gp-crest" src={src || DEFAULT_CREST} alt="" width={size} height={size} loading="lazy" />;
}

/** One game in the list: when, both teams with crests (and the score once it's started), where */
function GameRow({ m, open, kind, zone, onPick }: { m: Match; open: boolean; kind: MatchKind; zone: string; onPick: (id: string) => void }) {
  const at = kickoffIso(m, zone);
  const scored = hasScore(m);
  const lost = (side: 'home' | 'away') => m.status === 'completed' && (side === 'home' ? (m.home_score ?? 0) < (m.away_score ?? 0) : (m.away_score ?? 0) < (m.home_score ?? 0));
  return (
    <button data-view-ok type="button" className={`mc-gp-row${open ? ' is-open' : ''}${isDone(m) ? ' is-done' : ''}`} aria-current={open || undefined} onClick={() => onPick(m.id)}>
      <span className={`mc-gp-when${isLive(m) ? ' is-live' : ''}`}>
        {isLive(m) ? (
          <><b>{m.status === 'halftime' ? 'HT' : <><LiveMinute match={m} />&prime;</>}</b><small>Live</small></>
        ) : (
          <>
            <b>{m.status === 'completed' ? 'FT' : m.status === 'upcoming' ? <LocalTime value={at} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /> : STATUS_TEXT[m.status]}</b>
            {/* A cup day is one day: the weekday is enough */}
            <small><LocalTime value={at} options={kind === 'tournament' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }} /></small>
          </>
        )}
      </span>
      <span className="mc-gp-teams">
        {(['home', 'away'] as const).map(side => (
          <span key={side} className={`mc-gp-team${lost(side) ? ' is-lost' : ''}`}>
            <Crest src={side === 'home' ? m.home_team_logo : m.away_team_logo} size={22} />
            <span>{side === 'home' ? m.home_team_name : m.away_team_name}</span>
            <b>{scored ? (side === 'home' ? m.home_score : m.away_score) ?? 0 : ''}</b>
          </span>
        ))}
      </span>
      <span className="mc-gp-where">
        {open && <span className="mc-gp-tag is-open">Scoring</span>}
        {kind === 'tournament'
          ? m.pitch_label && <span className="mc-gp-tag">{m.pitch_label}</span>
          : kind === 'club' && <>
              {m.competition && <span className="mc-gp-tag">{m.competition}</span>}
              <span className="mc-gp-ha">{m.is_club_home === false ? 'Away' : 'Home'}</span>
            </>}
      </span>
    </button>
  );
}

/** The game list: search, pitch filter, live first, then what's next (by round on a cup day), played folded away */
function GameList({ games, match, kind, zone, title, sub, filters, footer, onPick, onClose }: {
  games: Match[]; match: Match; kind: MatchKind; zone: string; title: string; sub: string;
  filters?: ReactNode; footer?: ReactNode; onPick: (id: string) => void; onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [pitch, setPitch] = useState('');
  const [showDone, setShowDone] = useState(false);
  const pitches = kind === 'tournament' ? [...new Set(games.map(g => g.pitch_label).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
  const q = query.trim().toLowerCase();
  const shown = games.filter(g => (!pitch || g.pitch_label === pitch) && (!q || `${g.home_team_name} ${g.away_team_name}`.toLowerCase().includes(q)));
  const live = shown.filter(isLive);
  const done = shown.filter(isDone);
  const toPlay = shown.filter(g => !isLive(g) && !isDone(g));
  // A cup day reads by round; club games are just "Coming up"
  const groups: { label: string; list: Match[] }[] = [];
  for (const g of toPlay) {
    const label = kind === 'tournament' ? tournamentMatchLabel(g) || groupName(g.tournament_group) || 'Coming up' : 'Coming up';
    const last = groups[groups.length - 1];
    if (last?.label === label) last.list.push(g); else groups.push({ label, list: [g] });
  }
  const doneOpen = showDone || !!q || done.some(g => g.id === match.id);
  const row = (g: Match) => <GameRow key={g.id} m={g} open={g.id === match.id} kind={kind} zone={zone} onPick={onPick} />;

  return (
    <>
      <div className="mc-gp-head">
        <div className="mc-gp-title">
          <h2>{title}<small>{sub}</small></h2>
          {onClose && <button data-view-ok type="button" className="mc-gp-x" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>}
        </div>
        {filters}
        {games.length > 6 && (
          <label className="mc-gp-search">
            <Search size={16} aria-hidden="true" />
            <input data-view-ok type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={kind === 'club' ? 'Find a team or opponent' : 'Find a team'} aria-label="Find a team" />
          </label>
        )}
        {pitches.length > 1 && (
          <div className="mc-gp-pitches" role="group" aria-label="Pitch">
            {['', ...pitches].map(p => (
              <button data-view-ok key={p || 'all'} type="button" aria-pressed={pitch === p} onClick={() => setPitch(p)}>{p || 'All pitches'}</button>
            ))}
          </div>
        )}
      </div>
      <div className="mc-gp-body">
        {live.length > 0 && <>
          <div className="mc-gp-group is-live">On now <small>{live.length} {live.length === 1 ? 'game' : 'games'}</small></div>
          {live.map(row)}
        </>}
        {groups.map(gr => (
          <div key={gr.label}>
            <div className="mc-gp-group">{gr.label} <small>{gr.list.length} {gr.list.length === 1 ? 'game' : 'games'}</small></div>
            {gr.list.map(row)}
          </div>
        ))}
        {done.length > 0 && (doneOpen ? <>
          <div className="mc-gp-group">{kind === 'tournament' ? 'Played' : 'Results'} <small>{done.length}</small></div>
          {done.map(row)}
        </> : (
          <button data-view-ok type="button" className="mc-gp-more" onClick={() => setShowDone(true)}>
            <ChevronDown size={16} aria-hidden="true" />{kind === 'tournament' ? 'Played' : 'Results'} ({done.length})
          </button>
        ))}
        {shown.length === 0 && <p className="mc-gp-empty">No games match.</p>}
        {footer}
      </div>
    </>
  );
}

/**
 * Which game Match Centre is scoring: a card with both crests, the kick-off and the pitch, and a list
 * to pick another (a sheet on phones, beside the card on wide screens).
 */
export default function GamePicker({ match, games, kind, tournamentName, zone, listTitle, filters, footer, onPick }: {
  match: Match;
  /** The games of this kind (or this tournament), already in picking order */
  games: Match[];
  kind: MatchKind;
  tournamentName?: string;
  /** The club's time zone, for cup kick-offs saved as a bare date plus a clock time */
  zone: string;
  listTitle: string;
  /** Season and tournament pickers, shown above the list */
  filters?: ReactNode;
  footer?: ReactNode;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const at = kickoffIso(match, zone);
  const index = games.findIndex(g => g.id === match.id);
  // The arrows step along this pitch on a cup day, else along the whole list
  const lane = kind === 'tournament' && match.pitch_label ? games.filter(g => g.pitch_label === match.pitch_label) : games;
  const pos = lane.findIndex(g => g.id === match.id);
  const prev = pos > 0 ? lane[pos - 1] : undefined;
  const next = pos >= 0 && pos < lane.length - 1 ? lane[pos + 1] : undefined;
  const where = kind === 'tournament'
    ? [tournamentName, groupName(match.tournament_group), tournamentMatchLabel(match)].filter(Boolean).join(', ')
    : kind === 'inhouse' ? 'In-house game' : match.competition || 'Club game';
  const status = isLive(match) ? 'is-live' : match.status === 'upcoming' ? 'is-next' : '';
  const pick = (id: string) => { onPick(id); setOpen(false); };
  const listProps = { games, match, kind, zone, title: 'Pick a game', sub: listTitle, filters, footer };

  return (
    <div className="mc-gp">
      <section className={`glass-panel mc-gp-card is-${kind}`} aria-label="The game you are scoring">
        <div className="mc-gp-top">
          <span className="mc-gp-comp">
            {kind === 'tournament' ? <Trophy size={14} aria-hidden="true" /> : kind === 'inhouse' ? <ArrowLeftRight size={14} aria-hidden="true" /> : null}
            <span>{where}</span>
          </span>
          {games.length > 1 && index >= 0 && <span>Game {index + 1} of {games.length}</span>}
        </div>
        <div className="mc-gp-match">
          <div className="mc-gp-side"><Crest src={match.home_team_logo} size={52} /><b>{match.home_team_name}</b></div>
          <div className="mc-gp-mid">
            {hasScore(match) ? (
              <span className="mc-gp-score">{match.home_score ?? 0}&ndash;{match.away_score ?? 0}</span>
            ) : (
              <span className="mc-gp-ko"><LocalTime value={at} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></span>
            )}
            <span className="mc-gp-day"><LocalTime value={at} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></span>
          </div>
          <div className="mc-gp-side is-away"><Crest src={match.away_team_logo} size={52} /><b>{match.away_team_name}</b></div>
        </div>
        <div className="mc-gp-facts">
          {kind === 'tournament' && match.pitch_label && <span className="mc-gp-chip is-pitch"><MapPin size={13} aria-hidden="true" />{match.pitch_label}</span>}
          {kind === 'club' && <span className="mc-gp-chip">{match.is_club_home === false ? 'Away' : 'Home'}</span>}
          <span className={`mc-gp-chip ${status}`}>
            {isLive(match) && <span className="pulse-dot" aria-hidden="true" />}
            <span>{match.status === 'live' ? <>Live, <LiveMinute match={match} />&prime;</> : STATUS_TEXT[match.status] || match.status}</span>
          </span>
        </div>
        <div className="mc-gp-nav">
          <button data-view-ok type="button" className="btn btn-secondary mc-gp-step" aria-label={prev ? `Previous game: ${prev.home_team_name} vs ${prev.away_team_name}` : 'No previous game'} disabled={!prev} onClick={() => prev && onPick(prev.id)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button data-view-ok type="button" className="btn btn-primary mc-gp-change" onClick={() => setOpen(true)}><ArrowLeftRight size={16} aria-hidden="true" />Change game</button>
          <button data-view-ok type="button" className="btn btn-secondary mc-gp-step" aria-label={next ? `Next game: ${next.home_team_name} vs ${next.away_team_name}` : 'No next game'} disabled={!next} onClick={() => next && onPick(next.id)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <p className="mc-gp-note">
          {kind === 'tournament'
            ? "Saved to the cup table and bracket. Doesn't count toward the club's win/loss record."
            : kind === 'inhouse'
              ? "Your own teams against each other. Doesn't count toward the club's win/loss record."
              : "Counts toward the club's win/loss record."}
        </p>
      </section>

      {/* Wide screens: the list stays open beside the card */}
      <aside className="glass-panel mc-gp-inline" aria-label="Games">
        <GameList {...listProps} onPick={onPick} />
      </aside>

      {open && (
        <div className="mc-sheet-wrap mc-gp-sheet-wrap" onClick={() => setOpen(false)}>
          <PopupPanel onClose={() => setOpen(false)} label="Pick a game" className="mc-sheet mc-gp-sheet" onClick={e => e.stopPropagation()}>
            <div className="mc-sheet-grab" aria-hidden="true" />
            <GameList {...listProps} onPick={pick} onClose={() => setOpen(false)} />
          </PopupPanel>
        </div>
      )}
    </div>
  );
}
