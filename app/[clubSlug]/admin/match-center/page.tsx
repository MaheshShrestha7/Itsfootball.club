'use client';

import React, { useState, use, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { offerLineupAppearances } from '@/components/offerLineupAppearances';
import { Match, MatchEventType, MatchFormat, MatchPeriod, PitchPosition, isPlayerMember } from '@/lib/supabase/types';
import TacticalPitch from '@/components/TacticalPitch';
import {
  Radio,
  Play,
  Pause,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
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
  AlertTriangle,
  Share2,
} from 'lucide-react';
import StatsAuditModal from '@/components/StatsAuditModal';
import MatchKindSwitch from '@/components/admin/MatchKindSwitch';
import StatsFixModal from '@/components/StatsFixModal';
import QRScannerModal from '@/components/QRScannerModal';
import LiveMinute from '@/components/LiveMinute';
import { fixtureLabel } from '@/lib/fixture-label';
import { getLiveMinute, RUNNING_PERIODS } from '@/lib/match-clock';
import { clockLabel, compareEventMinute, eventMinuteLabel, extraHalfMinutes, fullMinutes, halfMinutes, maxMinute, periodStartMinute, splitMinute } from '@/lib/match-length';
import { defaultSeasonLabel } from '@/lib/season';
import { clubLineupSide, clubSidePlayers, compareTournamentMatches, nextOnPitch, tournamentMatchLabel } from '@/lib/tournament-engine';
import { DEFAULT_CREST } from '@/lib/crest';
import { goalScoringSide, squadForMatch } from '@/lib/teams';
import LocalTime from '@/components/LocalTime';
import { defaultFixture, kickoff, matchKind, type MatchKind } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import PopupPanel from '@/components/PopupPanel';
import MatchEventSheet, { type SheetMode, type SheetResult } from '@/components/admin/MatchEventSheet';

// What the confirmation line says, in words rather than codes
const EVENT_LABEL: Partial<Record<MatchEventType, string>> = {
  goal: 'goal', penalty: 'penalty goal', own_goal: 'own goal', yellow_card: 'yellow card', red_card: 'red card',
  sub: 'substitution', var: 'VAR review', commentary: 'commentary', whistle: 'whistle',
};
const PERIOD_LABEL: Partial<Record<MatchPeriod, string>> = {
  pre_match: 'Back to before kick-off', first_half: 'First half started', halftime: 'Half time',
  second_half: 'Second half started', extra_time: 'Extra time started', penalties: 'Penalty shootout', full_time: 'Full time',
};

// The period as the scoreboard names it
const PERIOD_NAME: Partial<Record<MatchPeriod, string>> = {
  pre_match: 'Before kick-off', first_half: '1st half', halftime: 'Half time', second_half: '2nd half',
  extra_time: 'Extra time', penalties: 'Penalties', full_time: 'Full time',
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
    loadMatchStatLines,
    fixMatchStats,
    draftLineups,
    saveDraftLineup,
  } = useClub();
  const { user } = useAuth();

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

  // Followers' live-score alerts (kick-off, each goal, full time) are sent by the admin layout
  // (lib/use-match-alerts.ts), so they also go out when a result is entered on another admin page.
  const events = matchEvents.filter(e => e.match_id === match?.id).sort((a, b) => compareEventMinute(b, a));
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
  // Anyone in the saved line-up or named in the match log played too, even if they never said "available"
  // (else a goal by them shows as "not linked to a player" when the stats are saved)
  for (const pos of [...(match?.home_lineup_coords || []), ...(match?.away_lineup_coords || [])]) if (pos.member_id) attendingIds.add(pos.member_id);
  const loggedNames = new Set(events.flatMap(e => [e.player_name, e.assist_player_name]).filter(Boolean).map(n => String(n).toLowerCase()));
  const attendingSquadPlayers = matchAvailabilities.length > 0
    ? squadPlayers.filter(p => attendingIds.has(p.id) || loggedNames.has(p.full_name.toLowerCase()))
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

  // Each event button opens its own popup: which one, for which side, and the clock when it was tapped
  const [sheet, setSheet] = useState<{ matchId: string; mode: SheetMode; type: MatchEventType; side: 'home' | 'away'; minute: number; fromPlus?: boolean } | null>(null);
  // Phones show the six most-used event buttons; the rest open with "More events"
  const [moreEvents, setMoreEvents] = useState(false);
  // End match asks first: the result goes public and followers get the full-time alert
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Kick off asks first only when the game isn't due now
  const [confirmKickoff, setConfirmKickoff] = useState(false);
  // The small period buttons, for putting a wrong period right, stay folded behind "Change period"
  const [showPeriods, setShowPeriods] = useState(false);
  // Keep the phone's screen on while scoring (Screen Wake Lock); remembered on this device
  const [keepAwake, setKeepAwake] = useState(false);
  const [canWakeLock, setCanWakeLock] = useState(false);
  useEffect(() => {
    setCanWakeLock(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
    try { setKeepAwake(localStorage.getItem('mc-keep-awake') === '1'); } catch { /* off by default */ }
  }, []);
  useEffect(() => {
    if (!keepAwake || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
        if (cancelled) void l.release(); else lock = l;
      } catch { /* low battery or not allowed: the screen just sleeps as usual */ }
    };
    // The browser drops the lock when the tab is hidden; take it again on return
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) void lock.release();
    };
  }, [keepAwake]);
  const toggleKeepAwake = () => {
    setKeepAwake(v => {
      try { localStorage.setItem('mc-keep-awake', v ? '0' : '1'); } catch { /* this visit only */ }
      return !v;
    });
  };
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error'; undoId?: string } | null>(null);
  // Each new message gets its own few seconds (longer while Undo is on offer)
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), feedback.undoId ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [feedback]);
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

  // A toast along the bottom (in view wherever the page is scrolled); a logged event can be undone from it
  const showFeedback = (text: string, type: 'success' | 'info' | 'error' = 'success', undoId?: string) => {
    setFeedback({ text, type, undoId });
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
            <PopupPanel onClose={() => setIsCreateFixtureOpen(false)} label="New fixture" className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '520px', padding: '2rem', textAlign: 'left', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Schedule New Fixture</h3>
                <button type="button" aria-label="Close" className="icon-close" onClick={() => setIsCreateFixtureOpen(false)}>
                  <X size={20} aria-hidden="true" />
                </button>
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
            </PopupPanel>
          </div>
        )}
      </div>
    );
  }

  // Adjust score
  const handleScoreAdjust = (side: 'home' | 'away', delta: number) => {
    // Taking a goal off: the latest goal logged for that side goes with it, so the match log, the
    // public timeline and the report never list more goals than the score. (Deleting the event
    // lowers the score itself.) With no goal logged for that side, only the number changes.
    if (delta < 0) {
      const lastGoal = events.find(e => goalScoringSide(e) === side);
      if (lastGoal) {
        deleteMatchEvent(lastGoal.id);
        showFeedback(`Took off ${lastGoal.player_name}'s goal (${eventMinuteLabel(lastGoal)}'). It is off the match log too.`, 'info');
        return;
      }
    }
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
      // The clock stops on the real full-time minute (24 in a 2 × 12 game), or the end of extra time
      handlePeriodTransition('full_time', 'completed', match.period === 'extra_time' || match.period === 'penalties'
        ? fullMinutes(match) + 2 * extraHalfMinutes(match) : fullMinutes(match));
    }
    setIsAuditModalOpen(true);
  };

  // Adjust match minute
  const handleMinuteAdjust = (delta: number) => {
    const newMin = Math.max(0, Math.min(maxMinute(match), getLiveMinute(match) + delta));
    updateMatch(match.id, { current_minute: newMin });
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

  // Open an event's popup; the minute comes from the clock as the button is tapped
  const openSheet = (mode: SheetMode, type: MatchEventType, side: 'home' | 'away', fromPlus = false) => {
    setSheet({ matchId: match.id, mode, type, side, minute: getLiveMinute(match), fromPlus });
  };

  // Save what the popup picked, as the old form did: player names, the minute split into stoppage time
  const handleSheetSave = (r: SheetResult) => {
    if (inShootout && (r.eventType === 'goal' || r.eventType === 'penalty' || r.eventType === 'own_goal')) {
      showFeedback('During the shootout, count kicks in the shootout score instead.', 'error');
      return;
    }
    // Past the end of a half the minute is stoppage time: 14 in a 12-minute first half saves as 12+2
    const split = splitMinute(match, match.period, r.minute);
    const minuteText = eventMinuteLabel({ minute: split.minute, added_minute: split.added });
    const saved = addMatchEvent({
      match_id: match.id,
      club_id: club.id,
      minute: split.minute,
      ...(split.added ? { added_minute: split.added } : {}),
      event_type: r.eventType,
      team_side: r.side,
      player_name: r.playerName,
      assist_player_name: r.assistName || undefined,
      detail_text: r.detail || undefined,
    });
    setSheet(null);
    const what = (EVENT_LABEL[r.eventType] || r.eventType).replace(/^./, c => c.toUpperCase());
    const who = r.eventType === 'commentary' || r.eventType === 'whistle' ? '' : `, ${r.playerName}`;
    showFeedback(`${what}${who} ${minuteText}'`, 'success', saved?.id);
  };

  // Undo from the toast: the same as deleting it from the match log (a goal comes off the score too)
  const handleUndo = (eventId: string) => {
    deleteMatchEvent(eventId);
    setFeedback({ text: 'Undone. It is off the match log and the score.', type: 'info' });
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
    // Lineup Draft opens on its own saved copy: keep that in step, so publishing from there later
    // doesn't bring back the line-up from before this change (a cup team's draft covers its whole day, so not those)
    if (!match.tournament_id && draftLineups.some(d => d.match_id === match.id)) {
      saveDraftLineup({ club_id: club.id, match_id: match.id, formation: formationName, lineup_coords: positions,
        ...(pitchFormat?.matchId === match.id ? { format: pitchFormat.format } : {}) });
    }
    showFeedback(`Tactical lineup & ${formationName} formation published live to Match Centre!`);
    // Stats already saved for this match: offer the line-up players with no appearance one
    const savedMatch = match;
    void offerLineupAppearances([savedMatch], positions.map(p => p.member_id).filter(id => squadPlayers.some(sp => sp.id === id)), {
      loadMatchStatLines, fixMatchStats, adminName: user?.full_name || 'Club Committee',
    }).then(res => { if (res) showFeedback(res.message, res.ok ? 'success' : 'error'); });
  };

  // Full time and stats not saved yet: the one moment "Save Player Stats" should stand out
  const statsDue = match.status === 'completed' && !match.is_audited;

  // Kick-off goes straight to followers' phones. On the day it's one tap; for a game set for another
  // time (more than two hours away, or more than six hours ago) it asks first, since Match Centre
  // opens on the next fixture and a stray tap would start it.
  const kickOff = () => handlePeriodTransition('first_half', 'live', periodStartMinute(match, 'first_half'));
  const untilKickoff = kickoff(match) - Date.now();
  const kickoffIsOffSchedule = untilKickoff > 2 * 3600000 || untilKickoff < -6 * 3600000;

  // The one big scoreboard button: the next whistle for where the game is (none once it's over)
  const scoreText = `${match.home_score ?? 0}–${match.away_score ?? 0}`;
  const nextStep: { label: string; hint: string; go: () => void } | null =
    match.status === 'completed' || match.status === 'cancelled' || match.status === 'postponed' ? null
    : match.status === 'upcoming' || !match.period || match.period === 'pre_match'
      ? { label: 'Kick off', hint: 'Starts the clock and the live score', go: () => (kickoffIsOffSchedule ? setConfirmKickoff(true) : kickOff()) }
    : match.status === 'halftime' || match.period === 'halftime'
      ? { label: 'Start 2nd half', hint: `The clock restarts at ${periodStartMinute(match, 'second_half')}′`, go: () => handlePeriodTransition('second_half', 'live', periodStartMinute(match, 'second_half')) }
    : match.period === 'first_half'
      ? { label: 'Half time', hint: `Stops the clock at ${halfMinutes(match)}′`, go: () => handlePeriodTransition('halftime', 'halftime', halfMinutes(match)) }
      : { label: 'End match', hint: `Full time at ${scoreText}, then player stats`, go: () => setConfirmEnd(true) };
  const endMinute = match.period === 'extra_time' || match.period === 'penalties' ? fullMinutes(match) + 2 * extraHalfMinutes(match) : fullMinutes(match);

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

      {/* Feedback toast, along the bottom so it's in view wherever the page is scrolled */}
      <div role="status" aria-live="polite" className="mc-toast-slot">
        {feedback && (
          <div className={feedback.type === 'error' ? 'mc-toast is-error' : 'mc-toast'}>
            {feedback.type === 'error' ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span>{feedback.text}</span>
            {feedback.undoId && (
              <button type="button" className="mc-toast-undo" onClick={() => handleUndo(feedback.undoId!)}>Undo</button>
            )}
          </div>
        )}
      </div>

      {/* Before kick-off: who's coming and whether the team is picked, from the answers and line-up saved for this game */}
      {match.status === 'upcoming' && !match.tournament_id && squadPlayers.length > 0 && (() => {
        const answers = new Map(matchAvailabilities.map(a => [a.member_id, a.status]));
        const count = (status: string) => squadPlayers.filter(p => (answers.get(p.id) || 'pending') === status).length;
        const starters = ((lineupSide === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || []).filter(p => p.member_id).length;
        const tiles: [number, string][] = [[count('available'), 'In'], [count('maybe'), 'Maybe'], [count('unavailable'), 'Out'], [count('pending'), 'No answer']];
        return (
          <section className="glass-panel mc-ready" aria-labelledby="mc-ready-title">
            <h3 id="mc-ready-title">Ready for kick-off?</h3>
            <dl className="mc-ready-counts">
              {tiles.map(([n, label]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}
            </dl>
            <p className="mc-ready-line">
              {starters > 0
                ? <><CheckCircle2 size={16} aria-hidden="true" /> Line-up published: {starters} {starters === 1 ? 'starter' : 'starters'}</>
                : <><AlertCircle size={16} aria-hidden="true" /> No line-up published yet</>}
            </p>
            <div className="mc-ready-actions">
              <Link href={`/${club.slug}/admin/availability`} className="btn btn-secondary btn-sm touch-target">Availability</Link>
              <Link href={`/${club.slug}/admin/lineup/draft?match=${match.id}`} className="btn btn-secondary btn-sm touch-target">{starters > 0 ? 'Change the line-up' : 'Pick the line-up'}</Link>
            </div>
          </section>
        );
      })()}

      {/* Stats are saved: the result is ready to post. The graphics are made on the public match page,
          where names and photos already follow the club's rules for juniors. */}
      {match.status === 'completed' && match.is_audited && (
        <section className="glass-panel mc-next" aria-labelledby="mc-next-title">
          <div>
            <h3 id="mc-next-title">Player stats are saved</h3>
            <p>Post the result while it&apos;s fresh. The result graphic and the Player of the Match card are ready to share.</p>
          </div>
          <div className="mc-next-actions">
            <Link href={`${matchPath(club.slug, match)}?share=1`} target="_blank" className="btn btn-primary btn-sm touch-target">
              <Share2 size={15} aria-hidden="true" /> Share the result
            </Link>
            <Link href={matchPath(club.slug, match)} target="_blank" className="btn btn-secondary btn-sm touch-target">
              <ExternalLink size={14} aria-hidden="true" /> Match report
            </Link>
          </div>
        </section>
      )}

      {/* A finished match: edits here change the public result, so say so, and let the admin keep followers' phones quiet */}
      {match.status === 'completed' && (
        <div role="note" className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.85rem 1rem', marginBottom: '1.25rem', background: 'var(--color-warn-wash)', border: '1px solid var(--color-warn-line)' }}>
          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', flex: '1 1 320px', minWidth: 0 }}>
            <AlertTriangle size={18} aria-hidden="true" color="var(--color-warn)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: 'block', color: 'var(--text-primary)' }}>This match is already marked as completed</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Edits to goals, cards, the lineup or player stats change the public result, league table and season stats straight away.
              </span>
            </div>
          </div>
          <label htmlFor="mc-notify" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
            <input
              id="mc-notify"
              type="checkbox"
              checked={!match.alerts_muted}
              onChange={e => {
                updateMatch(match.id, { alerts_muted: !e.target.checked });
                showFeedback(e.target.checked ? 'Follower alerts on for this match.' : 'Follower alerts off for this match.');
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-accent)', cursor: 'pointer' }}
            />
            Notify followers about this match
          </label>
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
            <div className="mc-clock-head">
              <div className={match.status === 'live' ? 'mc-clock is-live' : 'mc-clock'}>
                <Clock size={20} aria-hidden="true" />
                <span><LiveMinute match={match} />&prime;</span>
                {match.added_time > 0 && <small>+{match.added_time}&prime;</small>}
              </div>
              <span className={isLiveGame(match) ? 'mc-now is-live' : 'mc-now'}>
                {isLiveGame(match) && <span className="mc-now-dot" aria-hidden="true" />}
                {match.status === 'completed' ? 'Full time' : PERIOD_NAME[match.period] || 'Before kick-off'}
              </span>
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

            {/* Added time, without going to the Clock tab */}
            {match.status === 'live' && (
              <div className="mc-added-row" role="group" aria-label="Added time">
                <span>Added time</span>
                {Array.from(new Set([0, 1, 2, 3, 5, match.added_time || 0])).sort((a, b) => a - b).map(mins => (
                  <button key={mins} type="button" className="mc-period" aria-pressed={(match.added_time || 0) === mins} onClick={() => handleSetAddedTime(mins)}>
                    +{mins}
                  </button>
                ))}
              </div>
            )}

            <div className="mc-score">
              {(['home', 'away'] as const).map((side, i) => {
                const name = side === 'home' ? match.home_team_name : match.away_team_name;
                return (
                  <React.Fragment key={side}>
                    {i === 1 && <div className="mc-score-sep" aria-hidden="true">:</div>}
                    <div className="mc-score-side">
                      <div className="mc-score-name">{name}</div>
                      <div className="mc-score-ctrl">
                        <button type="button" onClick={() => handleScoreAdjust(side, -1)} className="btn btn-secondary" aria-label={`Take a goal off ${name}`}>
                          <Minus size={15} aria-hidden="true" />
                        </button>
                        <span className="mc-goals">{side === 'home' ? match.home_score : match.away_score}</span>
                        {/* A goal asks who scored, so it reaches the scorer's stats (the shootout keeps its own count below) */}
                        <button type="button" onClick={() => (inShootout ? handleScoreAdjust(side, 1) : openSheet('goal', 'goal', side, true))} className="btn btn-primary" aria-label={`Add a goal for ${name}`}>
                          <Plus size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* One big button: always the next whistle. The small period buttons put a mistake right */}
            <div className="mc-next-step">
              {nextStep && (
                <button type="button" className="btn btn-primary mc-next-step-btn" onClick={nextStep.go}>
                  <span>{nextStep.label}</span>
                  <small>{nextStep.hint}</small>
                </button>
              )}
              <div className="mc-next-step-more">
                <button type="button" className="mc-link-btn" aria-expanded={showPeriods} onClick={() => setShowPeriods(v => !v)}>
                  {showPeriods ? 'Hide periods' : 'Change period'}
                </button>
              </div>
              {showPeriods && (
                <div className="mc-periods" role="group" aria-label="Period">
                  <button type="button" className="mc-period" aria-pressed={match.period === 'first_half'} onClick={() => handlePeriodTransition('first_half', 'live', periodStartMinute(match, 'first_half'))}>1st half</button>
                  <button type="button" className="mc-period" aria-pressed={match.period === 'halftime'} onClick={() => handlePeriodTransition('halftime', 'halftime', halfMinutes(match))}>Half time</button>
                  <button type="button" className="mc-period" aria-pressed={match.period === 'second_half'} onClick={() => handlePeriodTransition('second_half', 'live', periodStartMinute(match, 'second_half'))}>2nd half</button>
                  <button type="button" className="mc-period" aria-pressed={match.period === 'extra_time'} onClick={() => handlePeriodTransition('extra_time', 'live', periodStartMinute(match, 'extra_time'))}>Extra time</button>
                  <button type="button" className="mc-period" aria-pressed={match.period === 'penalties'} onClick={() => handlePeriodTransition('penalties', 'live', fullMinutes(match) + 2 * extraHalfMinutes(match))}>Penalties</button>
                  <button type="button" className="mc-period" aria-pressed={match.status === 'completed'} onClick={() => setConfirmEnd(true)}>Full time</button>
                </div>
              )}
            </div>

            {canWakeLock && (
              <label className="mc-awake">
                <span>Keep this screen on during the game</span>
                <input type="checkbox" role="switch" className="mc-switch" checked={keepAwake} onChange={toggleKeepAwake} data-view-ok />
              </label>
            )}
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

          {/* Event buttons: each opens a popup to tap the player (with photos) and save */}
          {(() => {
            const clubSides = (['home', 'away'] as const).filter(s => (s === 'home' ? homePlayers : awayPlayers) !== null);
            const sideName = (s: 'home' | 'away') => (s === 'home' ? match.home_team_name : match.away_team_name);

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

            // A button's popup: goals (an own goal counts for the other side), cards, a substitution
            const modeFor = (t: MatchEventType): SheetMode => (t === 'goal' || t === 'penalty' || t === 'own_goal') ? 'goal'
              : t === 'yellow_card' || t === 'red_card' ? 'card' : t === 'sub' ? 'sub' : 'note';
            const openAction = (a: { eventType: MatchEventType; side: 'home' | 'away' }) =>
              openSheet(modeFor(a.eventType), a.eventType, a.eventType === 'own_goal' ? (a.side === 'home' ? 'away' : 'home') : a.side);
            const noteSide: 'home' | 'away' = clubSides[0] ?? 'home';
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

                <h3 id="mc-form-title">Log an event <small>Tap one, then the player</small></h3>

                <div data-more={moreEvents ? 'open' : undefined} className="mc-events mc-event-grid">
                  {quickActions.map(a => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => openAction(a)}
                      data-tone={a.tone}
                      className={`mc-event-btn${PHONE_FIRST.has(a.key) ? '' : ' mc-more'}`}
                    >
                      <EventIcon type={a.eventType} size={20} />
                      <span>{a.label}</span>
                      {a.team && <small>{a.team}</small>}
                    </button>
                  ))}
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
                <div data-more={moreEvents ? 'open' : undefined} className="mc-events mc-more mc-event-extra">
                  {otherActions.map(a => (
                    <button key={a.key} type="button" onClick={() => openSheet('note', a.eventType, noteSide)} className="mc-event-btn is-inline">
                      <EventIcon type={a.eventType} size={16} />
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
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
                    <span className="mc-log-min">{eventMinuteLabel(evt)}&prime;</span>
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
                      onClick={() => handleDeleteEvent(evt.id, `${EVENT_LABEL[evt.event_type] || evt.event_type} (${eventMinuteLabel(evt)}')`)}
                      className="admin-icon-btn is-danger"
                      aria-label={`Delete ${EVENT_LABEL[evt.event_type] || evt.event_type} at ${eventMinuteLabel(evt)} minutes`}
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
                { label: 'Kick-off, first half', mark: `${periodStartMinute(match, 'first_half')}′`, go: () => handlePeriodTransition('first_half', 'live', periodStartMinute(match, 'first_half')) },
                { label: 'Half time whistle', mark: `${halfMinutes(match)}′`, go: () => handlePeriodTransition('halftime', 'halftime', halfMinutes(match)) },
                { label: 'Kick-off, second half', mark: `${periodStartMinute(match, 'second_half')}′`, go: () => handlePeriodTransition('second_half', 'live', periodStartMinute(match, 'second_half')) },
                { label: 'Extra time (cup or knockout)', mark: `${periodStartMinute(match, 'extra_time')}′`, go: () => handlePeriodTransition('extra_time', 'live', periodStartMinute(match, 'extra_time')) },
                { label: 'Penalty shootout', mark: 'Pens', go: () => handlePeriodTransition('penalties', 'live', fullMinutes(match) + 2 * extraHalfMinutes(match)) },
              ]).map(p => (
                <button key={p.label} type="button" className="btn btn-secondary mc-period-row" onClick={p.go}>
                  <span>{p.label}</span>
                  <span className="admin-pill">{p.mark}</span>
                </button>
              ))}
              <button type="button" className="btn btn-primary mc-period-row" onClick={() => setConfirmEnd(true)}>
                <span>Full time, then save player stats</span>
                <span className="admin-pill">FT</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* An event's popup: tap the player and save */}
      {sheet && sheet.matchId === match.id && (
        <MatchEventSheet
          key={`${sheet.mode}-${sheet.type}-${sheet.side}`}
          mode={sheet.mode}
          initialType={sheet.type}
          side={sheet.side}
          names={{ home: match.home_team_name, away: match.away_team_name }}
          squads={{ home: homePlayers, away: awayPlayers }}
          lineupIds={{
            home: (match.home_lineup_coords || []).map(p => p.member_id).filter((id): id is string => !!id),
            away: (match.away_lineup_coords || []).map(p => p.member_id).filter((id): id is string => !!id),
          }}
          events={events}
          score={{ home: match.home_score ?? 0, away: match.away_score ?? 0 }}
          clockMinute={sheet.minute}
          maxMinute={maxMinute(match)}
          minuteLabel={m => clockLabel(match, match.period, m)}
          onSave={handleSheetSave}
          onScoreOnly={sheet.fromPlus ? () => { setSheet(null); handleScoreAdjust(sheet.side, 1); } : undefined}
          onClose={() => setSheet(null)}
        />
      )}

      {/* End match asks first: the result goes public and followers get the full-time alert */}
      {confirmEnd && (
        <div className="mc-sheet-wrap" onClick={() => setConfirmEnd(false)}>
          <PopupPanel onClose={() => setConfirmEnd(false)} label="End the match?" className="mc-sheet" onClick={e => e.stopPropagation()}>
            <div className="mc-sheet-grab" aria-hidden="true" />
            <div className="mc-sheet-head"><h2>End the match?</h2></div>
            <p className="mc-sheet-lead">Check the score first. This is the result people will see.</p>
            <div className="mc-final">
              <span>{match.home_team_name}</span>
              <b>{scoreText}</b>
              <span>{match.away_team_name}</span>
            </div>
            <ul className="mc-final-list">
              <li><CheckCircle2 size={16} aria-hidden="true" />The clock stops at {endMinute}&prime; and the public page says Full time</li>
              {!match.alerts_muted && <li><CheckCircle2 size={16} aria-hidden="true" />Followers get the full-time score alert</li>}
              {isCupGame && <li><CheckCircle2 size={16} aria-hidden="true" />The result goes into the tournament</li>}
              <li><CheckCircle2 size={16} aria-hidden="true" />Player stats open next, so you can save them</li>
            </ul>
            <div className="mc-sheet-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmEnd(false)}>Not yet</button>
              <button type="button" className="btn btn-primary" onClick={() => { setConfirmEnd(false); handleFullTime(); }}>End match</button>
            </div>
          </PopupPanel>
        </div>
      )}

      {/* Kick off for a game that isn't due now: check it's the right one before followers are told */}
      {confirmKickoff && (
        <div className="mc-sheet-wrap" onClick={() => setConfirmKickoff(false)}>
          <PopupPanel onClose={() => setConfirmKickoff(false)} label="Kick off this game now?" className="mc-sheet" onClick={e => e.stopPropagation()}>
            <div className="mc-sheet-grab" aria-hidden="true" />
            <div className="mc-sheet-head"><h2>Kick off this game now?</h2></div>
            <p className="mc-sheet-lead">
              {match.home_team_name} v {match.away_team_name} is set for{' '}
              <LocalTime value={match.match_date} format="both" options={{ weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }} />.
            </p>
            <ul className="mc-final-list">
              <li><CheckCircle2 size={16} aria-hidden="true" />The clock starts and the public page shows it as live</li>
              {!match.alerts_muted && <li><CheckCircle2 size={16} aria-hidden="true" />Followers get the kick-off alert straight away</li>}
            </ul>
            <div className="mc-sheet-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmKickoff(false)}>Not yet</button>
              <button type="button" className="btn btn-primary" onClick={() => { setConfirmKickoff(false); kickOff(); }}>Kick off</button>
            </div>
          </PopupPanel>
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
          <PopupPanel onClose={() => setIsCreateFixtureOpen(false)} label="New fixture" className="glass-panel" style={{
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
              <button type="button" aria-label="Close" className="icon-close" onClick={() => setIsCreateFixtureOpen(false)}>
                <X size={20} aria-hidden="true" />
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
          </PopupPanel>
        </div>
      )}
    </div>
  );
}
