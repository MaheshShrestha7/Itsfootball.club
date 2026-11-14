'use client';

import { PageSkeleton, Skeleton } from '@/components/Skeleton';
import React, { useState, useEffect, useRef, useCallback, useMemo, use } from 'react';
import dynamic from 'next/dynamic';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { GOAL_SEQUENCE_MS, Lamps, useGoalSequence, useKickoffParts } from '@/components/StadiumBoard';
import PlayerAvatar from '@/components/PlayerAvatar';
import SponsorMarquee from '@/components/SponsorMarquee';
import { isSponsorOnSite, topTierSponsors } from '@/lib/sponsors';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabase/client';
import { isPlayerMember, type PitchPosition } from '@/lib/supabase/types';
import { extractCrestTextColor } from '@/lib/image-color';
import {
  Shield,
  Radio,
  Clock,
  MapPin,
  ArrowLeft,
  Settings,
  AlertCircle,
  Share2,
  Volume2,
  VolumeX,
  Sparkles,
  Wifi,
  Star,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import LiveMinute from '@/components/LiveMinute';
import { compareEventMinute, eventMinuteLabel, halfMinutes, lengthLabel, validHalfMinutes } from '@/lib/match-length';
import MatchShareButton from '@/components/MatchShareButton';
import { lineupBench } from '@/lib/lineup-bench';
import MatchReport from '@/components/MatchReport';
import SupportedBy from '@/components/SupportedBy';
import { articleFor, publicEvents, reportCompetition } from '@/lib/match-article';
import { groundPath } from '@/lib/grounds';
import GettingThere, { useMatchGround } from '@/components/grounds/GettingThere';
import PreMatchPanel, { lastMeeting } from '@/components/PreMatchPanel';
import { periodLabel } from '@/lib/match-clock';
import { GOAL_EVENT_TYPES, isJuniorFixture, juniorMemberIds, juniorPublicName, playerIdsByName, publicMember, publicPlayerIds, publicScoreHidden, teamLabel, teamOfMatch, withTeamSide } from '@/lib/teams';
import { OPPONENT_COLOR, clubLineupSide, clubSidePlayers, sideColor, sideShortName } from '@/lib/tournament-engine';
import { matchForParam, matchPath } from '@/lib/slugs';
import { subPlayers } from '@/lib/match-subs';

// Only needed once the lineups tab opens
const TacticalPitch = dynamic(() => import('@/components/TacticalPitch'), {
  loading: () => <Skeleton style={{ aspectRatio: '3 / 4', maxHeight: 560, maxWidth: 420, margin: '0 auto' }} />,
});

type Side = 'home' | 'away';

/** Event types as people say them */
const EVENT_WORD: Record<string, string> = {
  goal: 'Goal', penalty: 'Penalty goal', own_goal: 'Own goal', yellow_card: 'Yellow card', red_card: 'Red card',
  sub: 'Substitution', var: 'VAR', commentary: 'Commentary', whistle: 'Whistle',
};

export default function MatchCenterPage({
  params,
}: {
  params: Promise<{ clubSlug: string; matchId: string }>;
}) {
  const resolvedParams = use(params);
  const { selectClubBySlug, matches, matchEvents, members: allMembers, isHydrated, syncStatus, liveFeed, getMatchAvailabilities, activityLogs, sponsors, tournamentParticipants, internalTeams, clubTeams, clubTeamMembers, events: clubEvents, playerStats } = useClub();

  // No fallback to another club, and only this club's own fixtures: a match cached from another
  // club's site must not show under this club's name
  const club = selectClubBySlug(resolvedParams.clubSlug);

  // Junior players are shown as "Sam T.", without a photo unless a guardian allowed it
  const juniorIds = useMemo(() => juniorMemberIds(allMembers, clubTeams, clubTeamMembers, { includeU18: club?.junior_includes_u18 !== false }), [allMembers, clubTeams, clubTeamMembers]);
  const members = useMemo(() => allMembers.map(m => publicMember(m, juniorIds)), [allMembers, juniorIds]);
  // Photos for the share graphic's lineup pitch (juniors without photo consent have none)
  const memberPhotos = useMemo(() => Object.fromEntries(members.map(m => [m.id, m.photo_url])), [members]);

  // Same rule as AdminGuard, so the shortcut only appears for people who can actually open the admin area
  const { user, hasClubAdminAccess } = useAuth();
  const isClubAdmin = !!club && !!user && (hasClubAdminAccess(club.id) || (!!club.owner_id && club.owner_id === user.id));
  const foundMatch = club ? matchForParam(matches.filter(m => m.club_id === club.id), resolvedParams.matchId) : undefined;
  // A junior or reserve game names our side after its team ("Rovers U12")
  const storedMatch = useMemo(() => (foundMatch && club ? withTeamSide(foundMatch, club, clubTeams) : foundMatch), [foundMatch, club, clubTeams]);
  // Saved lineups keep each player's name: shortened for juniors (every name, in a junior team's fixture)
  const juniorFixture = !!storedMatch && isJuniorFixture(storedMatch, clubTeams);
  const match = useMemo(() => {
    if (!storedMatch || (!juniorFixture && juniorIds.size === 0)) return storedMatch;
    const publicLineup = (coords: PitchPosition[] | undefined) => coords?.map(p =>
      juniorFixture || (p.member_id && juniorIds.has(p.member_id)) ? { ...p, name: juniorPublicName(p.name) } : p);
    return { ...storedMatch, home_lineup_coords: publicLineup(storedMatch.home_lineup_coords), away_lineup_coords: publicLineup(storedMatch.away_lineup_coords) };
  }, [storedMatch, juniorFixture, juniorIds]);
  // The ground guide the report links to (loaded in the browser, like Getting there)
  const ground = useMatchGround(match);
  // A team with "hide scores" on (junior grassroots rules): no score, goals or scorers here.
  // A junior team's fixture shows player names shortened ("Sam T."), for both sides.
  const scoreHidden = !!match && publicScoreHidden(match, clubTeams);
  const events = match
    ? publicEvents(matchEvents.filter(e => e.match_id === match.id && !(scoreHidden && GOAL_EVENT_TYPES.includes(e.event_type))), juniorFixture)
        .sort((a, b) => compareEventMinute(b, a))
    : [];
  const allSquadPlayers = club ? members.filter(m => m.club_id === club.id && isPlayerMember(m)) : [];

  // Only players explicitly marked "available" for this fixture are shown as the matchday squad
  const matchAvailabilities = match ? getMatchAvailabilities(match.id) : [];
  const attendingIds = new Set(matchAvailabilities.filter(a => a.status === 'available').map(a => a.member_id));
  const squadPlayers = allSquadPlayers.filter(p => attendingIds.has(p.id));

  // Club-wide partners (event-scoped sponsors belong to their event's page)
  const matchSponsors = club ? sponsors.filter(s => s.club_id === club.id && !s.event_id && isSponsorOnSite(s)) : [];

  // Man of the Match, resolved from the verified audit ledger for this fixture
  const motmLog = match ? activityLogs.find(l => l.event_type === 'match_motm' && l.reference_id === match.id) : undefined;
  // The stats saved at full time hold it too, also when ClubScore is switched off and the points log
  // has no row (public_match_motm, migration 20261165; without it the log alone is used, as before)
  const [savedMotmId, setSavedMotmId] = useState<{ matchId: string; memberId: string | null } | null>(null);
  const motmMatchId = match?.status === 'completed' ? match.id : undefined;
  const motmAudited = match?.is_audited;
  useEffect(() => {
    if (!motmMatchId || !isSupabaseConfigured) return;
    let live = true;
    getSupabaseClient()?.rpc('public_match_motm', { p_match_id: motmMatchId })
      .then(({ data, error }) => { if (live && !error) setSavedMotmId({ matchId: motmMatchId, memberId: typeof data === 'string' ? data : null }); });
    return () => { live = false; };
  }, [motmMatchId, motmAudited]);
  const motmId = (savedMotmId && savedMotmId.matchId === match?.id ? savedMotmId.memberId : null) || motmLog?.member_id;
  const motmMember = motmId ? members.find(m => m.id === motmId) : undefined;
  const goalEvents = events.filter(e => GOAL_EVENT_TYPES.includes(e.event_type)).slice().sort(compareEventMinute);

  // Each side's color: the club's goes to the club's own side, not simply to "home"
  const clubColor = club?.primary_color || '#10B981';
  const homeColor = match ? sideColor(match, 'home', clubColor, tournamentParticipants, internalTeams) : clubColor;
  const awayColor = match ? sideColor(match, 'away', clubColor, tournamentParticipants, internalTeams) : OPPONENT_COLOR;
  const isLive = match?.status === 'live' || match?.status === 'halftime';
  // Tournament fixtures store is_club_home = true for every match, so neither side is "the club" there
  const isClubSide = (side: Side) => !!match && !match.tournament_id && (side === 'home') === (match.is_club_home ?? true);

  // Club players' names link to their public page (adults only; never in a junior team's fixture).
  // Events keep a typed name, so it is matched to the one club player with that name, on a side the
  // club's players are on (both in an in-house game, and either in a tournament).
  const pageIds = useMemo(
    () => (club ? publicPlayerIds(allMembers.filter(m => m.club_id === club.id), clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false }) : new Set<string>()),
    [club, allMembers, clubTeams, clubTeamMembers]
  );
  const idsByName = useMemo(() => playerIdsByName(allMembers.filter(m => m.club_id === club?.id), pageIds), [allMembers, club?.id, pageIds]);
  const playerLink = (name: string | undefined, side?: Side, memberId?: string): React.ReactNode => {
    if (!name || !club || !match || juniorFixture) return name;
    const ownSide = !side || match.match_type === 'internal' || !!match.tournament_id || isClubSide(side);
    const id = memberId && pageIds.has(memberId) ? memberId : ownSide ? idsByName.get(name.trim().toLowerCase()) : undefined;
    return id ? <Link href={`/${club.slug}/squad/${id}`} className="player-name-link">{name}</Link> : name;
  };

  // "?share=1" (the link Match Centre gives once the stats are saved) opens the share graphic straight away
  const [shareOnArrival, setShareOnArrival] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('share') === '1') setShareOnArrival(true);
  }, []);

  const [logoFailed, setLogoFailed] = useState({ home: false, away: false });
  const [activeTab, setActiveTab] = useState<'timeline' | 'lineups' | 'stats'>('timeline');
  // Off until the visitor turns it on: browsers only let a click start audio, so "on" by default would be silent
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [liveSyncPulse, setLiveSyncPulse] = useState(false);
  const [titleColors, setTitleColors] = useState<{ home: string; away: string }>({ home: homeColor, away: awayColor });

  // The goal being shown on the board (components/StadiumBoard.tsx plays it), and the side whose
  // number then relights lamp by lamp
  const [goalAlert, setGoalAlert] = useState<{ key: number; teamName: string; teamSide: Side } | null>(null);
  const [settling, setSettling] = useState<Side | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  useGoalSequence(boardRef, goalAlert);
  const kickoff = useKickoffParts(foundMatch?.match_date);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const goalQueueRef = useRef<{ side: Side; teamName: string }[]>([]);
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScoresRef = useRef<{ id: string; home: number; away: number } | null>(null);

  // One AudioContext for the page, started by the click that turns sound on and suspended when muted
  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    try {
      if (next && !audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (next) audioCtxRef.current?.resume();
      else audioCtxRef.current?.suspend();
    } catch {
      // Audio unavailable: the page works silently
    }
  };

  useEffect(() => () => {
    audioCtxRef.current?.close();
    if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
  }, []);

  // Synthesized stadium goal chime, only while sound is switched on
  const playGoalAudio = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try {
      // Pitch whistle chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // Graceful silence if audio is blocked
    }
  }, []);

  // Goals play one at a time on the board, each for its full sequence, with the chime when sound is on
  const showNextGoal = useCallback(function next() {
    const goal = goalQueueRef.current.shift();
    if (!goal) {
      goalTimerRef.current = null;
      setGoalAlert(null);
      setSettling(null);
      return;
    }
    setGoalAlert({ key: Date.now(), teamName: goal.teamName, teamSide: goal.side });
    setSettling(null);
    playGoalAudio();
    goalTimerRef.current = setTimeout(() => {
      setSettling(goal.side);
      goalTimerRef.current = setTimeout(next, 700);
    }, GOAL_SEQUENCE_MS);
  }, [playGoalAudio]);

  // Celebrate each goal as the live score moves, for both sides. Only during play, so a stale cached
  // score being corrected after the page loads isn't mistaken for a goal.
  useEffect(() => {
    if (!match) return;
    const prev = prevScoresRef.current;
    prevScoresRef.current = { id: match.id, home: match.home_score, away: match.away_score };
    if (!prev || prev.id !== match.id || !isLive || scoreHidden) return;
    for (let i = prev.home; i < match.home_score; i++) goalQueueRef.current.push({ side: 'home', teamName: match.home_team_name });
    for (let i = prev.away; i < match.away_score; i++) goalQueueRef.current.push({ side: 'away', teamName: match.away_team_name });
    if (!goalTimerRef.current) showNextGoal();
  }, [match?.id, match?.home_score, match?.away_score, match?.home_team_name, match?.away_team_name, isLive, scoreHidden, showNextGoal]);

  // The moment a match someone is watching live ends: the full-time whistle and board, the score settles,
  // and the match report fades in underneath
  const prevStatusRef = useRef<string | undefined>(undefined);
  const [fullTimeMoment, setFullTimeMoment] = useState(false);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = match?.status;
    if (match?.status !== 'completed' || (prev !== 'live' && prev !== 'halftime')) return;
    setFullTimeMoment(true);
    const timer = setTimeout(() => setFullTimeMoment(false), 5000);
    return () => clearTimeout(timer);
  }, [match?.status]);

  // Cross-tab pulse for the live badge. Goals themselves come from the score above, so a goal logged
  // in another tab isn't celebrated twice (once from the message, again when the score arrives).
  useEffect(() => {
    if (!match?.id || typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const matchId = match.id;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = new BroadcastChannel('itsfootball_live_matchday');
    channel.onmessage = e => {
      if (e.data?.matchId !== matchId) return;
      setLiveSyncPulse(true);
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => setLiveSyncPulse(false), 2000);
    };
    return () => {
      channel.close();
      clearTimeout(pulseTimer);
    };
  }, [match?.id]);

  // Derive each team's title/scoreboard text color from its crest; falls back to that side's color
  // if the crest can't be sampled.
  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    const homeLogo = match.home_team_logo || (isClubSide('home') ? club?.logo_url : undefined);
    const awayLogo = match.away_team_logo || (isClubSide('away') ? club?.logo_url : undefined);
    extractCrestTextColor(homeLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, home: c })); });
    extractCrestTextColor(awayLogo).then(c => { if (!cancelled && c) setTitleColors(prev => ({ ...prev, away: c })); });
    return () => { cancelled = true; };
  }, [match?.id, match?.home_team_logo, match?.away_team_logo, match?.is_club_home, match?.tournament_id, club?.logo_url]);

  // The server already has the club's public data, so the page renders straight into the first HTML.
  // Without the fixture yet, wait for the browser's own load before calling it missing.
  if (!club || !match) {
    if (!isHydrated || syncStatus.phase === 'loading') {
      return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-pitch)', color: 'var(--text-primary)' }}>
          <PageSkeleton kind="match" label="Loading the match" />
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg-pitch)', color: 'var(--text-primary)', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, margin: '0 auto 1.25rem auto' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem' }}>Match Fixture Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          The requested fixture does not exist or may have been rescheduled.
        </p>
        <Link href={club ? `/${club.slug}` : '/'} className="btn btn-primary">
          Back to the club
        </Link>
      </div>
    );
  }

  // Short team names for narrow screens
  const homeShort = sideShortName(match, 'home', club.short_name, tournamentParticipants);
  const awayShort = sideShortName(match, 'away', club.short_name, tournamentParticipants);
  const titleIsTeams = match.title === `${match.home_team_name} vs ${match.away_team_name}`;

  // Lineups for each side that fields the club's own players: the club's side in a league fixture,
  // both internal teams in a tournament. Tournament teams without availability use their roster.
  const lineupSquad = match.tournament_id && attendingIds.size === 0 ? allSquadPlayers : squadPlayers;
  const lineupSides = (match.tournament_id ? ['home', 'away'] as Side[] : [clubLineupSide(match)])
    .map(side => ({
      side,
      teamName: side === 'home' ? match.home_team_name : match.away_team_name,
      color: side === 'home' ? homeColor : awayColor,
      players: clubSidePlayers(match, side, lineupSquad, tournamentParticipants, internalTeams),
    }))
    .filter((s): s is typeof s & { players: NonNullable<typeof s.players> } => s.players !== null);

  // The share graphic's Team list: the side it draws (the club's), its starters then these substitutes
  const shareSide: Side = (match.is_club_home ?? true) ? 'home' : 'away';
  const shareSubs = lineupBench(match, shareSide, allSquadPlayers, lineupSides.find(s => s.side === shareSide)?.players || [])
    .map(p => ({ number: p.jersey_number || 0, name: juniorFixture ? juniorPublicName(p.full_name) : p.full_name }));

  // Before kick-off there's nothing for Timeline or Stats yet: a pre-match panel instead, and the
  // Lineups tab only once a line-up is saved for one of the club's sides
  const preMatch = match.status === 'upcoming' || match.status === 'postponed';
  const lineupAnnounced = lineupSides.some(({ side }) => ((side === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || []).length > 0);
  const previousMeeting = preMatch ? lastMeeting(match, matches.filter(m => m.club_id === club.id)) : undefined;
  const cancelled = match.status === 'cancelled';
  const visibleTabs = cancelled ? [] : preMatch ? (lineupAnnounced ? ['lineups'] : []) : ['timeline', 'lineups', 'stats'];
  const shownTab = cancelled ? null : preMatch ? (lineupAnnounced ? 'lineups' : null) : activeTab;

  // The full-time report, written as an article
  const reportCup = match.event_id ? clubEvents.find(e => e.id === match.event_id && e.club_id === match.club_id) : undefined;
  const article = articleFor({
    club, match, events, matches, clubTeams, members, playerStats, juniorFixture,
    playerOfTheMatch: motmMember?.full_name,
    cup: reportCup && { id: reportCup.id, title: reportCup.title },
    groundHref: ground ? groundPath(ground) : undefined,
  });
  const reportTeam = teamOfMatch(match, clubTeams);

  // The shootout score, once one has been entered for a level game (never for a team that hides scores)
  const shootout = !scoreHidden && match.status !== 'upcoming' && match.home_score === match.away_score
    && match.home_penalty_score != null && match.away_penalty_score != null
    && (match.home_penalty_score > 0 || match.away_penalty_score > 0 || match.period === 'penalties')
    ? { home: match.home_penalty_score, away: match.away_penalty_score } : null;

  // The timeline, newest first, with the whistles in their place: full time, half-time and kick-off
  // come from where the match is up to, so they show without anyone logging them
  const started = match.status === 'live' || match.status === 'halftime' || match.status === 'completed';
  const pastHalf = match.status === 'halftime' || match.status === 'completed'
    || (match.status === 'live' && match.period !== 'first_half' && match.period !== 'pre_match');
  const half = halfMinutes(match);
  const timelineRows: (typeof events[number] | { marker: string })[] = [];
  if (started) {
    if (match.status === 'completed') timelineRows.push({ marker: 'Full time' });
    let halfShown = !pastHalf;
    for (const evt of events) {
      if (!halfShown && evt.minute <= half) { timelineRows.push({ marker: 'Half-time' }); halfShown = true; }
      timelineRows.push(evt);
    }
    if (!halfShown) timelineRows.push({ marker: 'Half-time' });
    timelineRows.push({ marker: 'Kick-off' });
  } else {
    timelineRows.push(...events);
  }
  // Live, the newest event is on top; once it's over the match reads from kick-off down
  if (match.status === 'completed') timelineRows.reverse();

  // One team on the board: crest, name and a bar in the side's colour. The club's crest only stands in on the club's own side.
  const boardTeam = (side: Side) => {
    const name = side === 'home' ? match.home_team_name : match.away_team_name;
    const logo = side === 'home' ? match.home_team_logo : match.away_team_logo;
    const crest = logo && !logoFailed[side] ? logo : isClubSide(side) ? club.logo_url : undefined;
    const markFailed = () => setLogoFailed(prev => (prev[side] ? prev : { ...prev, [side]: true }));
    return (
      <span className={`stb-team is-${side}`} style={{ '--side': side === 'home' ? homeColor : awayColor } as React.CSSProperties}>
        <span className="stb-crest">
          {crest ? (
            <img loading="eager" decoding="async" src={crest} alt=""
              onError={crest === logo ? markFailed : undefined}
              // A server-rendered image can fail before React attaches onError, so check it on mount too
              ref={el => { if (crest === logo && el?.complete) el.decode().catch(markFailed); }} />
          ) : (
            <span>{(side === 'home' ? homeShort : awayShort).slice(0, 4)}</span>
          )}
        </span>
        <span className="stb-name">{name}</span>
        <span className="stb-bar" aria-hidden="true" />
      </span>
    );
  };
  // The cup or competition, named once: a club event's title can be a sentence ("ANCC joins MNFC Cup 2026")
  const competition = reportCompetition(match, reportCup?.title);
  const ownTitle = match.title && !titleIsTeams && !/\svs\.?\s/i.test(match.title) ? match.title : undefined;
  const scored = (side: Side) => goalEvents.filter(e => e.team_side === side);

  return (
    <div style={{ padding: '2.5rem 0 5rem 0' }}>
      <div className="container">
        {/* Top Breadcrumb & Live Controls */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem',
          marginBottom: '1.5rem',
        }}>
          <Link
            href={`/${club.slug}`}
            className="touch-target"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back to {club.name}</span>
          </Link>

          <div className="scroll-pill-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '100%' }}>
            {/* Live Feed Synced Badge, only while the match is being played */}
            {isLive && <div
              className="scroll-pill-item"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: liveSyncPulse ? 'rgba(var(--club-primary-rgb), 0.25)' : 'rgba(var(--club-primary-rgb), 0.12)',
                border: `1px solid ${liveSyncPulse ? 'var(--club-primary)' : 'rgba(var(--club-primary-rgb), 0.35)'}`,
                color: 'var(--club-ink)',
                fontSize: '0.74rem',
                fontWeight: 800,
                minHeight: '44px',
                transition: 'all 0.3s ease',
              }}
              title={liveFeed === 'off' ? 'The connection dropped. The score catches up as soon as it is back.' : 'Updates as the club enters goals and cards'}
              role="status"
            >
              {liveFeed === 'off'
                ? <Wifi size={13} aria-hidden="true" style={{ opacity: 0.6 }} />
                : <span className="pulse-dot" style={{ background: 'var(--club-primary)', width: '7px', height: '7px' }} />}
              <span>{liveFeed === 'off' ? 'Reconnecting…' : 'Live updates'}</span>
            </div>}

            {/* No Door Check-In button for the public: the QR code at the entrance opens self check-in */}

            <button
              type="button"
              onClick={toggleAudio}
              className="btn btn-secondary btn-sm scroll-pill-item touch-target"
              style={{ minHeight: '44px', minWidth: '44px' }}
              title={audioEnabled ? 'Mute goal sound' : 'Play a sound on goals'}
              aria-label={audioEnabled ? 'Mute goal sound' : 'Play a sound on goals'}
              aria-pressed={audioEnabled}
            >
              {audioEnabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            </button>

            <MatchShareButton match={match} club={club} hideScore={scoreHidden} events={events} photos={memberPhotos} subs={shareSubs} autoOpen={shareOnArrival}
              motm={motmMember ? { name: motmMember.full_name, photo: memberPhotos[motmMember.id] } : undefined} />

            {isClubAdmin && (
              <Link
                href={`/${club.slug}/admin/match-center?match=${match.id}`}
                className="btn btn-secondary btn-sm scroll-pill-item touch-target"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px' }}
              >
                <Settings size={14} />
                <span>Admin</span>
              </Link>
            )}
          </div>
        </div>

        {/* The stadium board. A fixture card on the club page glides into it (components/MatchGlideLink.tsx),
            via data-match-header and its view-transition-name. */}
        <section data-match-header={match.id} className={`stb${match.status === 'live' ? ' is-live' : ''}`} style={{ viewTransitionName: 'match-card' }} aria-label="Scoreboard">
          {/* Full-time board: the referee's whistle goes three times, then a TV-style full-time graphic wipes in */}
          {fullTimeMoment && (
            <div className="ft-board" aria-hidden="true">
              <span className="ft-board-tag">
                <span className="ft-whistle">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="14" r="5.5" />
                    <path d="M13 10.2 21.5 7v4.6l-6.8 1.6" />
                    <circle cx="9" cy="14" r="1.3" fill="currentColor" />
                  </svg>
                  <i /><i /><i />
                </span>
                FT
              </span>
              <span className="ft-board-body">
                <span className="ft-board-title">Full-time</span>
                {!scoreHidden && (
                  <span className="ft-board-score">
                    <span><span className="team-name-full">{match.home_team_name}</span><span className="team-name-short">{homeShort}</span></span>
                    <b>{match.home_score ?? 0}–{match.away_score ?? 0}</b>
                    <span><span className="team-name-full">{match.away_team_name}</span><span className="team-name-short">{awayShort}</span></span>
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="stb-top">
            <span className="stb-comp">
              {reportCup ? (
                <Link href={`/${resolvedParams.clubSlug}/events/${reportCup.id}`}>{competition || reportCup.title}</Link>
              ) : competition}
              {ownTitle && <span>{competition || reportCup ? ', ' : ''}{ownTitle}</span>}
            </span>
            <span>
              <LocalTime value={match.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }} />
              {match.match_time && <>, <LocalTime value={match.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></>}
            </span>
          </div>

          <div className="stb-field" ref={boardRef}>
            <h1 className="stb-main">
              {boardTeam('home')}
              <span className={`stb-centre${fullTimeMoment ? ' ft-settle' : ''}`}>
                {match.status === 'postponed' || match.status === 'cancelled' ? (
                  /* A game that was called off has no score and no kick-off time to show */
                  <span className="stb-word">{match.status === 'postponed' ? 'Postponed' : 'Cancelled'}</span>
                ) : match.status === 'upcoming' ? (
                  /* Before kick-off a 0–0 says nothing: the lamps show when it starts */
                  kickoff ? (
                    <span className="stb-lamps is-small" style={{ viewTransitionName: 'match-score' }}>
                      <Lamps text={kickoff.clock} />
                      <span className="stb-suffix">{kickoff.suffix}</span>
                      <span className="sr-only">Kick-off {kickoff.clock} {kickoff.suffix}</span>
                    </span>
                  ) : <span className="stb-word">vs</span>
                ) : scoreHidden ? (
                  <span className="stb-word">vs</span>
                ) : (
                  <span className="stb-lamps" style={{ viewTransitionName: 'match-score' }}>
                    <Lamps text={String(match.home_score ?? 0)} hot={settling === 'home'} />
                    <Lamps text="-" />
                    <Lamps text={String(match.away_score ?? 0)} hot={settling === 'away'} />
                    <span className="sr-only">{match.home_score ?? 0}–{match.away_score ?? 0}</span>
                  </span>
                )}
                <span className={`stb-state${match.status === 'live' ? ' is-live' : ''}`}>
                  {match.status === 'live' ? (
                    <span>{match.is_paused ? 'Paused' : 'Live'} <LiveMinute match={match} />&apos;{match.added_time > 0 && ` +${match.added_time}`}</span>
                  ) : match.status === 'halftime' ? 'Half-time'
                    : match.status === 'upcoming' ? 'Kick-off'
                    : match.status === 'postponed' ? 'New date to come'
                    : match.status === 'cancelled' ? 'Not played'
                    : periodLabel(match.period)}
                </span>
                {/* A cup game settled (or being settled) on penalties: the shootout score, kept apart from the match score */}
                {shootout && <span className="stb-pens">{shootout.home}–{shootout.away} on penalties</span>}
              </span>
              {boardTeam('away')}
            </h1>
            {goalEvents.length > 0 && (
              <div className="stb-goals">
                {(['home', 'away'] as Side[]).map(side => (
                  <ul key={side} className={`is-${side}`}>
                    {scored(side).map(evt => (
                      <li key={evt.id}>
                        {playerLink(evt.player_name, evt.team_side) || 'Goal'}{evt.event_type === 'penalty' ? ' (pen)' : evt.event_type === 'own_goal' ? ' (og)' : ''} {eventMinuteLabel(evt)}&apos;
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            )}
          </div>

          {(ground || match.venue || validHalfMinutes(match.half_minutes) !== null || (match.match_format && match.match_format !== '11v11')) && (
            <dl className="stb-base">
              {(ground || match.venue) && (
                <div>
                  <dt className="sr-only">Ground</dt>
                  <MapPin size={15} aria-hidden="true" />
                  <dd>{ground ? <Link href={groundPath(ground)}>{ground.name}</Link> : match.venue}{match.pitch_label ? `, ${match.pitch_label}` : ''}</dd>
                </div>
              )}
              {(validHalfMinutes(match.half_minutes) !== null || (match.match_format && match.match_format !== '11v11')) && (
                <div>
                  <dt className="sr-only">Length</dt>
                  <Clock size={15} aria-hidden="true" />
                  <dd>{lengthLabel(match)}{match.match_format && match.match_format !== '11v11' ? `, ${match.match_format.replace(/v\d+$/, '-a-side')}` : ''}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Directions, parking and wet weather from the ground guide, before and during the match */}
        {match.status !== 'completed' && match.status !== 'cancelled' && <GettingThere match={match} />}

        {preMatch && (
          <PreMatchPanel
            club={club}
            match={match}
            previous={previousMeeting}
            previousScoreHidden={previousMeeting ? publicScoreHidden(previousMeeting, clubTeams) : false}
            lineupAnnounced={lineupAnnounced}
            onShowLineup={() => document.getElementById('match-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        )}

        {cancelled && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
            <p className="text-note" style={{ margin: 0 }}>This game was cancelled and won&apos;t be played.</p>
            <Link href={`/${club.slug}/fixtures`} className="btn btn-secondary btn-sm" style={{ marginTop: '0.85rem' }}>See all fixtures</Link>
          </div>
        )}

        {/* Full-time report, written as a news article from the logged events (none when the team hides scores) */}
        {article && (
          <div className={fullTimeMoment ? 'ft-report-in' : undefined}>
          <MatchReport
            article={article}
            clubName={club.name}
            coverUrl={match.match_flyer_url || club.banner_url || undefined}
            crestUrl={club.logo_url || undefined}
            tags={['Match Report', ...[reportCompetition(match, reportCup?.title)].filter((t): t is string => !!t)]}
            publishedAt={match.match_date}
            shareUrl={matchPath(club.slug, match)}
            source={`Written from the match events ${club.name} logged.`}
            moreHref="#match-tabs"
            facts={[
              { label: 'Kick-off', value: <><LocalTime value={match.match_date} />{match.match_time && <>, <LocalTime value={match.match_date} format="time" options={{ hour: 'numeric', minute: '2-digit' }} /></>}</> },
              ...(ground || match.venue ? [{ label: 'Ground', value: <>{ground ? <Link href={groundPath(ground)}>{ground.name}</Link> : match.venue}{match.pitch_label ? `, ${match.pitch_label}` : ''}</> }] : []),
              { label: 'Length', value: `${lengthLabel(match)}${match.match_format && match.match_format !== '11v11' ? `, ${match.match_format.replace(/v\d+$/, '-a-side')}` : ''}` },
              ...(reportTeam?.slug ? [{ label: 'Team', value: <Link href={`/${club.slug}/teams/${reportTeam.slug}`}>{teamLabel(reportTeam)}</Link> }] : []),
            ]}
          />
          <SupportedBy clubId={club.id} />
          </div>
        )}

        {/* Player of the Match (the scorers are on the board) */}
        {motmMember && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              marginBottom: '2rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            {motmMember && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 220px' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PlayerAvatar photoUrl={motmMember.photo_url} name={motmMember.full_name} size={44} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    border: '2px solid #0A0F17',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Star size={11} color="#040609" fill="#040609" />
                  </div>
                </div>
                <div className="min-w-0">
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--c-amber)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Player of the Match
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                    {playerLink(motmMember.full_name, undefined, motmMember.id)}
                    {motmMember.jersey_number ? ` (#${motmMember.jersey_number})` : ''}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab Selector: Match Events Timeline, Lineups / Pitch, Stats */}
        {visibleTabs.length > 0 && (
        <div id="match-tabs" className="scroll-pill-strip" style={{
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          gap: '1.25rem',
          paddingBottom: '2px',
        }}>
          {[
            { id: 'timeline', label: 'Timeline & Commentary', short: 'Timeline' },
            { id: 'lineups', label: 'Tactical Pitch & Lineups', short: 'Lineups' },
            { id: 'stats', label: 'Match Statistics', short: 'Stats' },
          ].filter(tab => visibleTabs.includes(tab.id)).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="scroll-pill-item touch-target"
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: shownTab === tab.id ? `3px solid var(--club-primary)` : '3px solid transparent',
                padding: '0.75rem 0.25rem',
                color: shownTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Short labels on phone, so all three tabs fit without scrolling */}
              <span className="label-long">{tab.label}</span>
              <span className="label-short">{tab.short}</span>
            </button>
          ))}
        </div>
        )}

        {/* TAB 1: LIVE TIMELINE */}
        {shownTab === 'timeline' && (
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              {/* Vertical line connector */}
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '26px',
                width: '2px',
                background: 'var(--border-subtle)',
                zIndex: 0,
              }} />

              {events.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', position: 'relative', zIndex: 1, background: 'var(--bg-pitch)' }}>
                  Nothing logged yet. Goals, cards and substitutions show here as {club.name} enters them.
                </div>
              )}
              {timelineRows.map(row => {
                  if ('marker' in row) {
                    return (
                      <div key={row.marker} className="timeline-marker">
                        <span>{row.marker}</span>
                      </div>
                    );
                  }
                  const evt = row;
                  const isGoal = GOAL_EVENT_TYPES.includes(evt.event_type);
                  const sub = subPlayers(evt);
                  // Commentary and whistles carry the team's name, not a player's: the line itself is the text
                  const isNote = evt.event_type === 'commentary' || evt.event_type === 'whistle';
                  return (
                  <div
                    key={evt.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1.25rem',
                      position: 'relative',
                      zIndex: 1,
                      borderLeft: isGoal ? '4px solid var(--club-primary)' : evt.event_type === 'red_card' ? '4px solid #EF4444' : evt.event_type === 'yellow_card' ? '4px solid #F59E0B' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Minute Circle Badge */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isGoal ? 'var(--club-primary)' : evt.event_type === 'yellow_card' ? '#F59E0B' : evt.event_type === 'red_card' ? '#EF4444' : 'var(--bg-surface-elevated)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontFamily: 'var(--font-heading)',
                      // Stoppage minutes ("45+3'") need a smaller size to fit the circle
                      fontSize: evt.added_minute ? '0.68rem' : '0.9rem',
                      flexShrink: 0,
                      color: evt.event_type === 'yellow_card' ? '#000000' : '#FFFFFF',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    }}>
                      {eventMinuteLabel(evt)}&apos;
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <span className="badge" style={{
                          backgroundColor: isGoal ? 'rgba(var(--club-primary-rgb), 0.2)' : evt.event_type === 'yellow_card' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.1)',
                          color: isGoal ? 'var(--c-green)' : evt.event_type === 'yellow_card' ? 'var(--c-amber)' : 'var(--text-primary)',
                        }}>
                          {EVENT_WORD[evt.event_type] || evt.event_type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-meta">
                          {evt.team_side === 'home' ? match.home_team_name : match.away_team_name}
                        </span>
                      </div>

                      {sub ? (
                        /* Who came on and who went off, each on its own line */
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'grid', gap: '0.15rem' }}>
                          <span><ArrowUp size={14} color="var(--c-green)" aria-hidden="true" /> <span className="sr-only">On: </span>{playerLink(sub.on, evt.team_side)}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}><ArrowDown size={14} color="var(--c-red)" aria-hidden="true" /> <span className="sr-only">Off: </span>{playerLink(sub.off, evt.team_side)}</span>
                        </h4>
                      ) : !isNote && (
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {playerLink(evt.player_name, evt.team_side)}
                        {evt.assist_player_name && <> (Assist: {playerLink(evt.assist_player_name, evt.team_side)})</>}
                      </h4>
                      )}

                      {evt.detail_text && !sub && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {evt.detail_text}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: TACTICAL LINEUPS & PITCH, one per side that fields the club's own players */}
        {shownTab === 'lineups' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2rem',
          }}>
            {lineupSides.map(({ side, teamName, color, players: available }) => {
              // Once a line-up is published the list follows it: the starters on the pitch, then the
              // substitutes the coach named (or, with none named, the other players who said they're in).
              // With no line-up yet it's everyone who said they're in.
              const coords = (side === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || [];
              const starterIds = new Set(coords.map(c => c.member_id).filter((id): id is string => !!id));
              const byId = new Map(allSquadPlayers.map(p => [p.id, p]));
              const starters = [...starterIds].map(id => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
              const subs = lineupBench(match, side, allSquadPlayers, available);
              const hasLineup = starters.length > 0;
              const players = hasLineup ? [...starters, ...subs] : available;
              const groups = hasLineup
                ? [{ label: 'Starting', list: starters }, { label: 'Substitutes', list: subs }].filter(g => g.list.length > 0)
                : [{ label: '', list: available }];
              return (
              <React.Fragment key={side}>
                {/* The Tactical Pitch Component */}
                <div>
                  <TacticalPitch
                    players={players}
                    formation={(side === 'home' ? match.home_formation : match.away_formation) || '4-3-3'}
                    matchFormat={match.match_format}
                    savedPositions={side === 'home' ? match.home_lineup_coords : match.away_lineup_coords}
                    primaryColor={color}
                    isEditable={false}
                    allowOrientationToggle={true}
                    showFormationControls={false}
                    matchEvents={events.filter(e => e.team_side === side)}
                    teamName={teamName}
                  />
                </div>

                {/* Starting XI & Substitutes List */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
                    {teamName} Matchday Squad
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {players.length === 0 && (
                      <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No players have confirmed their availability for this match yet.
                      </p>
                    )}
                    {groups.map(group => (
                      <React.Fragment key={group.label || 'squad'}>
                      {group.label && (
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--club-ink)', marginTop: group.label === 'Substitutes' ? '0.6rem' : 0 }}>
                          {group.label}
                        </div>
                      )}
                      {group.list.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          background: 'rgba(var(--tint-rgb), 0.03)',
                        }}
                      >
                        <div className="row row-loose">
                          <PlayerAvatar photoUrl={p.photo_url} name={p.full_name} size={32} />
                          <span style={{
                            fontFamily: 'var(--font-heading)',
                            fontWeight: 900,
                            color: 'var(--club-ink)',
                            width: '24px',
                          }}>
                            {p.jersey_number ? `#${p.jersey_number}` : ''}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{playerLink(p.full_name, undefined, p.id)}</span>
                        </div>
                        <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-secondary)' }}>
                          {p.player_position}
                        </span>
                      </div>
                      ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </React.Fragment>
              );
            })}
            {lineupSides.length === 0 && (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No club lineups for this match.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: MATCH STATISTICS */}
        {shownTab === 'stats' && (() => {
          // Derive real stats from the logged event array
          const homeGoals = match.home_score;
          const awayGoals = match.away_score;
          const homeYellows = events.filter(e => e.event_type === 'yellow_card' && e.team_side === 'home').length;
          const awayYellows = events.filter(e => e.event_type === 'yellow_card' && e.team_side === 'away').length;
          const homeReds = events.filter(e => e.event_type === 'red_card' && e.team_side === 'home').length;
          const awayReds = events.filter(e => e.event_type === 'red_card' && e.team_side === 'away').length;
          const homeSubs = events.filter(e => e.event_type === 'sub' && e.team_side === 'home').length;
          const awaySubs = events.filter(e => e.event_type === 'sub' && e.team_side === 'away').length;

          const trackedStats = [
            ...(scoreHidden ? [] : [{ label: 'Goals Scored', home: homeGoals, away: awayGoals }]),
            { label: 'Yellow Cards', home: homeYellows, away: awayYellows },
            { label: 'Red Cards', home: homeReds, away: awayReds },
            { label: 'Substitutions', home: homeSubs, away: awaySubs },
          ];

          return (
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', textAlign: 'center' }}>
                Match Statistics
              </h3>
              <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                From the goals, cards and substitutions {club.name} logged
              </p>

              {/* Home vs Away header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', padding: '0 0.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: titleColors.home, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {match.home_team_name}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: titleColors.away, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                  {match.away_team_name}
                </span>
              </div>

              {trackedStats.map(s => {
                const total = s.home + s.away || 1;
                const homePercent = (s.home / total) * 100;

                return (
                  <div key={s.label} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      <span style={{ color: titleColors.home, minWidth: '24px' }}>{s.home}</span>
                      <span className="text-muted">{s.label}</span>
                      <span style={{ color: titleColors.away, minWidth: '24px', textAlign: 'right' }}>{s.away}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(var(--tint-rgb), 0.08)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${homePercent}%`, background: homeColor, transition: 'width 0.6s ease' }} />
                      <div style={{ width: `${100 - homePercent}%`, background: awayColor, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Club partners, under whichever tab is open. Once the report's "Supported by" shows the top
            tier, they aren't repeated here (SPE-19): each logo shows once on the page */}
        {(() => {
          const supportedBy = match.status === 'completed' && !scoreHidden ? new Set(topTierSponsors(matchSponsors).map(s => s.id)) : null;
          const rest = supportedBy ? matchSponsors.filter(s => !supportedBy.has(s.id)) : matchSponsors;
          return rest.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <SponsorMarquee sponsors={rest} placement="match_center_marquee" />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
