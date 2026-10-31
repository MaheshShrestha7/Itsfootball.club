'use client';

import React, { useState, use, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { Match, MatchEventType, MatchFormat, MatchPeriod, PitchPosition, isPlayerMember } from '@/lib/supabase/types';
import TacticalPitch from '@/components/TacticalPitch';
import PlayerSearchSelect from '@/components/PlayerSearchSelect';
import {
  Radio,
  Play,
  Pause,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Trash2,
  ExternalLink,
  Layers,
  Move,
  Users,
  Timer,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  X,
  Calendar,
  QrCode,
  MoreHorizontal,
  Trophy,
  ArrowLeftRight,
  ChevronRight,
  Goal,
  Target,
  Undo2,
  RectangleVertical,
  Mic,
  Megaphone,
} from 'lucide-react';
import StatsAuditModal from '@/components/StatsAuditModal';
import MatchKindSwitch from '@/components/admin/MatchKindSwitch';
import StatsFixModal from '@/components/StatsFixModal';
import QRScannerModal from '@/components/QRScannerModal';
import LiveMinute from '@/components/LiveMinute';
import { fixtureLabel } from '@/lib/fixture-label';
import { getLiveMinute, RUNNING_PERIODS, useNowTick } from '@/lib/match-clock';
import { defaultSeasonLabel } from '@/lib/season';
import { clubLineupSide, clubSidePlayers, compareTournamentMatches, nextOnPitch, tournamentMatchLabel } from '@/lib/tournament-engine';
import { DEFAULT_CREST } from '@/lib/crest';
import { squadForMatch } from '@/lib/teams';
import { defaultFixture, kickoff, matchKind, type MatchKind } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import { alertFor, type MatchState } from '@/lib/match-alerts';
import { getAccessToken } from '@/lib/supabase/client';

// What the confirmation line says, in words rather than codes
const EVENT_LABEL: Partial<Record<MatchEventType, string>> = {
  goal: 'goal', penalty: 'penalty goal', own_goal: 'own goal', yellow_card: 'yellow card', red_card: 'red card',
  sub: 'substitution', var: 'VAR review', commentary: 'commentary', whistle: 'whistle',
};
const PERIOD_LABEL: Partial<Record<MatchPeriod, string>> = {
  pre_match: 'Back to before kick-off', first_half: 'First half started', halftime: 'Half time',
  second_half: 'Second half started', extra_time: 'Extra time started', penalties: 'Penalty shootout', full_time: 'Full time',
};

// Fixture picker order: live, upcoming, postponed, results, cancelled
/** The mark on each event button: a drawn icon per event type; cards are filled in their colour */
function EventIcon({ type, size }: { type: MatchEventType; size: number }) {
  if (type === 'yellow_card' || type === 'red_card') {
    const fill = type === 'yellow_card' ? 'var(--color-warn)' : 'var(--color-danger)';
    return <RectangleVertical size={size} fill={fill} color={fill} aria-hidden="true" />;
  }
  const Icon = type === 'goal' ? Goal
    : type === 'penalty' ? Target
    : type === 'own_goal' ? Undo2
    : type === 'sub' ? ArrowLeftRight
    : type === 'commentary' ? Mic
    : Megaphone;
  return <Icon size={size} aria-hidden="true" />;
}

const STATUS_ORDER: Record<string, number> = { live: 0, halftime: 0, upcoming: 1, postponed: 2, completed: 3, cancelled: 4 };
// Event player chips: by shirt number, players without one last
const byShirtNumber = (a: { jersey_number?: number | null; full_name: string }, b: { jersey_number?: number | null; full_name: string }) =>
  (a.jersey_number || 999) - (b.jersey_number || 999) || a.full_name.localeCompare(b.full_name);

export default function AdminMatchCenterControllerPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const resolvedParams = use(params);
  // ?match=<id> opens that fixture (e.g. the "Match Centre" button on a tournament fixture)
  const { match: requestedMatchId } = use(searchParams);
  const {
    clubs,
    selectClubBySlug,
    matches,
    matchEvents,
    updateMatch,
    addMatch,
    deleteMatch,
    addMatchEvent,
    deleteMatchEvent,
    members,
    seasons,
    getActiveSeason,
    getMatchAvailabilities,
    internalTeams,
    tournamentParticipants,
    clubTeams,
    clubTeamMembers,
    updateTournamentMatchScore,
    tournaments,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMatches = matches.filter(m => m.club_id === club.id);
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;

  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');

  const filteredMatches = clubMatches.filter(m => {
    if (seasonFilter === 'ALL') return true;
    return m.season === seasonFilter;
  });

  // Opens on the live match, else the club's next fixture, else its latest result (not whatever the database lists first)
  const nextOrLive = defaultFixture(filteredMatches, tournamentParticipants, club.name) || defaultFixture(clubMatches, tournamentParticipants, club.name);
  // A match finished in the last day whose player stats aren't saved yet comes first, so a reload
  // after full time stays on it instead of jumping to the next fixture
  const unsavedResult = clubMatches
    .filter(m => m.status === 'completed' && !m.is_audited && Date.now() - new Date(m.match_date).getTime() < 86400000)
    .sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
  const defaultMatch = nextOrLive && (nextOrLive.status === 'live' || nextOrLive.status === 'halftime') ? nextOrLive : unsavedResult || nextOrLive;
  const [selectedMatchId, setSelectedMatchIdState] = useState<string>(requestedMatchId || defaultMatch?.id || '');
  // The open fixture goes in the address (?match=), so a reload or a shared link reopens it
  const setSelectedMatchId = (id: string) => {
    setSelectedMatchIdState(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('match', id);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch { /* the selection still works without it */ }
  };

  const match = filteredMatches.find(m => m.id === selectedMatchId) || defaultMatch;

  // Club games, tournament games and in-house games each get their own list, so a tournament's
  // dozens of games don't bury Sunday's league match. The open game decides which list shows.
  const kind: MatchKind = match ? matchKind(match) : 'club';
  // Live first, then what's coming up (soonest first), then results (newest first), as on admin Fixtures
  const pickerOrder = (a: Match, b: Match) =>
    (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) ||
    ((STATUS_ORDER[a.status] ?? 1) < 3 ? kickoff(a) - kickoff(b) : kickoff(b) - kickoff(a));
  const kindGames = (k: MatchKind) => filteredMatches.filter(m => matchKind(m) === k).sort(pickerOrder);
  const isLiveGame = (m: { status: string }) => m.status === 'live' || m.status === 'halftime';
  const pickGame = (pool: typeof filteredMatches) => {
    const next = defaultFixture(pool, tournamentParticipants, club.name);
    if (next) setSelectedMatchId(next.id);
  };
  // Tournament games: one tournament at a time, in bracket order
  const matchTournament = match?.tournament_id ? tournaments.find(t => t.id === match.tournament_id) : undefined;
  const kindTournaments = tournaments.filter(t => t.club_id === club.id && filteredMatches.some(m => m.tournament_id === t.id));
  const tournamentGames = match?.tournament_id
    ? filteredMatches.filter(m => m.tournament_id === match.tournament_id).sort(compareTournamentMatches)
    : [];
  const pickerGames = kind === 'tournament' ? tournamentGames : kindGames(kind);
  // Tournament day: every game being played now, plus the next one, one tap apart
  const liveCupGames = tournamentGames.filter(isLiveGame);
  const upNextCupGame = tournamentGames.find(m => m.status === 'upcoming' && m.id !== match?.id);
  const pitchBoard = liveCupGames.length > 0 && liveCupGames.length + (upNextCupGame ? 1 : 0) >= 2
    ? [...liveCupGames, ...(upNextCupGame ? [upNextCupGame] : [])]
    : [];
  const nextGameOnPitch = match && (isLiveGame(match) || match.status === 'completed') ? nextOnPitch(match, tournamentGames) : undefined;

  // Followers' live-score alerts: kick-off, each goal, full time, as this screen sees them happen
  // (whichever button or event caused it). The first look at a match only records where it stands;
  // the server sends each alert once even with several admins on the match.
  const alertSeen = useRef<Record<string, MatchState>>({});
  useEffect(() => {
    if (!match) return;
    const now: MatchState = { status: match.status, home: match.home_score ?? 0, away: match.away_score ?? 0 };
    const prev = alertSeen.current[match.id];
    alertSeen.current[match.id] = now;
    const kind = prev ? alertFor(prev, now) : null;
    if (!kind) return;
    void getAccessToken().then(token => fetch('/api/push/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId: club.id, matchId: match.id, kind, home: now.home, away: now.away, minute: getLiveMinute(match) }),
    })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, match?.status, match?.home_score, match?.away_score]);
  const events = matchEvents.filter(e => e.match_id === match?.id).sort((a, b) => b.minute - a.minute);
  // The fixture's team squad once the club has several teams (everyone otherwise)
  const squadPlayers = squadForMatch(members.filter(m => m.club_id === club.id && isPlayerMember(m)), match, clubTeams, clubTeamMembers);

  // Each side's own club players (null = outside team); tournament sides come from their participants
  const homePlayers = match ? clubSidePlayers(match, 'home', squadPlayers, tournamentParticipants, internalTeams) : null;
  const awayPlayers = match ? clubSidePlayers(match, 'away', squadPlayers, tournamentParticipants, internalTeams) : null;
  // The club's lineup lives on its own side's columns (away when the club plays away), as the public page reads it
  const lineupSide = match ? clubLineupSide(match) : 'home';

  // Post-match verification only offers players explicitly marked "available" for this fixture.
  // If attendance was never tracked for it, fall back to the full squad.
  const matchAvailabilities = match ? getMatchAvailabilities(match.id) : [];
  const attendingIds = new Set(matchAvailabilities.filter(a => a.status === 'available').map(a => a.member_id));
  const attendingSquadPlayers = matchAvailabilities.length > 0
    ? squadPlayers.filter(p => attendingIds.has(p.id))
    : squadPlayers;

  // Active Admin Sub-Tab
  const [adminTab, setAdminTab] = useState<'events' | 'tactics' | 'clock'>('events');

  // New Fixture Modal state
  const [isCreateFixtureOpen, setIsCreateFixtureOpen] = useState(false);
  const [fixtureOpponent, setFixtureOpponent] = useState('');
  const [fixtureCompetition, setFixtureCompetition] = useState('Club Friendly');
  const [fixtureSeason, setFixtureSeason] = useState(activeSeason?.name || defaultSeasonLabel());
  const [fixtureDate, setFixtureDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
  const [fixtureVenue, setFixtureVenue] = useState(club.stadium_name);
  const [fixtureIsHome, setFixtureIsHomeState] = useState(true);
  // Away games aren't at our ground: the venue empties so the other club's ground gets typed in
  const setFixtureIsHome = (home: boolean) => {
    setFixtureIsHomeState(home);
    setFixtureVenue(v => (!home && v === club.stadium_name ? '' : home && !v ? club.stadium_name : v));
  };

  // Match Check-in & Scanner Modal
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);

  // Quick event form states
  const [eventType, setEventType] = useState<MatchEventType>('goal');
  // Phones show the six most-used event buttons; the rest open with "More events"
  const [moreEvents, setMoreEvents] = useState(false);
  // Each fixture starts on the club's own side (away games too), not always the home team
  const [sidePick, setSidePick] = useState<{ matchId: string; side: 'home' | 'away' } | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [customPlayerName, setCustomPlayerName] = useState('');
  const [selectedSubOffId, setSelectedSubOffId] = useState<string>('');
  const [selectedAssistId, setSelectedAssistId] = useState<string>('');
  const [assistName, setAssistName] = useState('');
  // The event minute follows the running clock unless the operator types one (for this match only)
  const now = useNowTick();
  const [minuteOverride, setMinuteOverride] = useState<{ matchId: string; minute: number } | null>(null);
  const eventMinute = match && minuteOverride?.matchId === match.id ? minuteOverride.minute : getLiveMinute(match, now);
  const teamSide: 'home' | 'away' = match && sidePick?.matchId === match.id ? sidePick.side : match?.is_club_home === false ? 'away' : 'home';
  const [eventDetail, setEventDetail] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  // Phones: Draft and the public page fold into "More"; the score follows down the page once the scoreboard scrolls away
  const [moreActions, setMoreActions] = useState(false);
  const scoreboardRef = useRef<HTMLDivElement>(null);
  const [scoreboardOut, setScoreboardOut] = useState(false);
  useEffect(() => {
    const el = scoreboardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Out = scrolled up past the top, not still below the fold
    const io = new IntersectionObserver(([entry]) => setScoreboardOut(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [adminTab, match?.id]);
  const [isFixModalOpen, setIsFixModalOpen] = useState<boolean>(false);
  // Format switched on the tactics pitch but not saved yet (keyed by match, so it never leaks to another fixture)
  const [pitchFormat, setPitchFormat] = useState<{ matchId: string; format: MatchFormat } | null>(null);

  // Picked players belong to one side's roster, so switching sides clears them
  const chooseSide = (side: 'home' | 'away') => {
    if (side === teamSide || !match) return;
    setSidePick({ matchId: match.id, side });
    setSelectedPlayerId('');
    setSelectedSubOffId('');
    setSelectedAssistId('');
  };

  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCreateFixture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixtureOpponent.trim()) return;

    const newFixture = addMatch({
      club_id: club.id,
      competition: fixtureCompetition,
      season: fixtureSeason,
      home_team_name: fixtureIsHome ? club.name : fixtureOpponent.trim(),
      away_team_name: fixtureIsHome ? fixtureOpponent.trim() : club.name,
      home_team_logo: fixtureIsHome ? club.logo_url : DEFAULT_CREST,
      away_team_logo: fixtureIsHome ? DEFAULT_CREST : club.logo_url,
      is_club_home: fixtureIsHome,
      match_date: new Date(fixtureDate).toISOString(),
      venue: fixtureVenue,
      status: 'upcoming',
      home_score: 0,
      away_score: 0,
      current_minute: 0,
      added_time: 0,
      period: 'pre_match',
      home_formation: '4-3-3',
      away_formation: '4-4-2',
      match_format: '11v11',
    });

    setSelectedMatchId(newFixture.id);
    setIsCreateFixtureOpen(false);
    setFixtureOpponent('');
    showFeedback(`✓ Scheduled new fixture against ${fixtureOpponent} for ${fixtureSeason} season!`);
  };

  if (!match) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 800 }}>No match fixtures found for this club.</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          Schedule a match fixture associated with a season to operate live matchday reporting.
        </p>
        <Link
          href={`/${club.slug}/admin/matches`}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          <span>Schedule First Fixture</span>
        </Link>

        {isCreateFixtureOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            background: 'var(--color-scrim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}>
            <div className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '520px', padding: '2rem', textAlign: 'left', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Schedule New Fixture</h3>
                <button onClick={() => setIsCreateFixtureOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateFixture}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="match-center-opponent-team" className="form-label">Opponent Team *</label>
                  <input id="match-center-opponent-team" type="text" required className="form-input" placeholder="e.g. Metro Rovers" value={fixtureOpponent} onChange={e => setFixtureOpponent(e.target.value)} />
                </div>
                <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="match-center-competition" className="form-label">Competition</label>
                    <input id="match-center-competition" type="text" className="form-input" value={fixtureCompetition} onChange={e => setFixtureCompetition(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="match-center-season" className="form-label">Season</label>
                    <select id="match-center-season" className="form-select" value={fixtureSeason} onChange={e => setFixtureSeason(e.target.value)}>
                      {clubSeasons.map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}
                      {!clubSeasons.some(s => s.name === fixtureSeason) && (<option value={fixtureSeason}>{fixtureSeason}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setIsCreateFixtureOpen(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Schedule Fixture</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Adjust score
  const handleScoreAdjust = (side: 'home' | 'away', delta: number) => {
    if (side === 'home') {
      const newScore = Math.max(0, match.home_score + delta);
      updateMatch(match.id, { home_score: newScore });
      showFeedback(`Updated ${match.home_team_name} score to ${newScore}`);
    } else {
      const newScore = Math.max(0, match.away_score + delta);
      updateMatch(match.id, { away_score: newScore });
      showFeedback(`Updated ${match.away_team_name} score to ${newScore}`);
    }
  };

  // Adjust match period
  const handlePeriodTransition = (period: MatchPeriod, status: any, defaultMin?: number) => {
    const updates: any = { period, status };
    if (typeof defaultMin === 'number') {
      updates.current_minute = defaultMin;
      setMinuteOverride(null);
    }
    updateMatch(match.id, updates);
    showFeedback(PERIOD_LABEL[period] || 'Match updated');
  };

  // Cup games: a shootout has its own score, kept out of the match score and players' goals
  const isCupGame = !!match.tournament_id;
  const inShootout = match.period === 'penalties';
  const handleShootoutAdjust = (side: 'home' | 'away', delta: number) => {
    const key = side === 'home' ? 'home_penalty_score' : 'away_penalty_score';
    const next = Math.max(0, (match[key] ?? 0) + delta);
    updateMatch(match.id, { [key]: next, ...(side === 'home' ? { away_penalty_score: match.away_penalty_score ?? 0 } : { home_penalty_score: match.home_penalty_score ?? 0 }) });
  };

  // Final whistle. A cup game finishes the way its tournament page does, so the winner moves on
  // to the next round and the tournament completes once every game has a result.
  const handleFullTime = () => {
    setSelectedMatchId(match.id);
    if (isCupGame) {
      const level = match.home_score === match.away_score;
      const pens = match.home_penalty_score != null && match.away_penalty_score != null
        && (match.home_penalty_score > 0 || match.away_penalty_score > 0);
      if (level && match.tournament_stage && match.tournament_stage !== 'group'
          && (!pens || match.home_penalty_score === match.away_penalty_score)) {
        showFeedback('This knockout game is level. Start the penalty shootout and enter its score before full time.', 'error');
        return;
      }
      updateTournamentMatchScore(match.id, match.home_score, match.away_score,
        level && pens ? match.home_penalty_score : undefined,
        level && pens ? match.away_penalty_score : undefined, 'completed');
      showFeedback('Full time. The result is saved to the tournament.');
    } else {
      handlePeriodTransition('full_time', 'completed', 90);
    }
    setIsAuditModalOpen(true);
  };

  // Adjust match minute
  const handleMinuteAdjust = (delta: number) => {
    const newMin = Math.max(0, Math.min(120, getLiveMinute(match) + delta));
    updateMatch(match.id, { current_minute: newMin });
    setMinuteOverride(null);
  };

  // Pause/resume the live clock in place (injury or stoppage) without
  // leaving the 'live' status/period the way switching to halftime would.
  const handleTogglePause = () => {
    if (match.is_paused) {
      updateMatch(match.id, { is_paused: false });
      showFeedback('Clock resumed');
    } else {
      updateMatch(match.id, { current_minute: getLiveMinute(match), is_paused: true });
      showFeedback('Clock paused');
    }
  };

  // Set stoppage time
  const handleSetAddedTime = (minutes: number) => {
    updateMatch(match.id, { added_time: minutes });
    showFeedback(`Stoppage time board set to +${minutes} minute${minutes > 1 ? 's' : ''}`);
  };

  // Handle Event Logging
  const handleLogEvent = (e: React.FormEvent) => {
    e.preventDefault();

    if (inShootout && (eventType === 'goal' || eventType === 'penalty')) {
      showFeedback('During the shootout, count kicks in the shootout score instead.', 'error');
      return;
    }

    const sideSquad = (teamSide === 'home' ? homePlayers : awayPlayers) ?? [];
    const isClubSelected = (teamSide === 'home' ? homePlayers : awayPlayers) !== null;

    let resolvedPlayerName = '';
    if (isClubSelected) {
      if (selectedPlayerId === 'custom') {
        resolvedPlayerName = customPlayerName.trim();
      } else {
        const found = sideSquad.find(p => p.id === selectedPlayerId);
        resolvedPlayerName = found ? found.full_name : customPlayerName.trim();
      }
    } else {
      const oppTeamName = teamSide === 'home' ? match.home_team_name : match.away_team_name;
      resolvedPlayerName = customPlayerName.trim() || `${oppTeamName} Player`;
    }

    if (!resolvedPlayerName) {
      showFeedback('Please enter or select a player name.', 'error');
      return;
    }

    let detail = eventDetail.trim();
    let assist = '';
    if (isClubSelected) {
      if (selectedAssistId === 'custom') {
        assist = assistName.trim();
      } else if (selectedAssistId !== 'none') {
        const foundAssist = sideSquad.find(p => p.id === selectedAssistId);
        assist = foundAssist ? foundAssist.full_name : '';
      }
    } else {
      assist = assistName.trim();
    }

    if (eventType === 'sub') {
      const offPlayer = sideSquad.find(p => p.id === selectedSubOffId);
      if (isClubSelected && !offPlayer) {
        showFeedback('Please select the player coming off.', 'error');
        return;
      }
      const offName = offPlayer ? offPlayer.full_name : (!isClubSelected && assist) || 'Player';
      detail = `Substitution: ${resolvedPlayerName} ON, ${offName} OFF. ${detail}`.trim();
      // The player coming off is in the detail, not an assist
      assist = '';
    }

    // Read the clock now, not at the last re-render
    const minute = Number(minuteOverride?.matchId === match.id ? minuteOverride.minute : getLiveMinute(match));
    addMatchEvent({
      match_id: match.id,
      club_id: club.id,
      minute,
      event_type: eventType,
      team_side: teamSide,
      player_name: resolvedPlayerName,
      assist_player_name: assist || undefined,
      detail_text: detail || undefined,
    });

    showFeedback(`Logged ${EVENT_LABEL[eventType] || eventType} for ${resolvedPlayerName} (${minute}')`);
    setEventDetail('');
    setAssistName('');
    setSelectedAssistId('');
    setSelectedPlayerId('');
    setCustomPlayerName('');
    setMinuteOverride(null);
  };

  // Delete event with automatic score reversal
  const handleDeleteEvent = (eventId: string, eventSummary: string) => {
    deleteMatchEvent(eventId);
    showFeedback(`Removed event: ${eventSummary}`);
  };

  // Save Tactical Lineup to Match
  const handleSaveTacticalLineup = (formationName: string, positions: PitchPosition[]) => {
    updateMatch(match.id, {
      [`${lineupSide}_formation`]: formationName,
      [`${lineupSide}_lineup_coords`]: positions,
      // The format picked on the pitch (11v11 / 9v9 / 7v7), else the one already published
      match_format: pitchFormat?.matchId === match.id ? pitchFormat.format : match.match_format,
    });
    showFeedback(`Tactical lineup & ${formationName} formation published live to Match Centre!`);
  };

  // Full time and stats not saved yet: the one moment "Save Player Stats" should stand out
  const statsDue = match.status === 'completed' && !match.is_audited;

  return (
    <div>
      {/* Header (trimmed on phones so the scoreboard is near the top) */}
      <div className="admin-head mc-header">
        <div>
          <h1>Match Centre</h1>
          <p className="mc-phone-hide">
            Update the live score, added time, substitutions and team formation while a match is on.
          </p>
        </div>

        <div className="admin-head-actions admin-match-center-actions" data-more={moreActions ? 'open' : undefined}>
          {match.tournament_id && (
            <Link href={`/${club.slug}/admin/tournaments/${match.tournament_id}`} className="btn btn-secondary btn-sm touch-target">
              <Trophy size={15} aria-hidden="true" />
              <span>Bracket and table</span>
            </Link>
          )}
          {/* Gate check-in is for club games; tournament and in-house games keep it under More on phones */}
          <button
            type="button"
            onClick={() => setIsCheckinModalOpen(true)}
            className={`btn btn-secondary btn-sm touch-target${kind === 'club' ? '' : ' mc-action-extra'}`}
            title="Scan pass QR code via camera or enter token to check in attendees"
          >
            <QrCode size={15} aria-hidden="true" />
            <span>Door check-in ({match.checkin_count || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => (match.is_audited ? setIsFixModalOpen(true) : setIsAuditModalOpen(true))}
            title={match.is_audited ? 'Stats are saved: open them to fix a mistake' : undefined}
            // Only a call to action once the game is over: before that it's a quiet button
            className={`btn btn-sm touch-target ${statsDue && !match.is_audited ? 'btn-primary' : 'btn-secondary'}`}
          >
            {match.is_audited ? <CheckCircle2 size={15} aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
            <span>{match.is_audited ? 'Stats saved, fix them' : 'Save player stats'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm touch-target mc-actions-more-toggle"
            aria-expanded={moreActions}
            onClick={() => setMoreActions(v => !v)}
          >
            <MoreHorizontal size={15} aria-hidden="true" />
            <span>{moreActions ? 'Less' : 'More'}</span>
          </button>

          <Link
            href={`/${club.slug}/admin/lineup/draft?match=${match.id}`}
            className="btn btn-secondary btn-sm touch-target mc-action-extra"
          >
            <Layers size={14} aria-hidden="true" />
            <span>Lineup workbench</span>
          </Link>

          <Link
            href={matchPath(club.slug, match)}
            target="_blank"
            className="btn btn-secondary btn-sm touch-target mc-action-extra"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>Public match page</span>
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div role="status" className={feedback.type === 'error' ? 'admin-flash is-error' : 'admin-flash'}>
          {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Which kind of game: club games, tournaments or in-house (only when the club has more than one kind) */}
      <MatchKindSwitch games={filteredMatches} active={kind} onPick={k => pickGame(kindGames(k))} />

      {/* Fixture Selector Dropdown & Season Controls */}
      <div className="glass-panel mc-fixture-bar" style={{ padding: 'clamp(0.85rem, 2.5vw, 1.25rem)', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
            {/* Season Filter Dropdown */}
            <div className="mc-phone-hide" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 'min(160px, 100%)' }}>
              <span className="form-label m-0" style={{ flexShrink: 0 }}>Season</span>
              <select data-view-ok aria-label="Season"
                className="form-select"
                style={{ width: '100%', maxWidth: '140px', padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
                value={seasonFilter}
                onChange={e => setSeasonFilter(e.target.value)}
              >
                <option value="ALL">All seasons</option>
                {clubSeasons.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name}{s.is_current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {kind === 'tournament' && kindTournaments.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 'min(200px, 100%)', maxWidth: '100%' }}>
                <span className="form-label m-0" style={{ flexShrink: 0 }}>Tournament</span>
                <select data-view-ok aria-label="Tournament"
                  className="form-select"
                  style={{ width: '100%', maxWidth: '100%' }}
                  value={match.tournament_id || ''}
                  onChange={e => pickGame(filteredMatches.filter(m => m.tournament_id === e.target.value))}
                >
                  {kindTournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 'min(200px, 100%)', maxWidth: '100%' }}>
              <span className="form-label m-0" style={{ flexShrink: 0 }}>{kind === 'tournament' ? 'Game' : 'Fixture'}</span>
              <select data-view-ok aria-label="Fixture"
                className="form-select"
                style={{ width: '100%', maxWidth: '100%' }}
                value={match?.id || ''}
                onChange={e => setSelectedMatchId(e.target.value)}
              >
                {pickerGames.map(m => (
                  <option key={m.id} value={m.id}>
                    {kind === 'tournament'
                      ? `${[tournamentMatchLabel(m), `${m.home_team_name} vs ${m.away_team_name}`, m.pitch_label].filter(Boolean).join(', ')} (${m.status})`
                      : `${fixtureLabel(m, club.name)}, ${m.season} (${m.status})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mc-phone-hide" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', width: 'auto' }}>
            <span className="admin-pill">{match.season}</span>
            <span className="admin-pill">Formation {match[`${lineupSide}_formation`] || '4-3-3'}</span>
            {match.added_time > 0 && <span className="admin-pill is-warn">+{match.added_time}&prime; added time</span>}
            <Link href={`/${club.slug}/admin/matches`} className="btn btn-secondary btn-sm touch-target">
              <CalendarDays size={14} aria-hidden="true" />
              <span>Schedule a fixture</span>
            </Link>
          </div>
        </div>

        {/* What kind of game this is, and where its result goes */}
        <div className="mc-context">
          {kind === 'tournament' ? (
            <>
              <span className="badge badge-gold">
                <Trophy size={12} aria-hidden="true" />
                {[matchTournament?.name, match.tournament_group && `Group ${match.tournament_group}`, tournamentMatchLabel(match)].filter(Boolean).join(', ')}
              </span>
              {match.pitch_label && <span className="badge mc-badge-muted">{match.pitch_label}</span>}
            </>
          ) : kind === 'inhouse' ? (
            <span className="badge mc-badge-muted"><ArrowLeftRight size={12} aria-hidden="true" /> In-house game</span>
          ) : (
            <>
              {match.competition && <span className="badge badge-primary">{match.competition}</span>}
              <span className="badge mc-badge-muted">{match.is_club_home === false ? 'Away' : 'Home'}</span>
            </>
          )}
          <span className="mc-context-note">
            {kind === 'tournament'
              ? "Saved to the tournament's table and bracket. Doesn't count toward the club's win/loss record."
              : kind === 'inhouse'
                ? "Your own teams against each other. Doesn't count toward the club's win/loss record."
                : "Counts toward the club's win/loss record."}
          </span>
        </div>

        {/* Tournament day: the games on the pitches now, one tap apart */}
        {pitchBoard.length > 0 && (
          <div className="mc-pitch-board-wrap">
            <span className="mc-pitch-board-title">On the pitches now</span>
            <div className="mc-pitch-board">
              {pitchBoard.map(g => {
                const live = isLiveGame(g);
                return (
                  <button data-view-ok
                    key={g.id}
                    type="button"
                    className={`mc-pitch-card${g.id === match.id ? ' is-open' : ''}${live ? '' : ' is-next'}`}
                    aria-pressed={g.id === match.id}
                    onClick={() => setSelectedMatchId(g.id)}
                  >
                    <span className="mc-pitch-card-top">
                      <span>{live ? g.pitch_label || tournamentMatchLabel(g) || 'Live' : 'Up next'}</span>
                      {live
                        ? <span className="mc-pitch-card-min"><span className="pulse-dot" aria-hidden="true" /><span>{g.status === 'halftime' ? 'HT' : <><LiveMinute match={g} />&apos;</>}</span></span>
                        : <span>{g.match_time || ''}</span>}
                    </span>
                    <span className="mc-pitch-card-row"><span>{g.home_team_name}</span><b>{live ? g.home_score ?? 0 : '–'}</b></span>
                    <span className="mc-pitch-card-row"><span>{g.away_team_name}</span><b>{live ? g.away_score ?? 0 : '–'}</b></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tabs: Event Console vs Tactical Pitch vs Clock & Periods */}
      <div role="tablist" aria-label="Match Centre" className="admin-tabs mc-tabs">
        {[
          { id: 'events', label: 'Score and events', short: 'Score', icon: Radio },
          { id: 'tactics', label: 'Lineup and formation', short: 'Lineup', icon: Move },
          { id: 'clock', label: 'Clock and added time', short: 'Clock', icon: Timer },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = adminTab === tab.id;
          return (
            <button data-view-ok
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setAdminTab(tab.id as any)}
              className="admin-tab"
            >
              <Icon size={16} aria-hidden="true" />
              <span className="mc-phone-hide">{tab.label}</span>
              <span className="mc-phone-only">{tab.short}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE SCORE & EVENT CONSOLE */}
      {/* ========================================================================= */}
      {adminTab === 'events' && (
        <div className="mc-console">
          {/* Phones: the score and clock stay in view while an event is logged further down */}
          {scoreboardOut && (
            <div className="mc-score-float glass-panel" data-theme="dark" aria-hidden="true">
              <span className="mc-score-float-min"><LiveMinute match={match} />&apos;</span>
              <span className="mc-score-float-team">{match.home_team_name}</span>
              <span className="mc-score-float-score">{match.home_score ?? 0} - {match.away_score ?? 0}</span>
              <span className="mc-score-float-team">{match.away_team_name}</span>
            </div>
          )}

          {/* The score and the clock */}
          <section ref={scoreboardRef} className="glass-panel mc-scoreboard" aria-label="Score and clock">
            <div className="mc-clock-bar">
              <div className="row row-loose row-wrap">
                <div className={match.status === 'live' ? 'mc-clock is-live' : 'mc-clock'}>
                  <Clock size={20} aria-hidden="true" />
                  <span><LiveMinute match={match} />&prime;</span>
                  {match.added_time > 0 && <small>+{match.added_time}&prime;</small>}
                </div>

                <div className="mc-clock-tools">
                  <button type="button" onClick={() => handleMinuteAdjust(-1)} className="btn btn-secondary btn-sm" aria-label="Take a minute off the clock">
                    <Minus size={13} aria-hidden="true" /> 1 min
                  </button>
                  <button type="button" onClick={() => handleMinuteAdjust(1)} className="btn btn-secondary btn-sm" aria-label="Add a minute to the clock">
                    <Plus size={13} aria-hidden="true" /> 1 min
                  </button>
                  {match.status === 'live' && RUNNING_PERIODS.has(match.period) && (
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className={match.is_paused ? 'btn btn-secondary btn-sm mc-pause is-paused' : 'btn btn-secondary btn-sm mc-pause'}
                      aria-pressed={!!match.is_paused}
                      title={match.is_paused ? 'Resume clock' : 'Pause clock (injury or stoppage)'}
                    >
                      {match.is_paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Quick period changes */}
              <div className="mc-periods" role="group" aria-label="Period">
                <button type="button" className="mc-period" aria-pressed={match.period === 'first_half'} onClick={() => handlePeriodTransition('first_half', 'live', 1)}>1st half</button>
                <button type="button" className="mc-period" aria-pressed={match.period === 'halftime'} onClick={() => handlePeriodTransition('halftime', 'halftime', 45)}>Half time</button>
                <button type="button" className="mc-period" aria-pressed={match.period === 'second_half'} onClick={() => handlePeriodTransition('second_half', 'live', 46)}>2nd half</button>
                <button type="button" className="mc-period" aria-pressed={match.status === 'completed'} onClick={handleFullTime}>Full time</button>
              </div>
            </div>

            <div className="mc-score">
              {(['home', 'away'] as const).map((side, i) => (
                <React.Fragment key={side}>
                  {i === 1 && <div className="mc-score-sep" aria-hidden="true">:</div>}
                  <div className="mc-score-side">
                    <div className="mc-score-name">{side === 'home' ? match.home_team_name : match.away_team_name}</div>
                    <div className="mc-score-ctrl">
                      <button type="button" onClick={() => handleScoreAdjust(side, -1)} className="btn btn-secondary" aria-label={`Take a goal off ${side === 'home' ? match.home_team_name : match.away_team_name}`}>
                        <Minus size={15} aria-hidden="true" />
                      </button>
                      <span className="mc-goals">{side === 'home' ? match.home_score : match.away_score}</span>
                      <button type="button" onClick={() => handleScoreAdjust(side, 1)} className="btn btn-primary" aria-label={`Add a goal for ${side === 'home' ? match.home_team_name : match.away_team_name}`}>
                        <Plus size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Tournament day: straight on to the next game on this pitch */}
          {nextGameOnPitch && (
            <button data-view-ok type="button" className="glass-panel mc-next-game" onClick={() => setSelectedMatchId(nextGameOnPitch.id)}>
              <span style={{ minWidth: 0 }}>
                <span className="mc-next-game-when">
                  Next{nextGameOnPitch.pitch_label ? ` on ${nextGameOnPitch.pitch_label}` : ''}{nextGameOnPitch.match_time ? `, ${nextGameOnPitch.match_time}` : ''}
                </span>
                <span className="mc-next-game-teams">{nextGameOnPitch.home_team_name} vs {nextGameOnPitch.away_team_name}</span>
              </span>
              <span className="btn btn-secondary btn-sm" aria-hidden="true">Open <ChevronRight size={14} /></span>
            </button>
          )}

          {/* Event Logger Form */}
          {(() => {
            const selectedSquad = teamSide === 'home' ? homePlayers : awayPlayers;
            const isClubSelected = selectedSquad !== null;
            const clubSides = (['home', 'away'] as const).filter(s => (s === 'home' ? homePlayers : awayPlayers) !== null);
            const sideName = (s: 'home' | 'away') => (s === 'home' ? match.home_team_name : match.away_team_name);
            const sideTag = (s: 'home' | 'away') => {
              const venue = s === 'home' ? 'Home' : 'Away';
              if (clubSides.length !== 1) return venue;
              return `${clubSides[0] === s ? 'Our Club' : 'Opponent'} - ${venue}`;
            };

            type QuickAction = { key: string; label: string; eventType: MatchEventType; side: 'home' | 'away'; tone: 'good' | 'bad' | 'card' | 'sub'; team?: string };
            let quickActions: QuickAction[];
            if (clubSides.length === 1) {
              // A normal fixture: the club against an outside opponent
              const ourSide = clubSides[0];
              const oppSide: 'home' | 'away' = ourSide === 'home' ? 'away' : 'home';
              quickActions = [
                { key: 'goal-us', label: 'Goal', eventType: 'goal', side: ourSide, tone: 'good' },
                { key: 'goal-opp', label: 'Opponent goal', eventType: 'goal', side: oppSide, tone: 'bad' },
                { key: 'penalty-us', label: 'Penalty', eventType: 'penalty', side: ourSide, tone: 'good' },
                { key: 'penalty-opp', label: 'Opponent penalty', eventType: 'penalty', side: oppSide, tone: 'bad' },
                // An own goal is logged on the side of the player who scored it; the goal counts for the other side
                { key: 'og-opp', label: 'Opponent own goal', eventType: 'own_goal', side: oppSide, tone: 'good' },
                { key: 'og-us', label: 'Own goal (ours)', eventType: 'own_goal', side: ourSide, tone: 'bad' },
                { key: 'yellow-us', label: 'Yellow card', eventType: 'yellow_card', side: ourSide, tone: 'card' },
                { key: 'yellow-opp', label: 'Opponent yellow', eventType: 'yellow_card', side: oppSide, tone: 'card' },
                { key: 'red-us', label: 'Red card', eventType: 'red_card', side: ourSide, tone: 'bad' },
                { key: 'red-opp', label: 'Opponent red', eventType: 'red_card', side: oppSide, tone: 'bad' },
                { key: 'sub-us', label: 'Substitution', eventType: 'sub', side: ourSide, tone: 'sub' },
                { key: 'sub-opp', label: 'Opponent sub', eventType: 'sub', side: oppSide, tone: 'sub' },
              ];
            } else {
              // Both sides are the club's own teams (or both outside teams): the same actions for each, named per team
              const perSide: Omit<QuickAction, 'key' | 'side' | 'team'>[] = [
                { label: 'Goal', eventType: 'goal', tone: 'good' },
                { label: 'Penalty', eventType: 'penalty', tone: 'good' },
                { label: 'Own goal', eventType: 'own_goal', tone: 'bad' },
                { label: 'Yellow card', eventType: 'yellow_card', tone: 'card' },
                { label: 'Red card', eventType: 'red_card', tone: 'bad' },
                { label: 'Substitution', eventType: 'sub', tone: 'sub' },
              ];
              quickActions = perSide.flatMap(a => (['home', 'away'] as const).map(side => ({
                ...a, key: `${a.eventType}-${side}`, side, team: sideName(side),
              })));
            }

            // Shootout kicks go in the shootout score below, not the match score or players' goals
            if (inShootout) quickActions = quickActions.filter(a => a.eventType !== 'goal' && a.eventType !== 'penalty' && a.eventType !== 'own_goal');

            // The buttons a phone shows before "More events": goals, yellows, a sub and a penalty
            const PHONE_FIRST = new Set(clubSides.length === 1
              ? ['goal-us', 'goal-opp', 'penalty-us', 'yellow-us', 'yellow-opp', 'sub-us']
              : ['goal-home', 'goal-away', 'yellow_card-home', 'yellow_card-away', 'sub-home', 'sub-away']);
            const foldedCount = quickActions.filter(a => !PHONE_FIRST.has(a.key)).length + 2;

            // One-tap player picking: the side's saved line-up (or a small squad), not a search box
            const sideLineupIds = ((teamSide === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || [])
              .map(p => p.member_id).filter((id): id is string => !!id);
            const chipPlayers = !selectedSquad || eventType === 'sub' || eventType === 'commentary' || eventType === 'whistle' ? []
              : sideLineupIds.length ? sideLineupIds.map(id => selectedSquad.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)
              : selectedSquad.length <= 20 ? [...selectedSquad].sort(byShirtNumber) : [];

            const otherActions: { key: string; label: string; eventType: MatchEventType }[] = [
              { key: 'commentary', label: 'Commentary', eventType: 'commentary' },
              { key: 'whistle', label: 'Period whistle', eventType: 'whistle' },
            ];

            return (
              <section className="glass-panel mc-form" aria-labelledby="mc-form-title">
                {inShootout && (
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'rgba(var(--tint-rgb), 0.04)' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Penalty shootout</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                      Count the scored kicks here. They don&apos;t change the match score or players&apos; goals.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
                      {(['home', 'away'] as const).map(side => (
                        <div key={side} className="row" style={{ justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {side === 'home' ? match.home_team_name : match.away_team_name}
                          </span>
                          <div className="row" style={{ gap: '0.4rem', flexShrink: 0 }}>
                            <button type="button" className="btn btn-secondary btn-sm touch-target" aria-label={`Remove a shootout goal for ${side === 'home' ? match.home_team_name : match.away_team_name}`} onClick={() => handleShootoutAdjust(side, -1)}>−</button>
                            <span style={{ fontSize: '1.3rem', fontWeight: 900, minWidth: '2ch', textAlign: 'center', color: 'var(--text-primary)' }}>
                              {(side === 'home' ? match.home_penalty_score : match.away_penalty_score) ?? 0}
                            </span>
                            <button type="button" className="btn btn-secondary btn-sm touch-target" aria-label={`Add a shootout goal for ${side === 'home' ? match.home_team_name : match.away_team_name}`} onClick={() => handleShootoutAdjust(side, 1)}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 id="mc-form-title">Log an event</h3>

                <form onSubmit={handleLogEvent}>
                  {/* Quick Action Buttons */}
                  <div className="form-group">
                    <label className="form-label">Event</label>
                    <div data-more={moreEvents ? 'open' : undefined} className="mc-events" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 120px), 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {quickActions.map(a => {
                        const isActive = eventType === a.eventType && teamSide === a.side;
                        return (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => { setEventType(a.eventType); chooseSide(a.side); }}
                            aria-pressed={isActive}
                            data-tone={a.tone}
                            // A folded button stays in view while it's the one picked
                            className={`mc-event-btn${PHONE_FIRST.has(a.key) || isActive ? '' : ' mc-more'}`}
                          >
                            <EventIcon type={a.eventType} size={20} />
                            <span>{a.label}</span>
                            {a.team && <small>{a.team}</small>}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mc-more-toggle"
                      aria-expanded={moreEvents}
                      onClick={() => setMoreEvents(v => !v)}
                    >
                      {moreEvents ? 'Fewer events' : `More events (${foldedCount})`}
                    </button>

                    {/* Less-common events */}
                    <div data-more={moreEvents ? 'open' : undefined} className="mc-events mc-more" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {otherActions.map(a => {
                        const isActive = eventType === a.eventType;
                        return (
                          <button
                            key={a.key}
                            type="button"
                            onClick={() => setEventType(a.eventType)}
                            aria-pressed={isActive}
                            className="mc-event-btn is-inline"
                          >
                            <EventIcon type={a.eventType} size={16} />
                            <span>{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mc-side-minute" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem', margin: '1.25rem 0' }}>
                    <div className="form-group m-0">
                      <label htmlFor="match-center-team-side" className="form-label">Team</label>
                      <select id="match-center-team-side"
                        className="form-select"
                        value={teamSide}
                        onChange={e => chooseSide(e.target.value as 'home' | 'away')}
                      >
                        <option value="home">{match.home_team_name} ({sideTag('home')})</option>
                        <option value="away">{match.away_team_name} ({sideTag('away')})</option>
                      </select>
                    </div>

                    <div className="form-group m-0">
                      <label htmlFor="match-center-match-minute" className="form-label">Minute</label>
                      <input id="match-center-match-minute"
                        type="number"
                        min={0}
                        max={120}
                        className="form-input"
                        value={eventMinute}
                        onChange={e => setMinuteOverride({ matchId: match.id, minute: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Dynamic Player Selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    {isClubSelected ? (
                      <div className="form-group">
                        <label className="form-label">
                          {eventType === 'sub' ? 'Player coming on *' : 'Player *'}
                        </label>
                        {chipPlayers.length > 0 && (
                          <div className="mc-player-chips" role="group" aria-label="Tap a player">
                            {chipPlayers.map(p => (
                              <button key={p.id} type="button" className="mc-player-chip touch-target" aria-pressed={selectedPlayerId === p.id} onClick={() => setSelectedPlayerId(p.id)}>
                                {p.jersey_number != null && <span className="mc-player-chip-num">{p.jersey_number}</span>}
                                <span className="mc-player-chip-name">{p.full_name.split(' ')[0]}{p.full_name.includes(' ') ? ` ${p.full_name.split(' ').slice(-1)[0][0]}.` : ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <PlayerSearchSelect
                          id="player-involved-search"
                          players={selectedSquad ?? []}
                          value={selectedPlayerId}
                          onChange={setSelectedPlayerId}
                          extraOptions={[{ value: 'custom', label: 'Someone else (type a name)' }]}
                        />

                        {selectedPlayerId === 'custom' && (
                          <input aria-label="Player name"
                            type="text"
                            required
                            className="form-input"
                            placeholder="Enter player name"
                            style={{ marginTop: '0.5rem' }}
                            value={customPlayerName}
                            onChange={e => setCustomPlayerName(e.target.value)}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="form-group">
                        <label htmlFor="match-center-opponent-player-name" className="form-label">Opponent player *</label>
                        <input id="match-center-opponent-player-name"
                          type="text"
                          required
                          className="form-input"
                          placeholder="e.g. Leo Silva"
                          value={customPlayerName}
                          onChange={e => setCustomPlayerName(e.target.value)}
                        />
                      </div>
                    )}

                    {/* If Substitution: Select player coming OFF */}
                    {eventType === 'sub' && isClubSelected ? (
                      <div className="form-group">
                        <label className="form-label">Player coming off *</label>
                        <PlayerSearchSelect
                          id="player-sub-off-search"
                          players={selectedSquad ?? []}
                          value={selectedSubOffId}
                          onChange={setSelectedSubOffId}
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">{eventType === 'sub' ? 'Player coming off (optional)' : 'Assist (optional)'}</label>
                        {isClubSelected ? (
                          <>
                            <PlayerSearchSelect
                              id="player-assist-search"
                              players={selectedSquad ?? []}
                              value={selectedAssistId}
                              onChange={setSelectedAssistId}
                              extraOptions={[
                                { value: 'none', label: 'None' },
                                { value: 'custom', label: 'Someone else (type a name)' },
                              ]}
                            />
                            {selectedAssistId === 'custom' && (
                              <input aria-label="Assist player name"
                                type="text"
                                className="form-input"
                                placeholder="Enter player name"
                                style={{ marginTop: '0.5rem' }}
                                value={assistName}
                                onChange={e => setAssistName(e.target.value)}
                              />
                            )}
                          </>
                        ) : (
                          <input aria-label="Assist player name"
                            type="text"
                            className="form-input"
                            placeholder="Player name"
                            value={assistName}
                            onChange={e => setAssistName(e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <details className="form-group mc-note" open={!!eventDetail || undefined}>
                    <summary className="form-label" style={{ cursor: 'pointer' }}>Add a note (optional)</summary>
                    <label htmlFor="match-center-event-detail-tactical-notes" className="sr-only">Note</label>
                    <input id="match-center-event-detail-tactical-notes"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Curling strike into top corner after neat combination play."
                      value={eventDetail}
                      onChange={e => setEventDetail(e.target.value)}
                    />
                  </details>

                  {/* Stays in reach on phones while the form scrolls */}
                  <div className="mc-log-submit" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary touch-target" style={{ minWidth: 'min(180px, 100%)' }}>
                      <Send size={16} aria-hidden="true" />
                      <span>Log event</span>
                    </button>
                  </div>
                </form>
              </section>
            );
          })()}

          {/* The match log; deleting a goal takes it off the score too */}
          <section className="glass-panel mc-log-panel" aria-labelledby="mc-log-title">
            <h3 id="mc-log-title">Match log <small>{events.length} {events.length === 1 ? 'event' : 'events'}</small></h3>
            {events.length === 0 ? (
              <p className="admin-empty" style={{ padding: 0 }}>Nothing logged yet. Goals, cards and substitutions appear here as you log them.</p>
            ) : (
              <ol className="mc-log">
                {events.map(evt => (
                  <li key={evt.id}>
                    <span className="mc-log-min">{evt.minute}&prime;</span>
                    <div className="mc-log-what">
                      <span className="mc-log-kind">
                        <EventIcon type={evt.event_type} size={14} />
                        {(EVENT_LABEL[evt.event_type] || evt.event_type.replace('_', ' ')).replace(/^./, c => c.toUpperCase())}
                      </span>
                      <b>{evt.player_name}</b>
                      <small>
                        {[evt.team_side === 'home' ? match.home_team_name : match.away_team_name, evt.assist_player_name && `assist ${evt.assist_player_name}`].filter(Boolean).join(', ')}
                        {evt.detail_text && <><br />{evt.detail_text}</>}
                      </small>
                    </div>
                    <button data-needs-full
                      type="button"
                      onClick={() => handleDeleteEvent(evt.id, `${EVENT_LABEL[evt.event_type] || evt.event_type} (${evt.minute}')`)}
                      className="admin-icon-btn is-danger"
                      aria-label={`Delete ${EVENT_LABEL[evt.event_type] || evt.event_type} at ${evt.minute} minutes`}
                      title="Delete event and revert score if goal"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TACTICAL PITCH & FREE-FORM FORMATIONS */}
      {/* ========================================================================= */}
      {adminTab === 'tactics' && (
        <div className="admin-stack">
          <section className="glass-panel mc-form" aria-labelledby="mc-tactics-title">
            <h3 id="mc-tactics-title">Lineup and formation</h3>
            <p className="admin-table-foot" style={{ marginTop: 'calc(var(--space-sm) * -1)' }}>
              Pick a preset (4-3-3, 4-2-3-1, 4-4-2, 3-5-2, 3-2-4-1) or drag players into your own shape, then Save Shape to show it on the live match page.
            </p>
          </section>

          {/* Interactive Tactical Pitch */}
          <div className="glass-panel" style={{ padding: 'clamp(0.75rem, 2vw, 1.75rem)' }}>
            <TacticalPitch
              players={(lineupSide === 'home' ? homePlayers : awayPlayers) ?? squadPlayers}
              formation={match[`${lineupSide}_formation`] || '4-3-3'}
              matchFormat={match.match_format}
              onFormatChange={format => setPitchFormat({ matchId: match.id, format })}
              savedPositions={match[`${lineupSide}_lineup_coords`]}
              primaryColor={club.primary_color}
              isEditable={true}
              matchEvents={events}
              onSaveFormation={handleSaveTacticalLineup}
              teamName={match.is_club_home ? match.home_team_name : match.away_team_name}
              allowOrientationToggle={true}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CLOCK & ADDED TIME */}
      {/* ========================================================================= */}
      {adminTab === 'clock' && (
        <div className="admin-two">
          {/* Added time, as the fourth official shows it */}
          <section className="glass-panel mc-form" aria-labelledby="mc-added-title">
            <h3 id="mc-added-title">Added time</h3>
            <div className="mc-added">
              <span>Shown on the match page</span>
              <b>+{match.added_time}&prime;</b>
            </div>
            <div className="mc-added-picks" role="group" aria-label="Set added time">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 10].map(mins => (
                <button key={mins} type="button" className="mc-period" aria-pressed={match.added_time === mins} onClick={() => handleSetAddedTime(mins)}>
                  +{mins}&prime;
                </button>
              ))}
            </div>
          </section>

          {/* Period changes, in the order a game runs */}
          <section className="glass-panel mc-form" aria-labelledby="mc-period-title">
            <h3 id="mc-period-title">Periods</h3>
            {match.status === 'live' && RUNNING_PERIODS.has(match.period) && (
              <button
                type="button"
                onClick={handleTogglePause}
                className={match.is_paused ? 'btn btn-secondary mc-pause is-paused mc-period-row' : 'btn btn-secondary mc-pause mc-period-row'}
                aria-pressed={!!match.is_paused}
              >
                <span className="row">
                  {match.is_paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
                  {match.is_paused ? 'Resume the clock' : 'Pause the clock (injury or stoppage)'}
                </span>
                {match.is_paused && <span className="admin-pill is-warn">Paused</span>}
              </button>
            )}
            <div className="mc-period-list">
              {([
                { label: 'Kick-off, first half', mark: '1′', go: () => handlePeriodTransition('first_half', 'live', 1) },
                { label: 'Half time whistle', mark: '45′', go: () => handlePeriodTransition('halftime', 'halftime', 45) },
                { label: 'Kick-off, second half', mark: '46′', go: () => handlePeriodTransition('second_half', 'live', 46) },
                { label: 'Extra time (cup or knockout)', mark: '91′', go: () => handlePeriodTransition('extra_time', 'live', 91) },
                { label: 'Penalty shootout', mark: 'Pens', go: () => handlePeriodTransition('penalties', 'live', 120) },
              ]).map(p => (
                <button key={p.label} type="button" className="btn btn-secondary mc-period-row" onClick={p.go}>
                  <span>{p.label}</span>
                  <span className="admin-pill">{p.mark}</span>
                </button>
              ))}
              <button type="button" className="btn btn-primary mc-period-row" onClick={handleFullTime}>
                <span>Full time, then save player stats</span>
                <span className="admin-pill">FT</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Post-Match Stats Audit Modal */}
      {/* Mounted per match, so its ticks start from this fixture (not the one open before) */}
      {isAuditModalOpen && (
        <StatsAuditModal
          key={match.id}
          match={match}
          events={events}
          squadPlayers={attendingSquadPlayers}
          isOpen
          onClose={() => setIsAuditModalOpen(false)}
          onAuditCompleted={() => {
            showFeedback('Player stats saved to the season.');
          }}
        />
      )}

      {/* Fix saved stats: season totals and points move by the difference */}
      {isFixModalOpen && match.is_audited && (
        <StatsFixModal
          key={match.id}
          match={match}
          players={squadPlayers}
          onClose={() => setIsFixModalOpen(false)}
          onFixed={msg => showFeedback(msg)}
        />
      )}

      {/* Matchday Turnstile Gate Check-In & Scanner Modal */}
      <QRScannerModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        mode="match_checkin"
        targetMatch={match}
      />

      {/* Schedule Fixture Modal */}
      {isCreateFixtureOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: 'var(--color-scrim)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            margin: 'auto',
            width: '100%',
            maxWidth: '560px',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-drawer)',
          }}>
            <div className="section-head">
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarDays size={20} color="var(--club-primary)" />
                Schedule Match Fixture
              </h3>
              <button
                onClick={() => setIsCreateFixtureOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFixture}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="match-center-opponent-club-name" className="form-label">Opponent Club Name *</label>
                <input id="match-center-opponent-club-name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Metro Rovers, St. Jude United"
                  value={fixtureOpponent}
                  onChange={e => setFixtureOpponent(e.target.value)}
                />
              </div>

              <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="match-center-competition-2" className="form-label">Competition</label>
                  <input id="match-center-competition-2"
                    type="text"
                    className="form-input"
                    value={fixtureCompetition}
                    onChange={e => setFixtureCompetition(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="match-center-associated-season" className="form-label">Associated Season *</label>
                  <select id="match-center-associated-season"
                    className="form-select"
                    value={fixtureSeason}
                    onChange={e => setFixtureSeason(e.target.value)}
                  >
                    {clubSeasons.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.is_current ? '(Current Active)' : ''}
                      </option>
                    ))}
                    {!clubSeasons.some(s => s.name === fixtureSeason) && (
                      <option value={fixtureSeason}>{fixtureSeason}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label htmlFor="match-center-kickoff-date-time" className="form-label">Kickoff Date & Time *</label>
                  <input id="match-center-kickoff-date-time"
                    type="datetime-local"
                    required
                    className="form-input"
                    value={fixtureDate}
                    onChange={e => setFixtureDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="match-center-venue-home-ground" className="form-label">Venue / Home Ground</label>
                  <input id="match-center-venue-home-ground"
                    type="text"
                    className="form-input"
                    value={fixtureVenue}
                    onChange={e => setFixtureVenue(e.target.value)}
                  />
                </div>
              </div>

              <div style={{
                background: 'rgba(var(--tint-rgb), 0.03)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
              }} onClick={() => setFixtureIsHome(!fixtureIsHome)}>
                <input
                  type="checkbox"
                  id="fixtureHomeCheck"
                  checked={fixtureIsHome}
                  onChange={e => setFixtureIsHome(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--club-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="fixtureHomeCheck" style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {club.name} is the Home Team (Playing at {club.stadium_name})
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateFixtureOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Schedule Fixture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
