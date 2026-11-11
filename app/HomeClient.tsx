'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { isListedClub } from '@/lib/public-tournaments';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useClub, validateClubSlug } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import { DEFAULT_BANNER, DEFAULT_CREST } from '@/lib/crest';
import './home.css';
import {
  ArrowRight, ArrowLeftRight, AlertCircle, Bell, Check, CheckCircle2, ClipboardList, Clock,
  Goal, Heart, Megaphone, RotateCcw, Shield, User, UsersRound, X,
} from 'lucide-react';
import { trackPlatformVisit } from '@/lib/platform-tracking';
import { HOMEPAGE_FAQS } from '@/lib/schema';
import { matchPath, newsPath } from '@/lib/slugs';
import LocalTime from '@/components/LocalTime';
import type { HomeDemoClub, HomeResultRow, LatestNewsRow, LatestPhotoRow } from '@/lib/supabase/club-lookup';

interface DugoutEvent {
  id: string;
  minute: number;
  type: 'goal' | 'sub' | 'yellow' | 'red';
  detail: string;
}

const DEFAULT_EVENTS: DugoutEvent[] = [
  { id: '1', minute: 72, type: 'goal', detail: 'J. Silva' },
  { id: '2', minute: 68, type: 'yellow', detail: 'T. Cole, Riverside' },
  { id: '3', minute: 65, type: 'sub', detail: 'J. Park on for L. Hughes' },
  { id: '4', minute: 55, type: 'red', detail: 'M. Evans, Riverside' },
];

const EVENT_LABEL: Record<DugoutEvent['type'], string> = { goal: 'Goal', sub: 'Sub', yellow: 'Yellow Card', red: 'Red Card' };

type KitStyle = 'solid' | 'stripes' | 'sash' | 'checkered';

function MiniJersey({ primary, accent, style }: { primary: string; accent: string; style: KitStyle }) {
  const sId = `pat-s-${primary.replace(/[^a-zA-Z0-9]/g, '')}-${accent.replace(/[^a-zA-Z0-9]/g, '')}`;
  const cId = `pat-c-${primary.replace(/[^a-zA-Z0-9]/g, '')}-${accent.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', flexShrink: 0 }}>
      <defs>
        <pattern id={sId} width="8" height="32" patternUnits="userSpaceOnUse">
          <rect width="4" height="32" fill={primary} />
          <rect x="4" width="4" height="32" fill={accent} />
        </pattern>
        <pattern id={cId} width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={primary} />
          <rect x="8" width="8" height="8" fill={accent} />
          <rect y="8" width="8" height="8" fill={accent} />
          <rect x="8" y="8" width="8" height="8" fill={primary} />
        </pattern>
      </defs>
      <path
        d="M9 4L3 9L7 14L10 12V28H22V12L25 14L29 9L23 4H19C19 6 17 7 16 7C15 7 13 6 13 4H9Z"
        fill={
          style === 'solid' ? primary :
          style === 'stripes' ? `url(#${sId})` :
          style === 'checkered' ? `url(#${cId})` :
          primary
        }
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.2"
      />
      {style === 'sash' && (
        <path d="M10 6L22 26H19L9 8V6H10Z" fill={accent} />
      )}
      <path d="M13 4C13 6 15 7 16 7C17 7 19 6 19 4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface TacticalPlayer {
  num: number;
  label: string;
  name: string;
  role: string;
  confirmed: string;
  goals: number;
  assists: number;
  zone: 'gk' | 'def' | 'mid' | 'att';
}

const TACTICAL_ROSTER: TacticalPlayer[] = [
  { num: 1, label: '1', name: 'S. Turner', role: 'Goalkeeper', confirmed: 'Thursday 7:22 PM', goals: 0, assists: 1, zone: 'gk' },
  { num: 3, label: '3', name: 'M. Romero', role: 'Right Back', confirmed: 'Thursday 6:40 PM', goals: 2, assists: 0, zone: 'def' },
  { num: 4, label: '4', name: 'L. Davies', role: 'Center Back', confirmed: 'Wednesday 8:02 PM', goals: 1, assists: 1, zone: 'def' },
  { num: 5, label: '5', name: 'C. Dawson', role: 'Center Back', confirmed: 'Wednesday 9:15 PM', goals: 1, assists: 3, zone: 'def' },
  { num: 2, label: '2', name: 'J. Lewis', role: 'Left Back', confirmed: 'Thursday 8:30 PM', goals: 0, assists: 4, zone: 'def' },
  { num: 12, label: '12', name: 'L. Hughes', role: 'Right Midfielder', confirmed: 'Tuesday 6:15 PM', goals: 4, assists: 6, zone: 'mid' },
  { num: 8, label: '8', name: 'J. Silva', role: 'Playmaker', confirmed: 'Wednesday 5:45 PM', goals: 9, assists: 11, zone: 'mid' },
  { num: 6, label: '6', name: 'K. Phillips', role: 'Defensive Mid', confirmed: 'Thursday 7:10 PM', goals: 2, assists: 5, zone: 'mid' },
  { num: 7, label: '7', name: 'D. Okafor', role: 'Right Winger', confirmed: 'Thursday 6:15 PM', goals: 14, assists: 4, zone: 'att' },
  { num: 9, label: '9', name: 'J. Park', role: 'Striker', confirmed: 'Thursday 9:00 PM', goals: 7, assists: 8, zone: 'att' },
  { num: 11, label: '11', name: 'S. Adebayo', role: 'Left Winger', confirmed: 'Wednesday 8:20 PM', goals: 6, assists: 5, zone: 'att' },
];

type Formation = '4-3-3' | '4-4-2' | '3-5-2';

// Coordinates line up with TACTICAL_ROSTER order: GK, RB, CB, CB, LB, three midfielders, three forwards
const FORMATIONS: Record<Formation, [number, number][]> = {
  '4-3-3': [[11, 50], [29, 18], [31, 39], [31, 61], [29, 82], [50, 24], [48, 50], [50, 76], [74, 20], [78, 50], [74, 80]],
  '4-4-2': [[11, 50], [29, 18], [31, 39], [31, 61], [29, 82], [50, 18], [48, 38], [48, 62], [50, 82], [76, 38], [76, 62]],
  '3-5-2': [[11, 50], [29, 26], [27, 50], [29, 74], [49, 86], [49, 14], [47, 36], [44, 50], [47, 64], [76, 38], [76, 62]],
};

// Passing lanes drawn between player indices; true adds an arrowhead
const TACTICAL_LINKS: Record<Formation, [number, number, boolean][]> = {
  '4-3-3': [[0, 2, true], [1, 2, false], [2, 3, false], [3, 4, false], [2, 6, true], [3, 6, true], [6, 5, true], [6, 7, true], [6, 9, true], [5, 8, true], [7, 10, true]],
  '4-4-2': [[1, 2, false], [2, 3, false], [3, 4, false], [2, 6, true], [3, 7, true], [6, 5, true], [7, 8, true], [6, 9, true], [7, 10, true]],
  '3-5-2': [[1, 2, false], [2, 3, false], [2, 7, true], [7, 6, true], [7, 8, true], [6, 9, true], [8, 10, true], [5, 6, true]],
};

// Who it's for: one line each, linking to that person's answers (Parent goes to the club directory: there's no parent FAQ section)
const ROLES = [
  { tab: 'Coach', Icon: ClipboardList, line: 'Pick your team in minutes', href: '/faq#managers-coaches' },
  { tab: 'Committee', Icon: Shield, line: 'Members and money in one place', href: '/faq#club-officials' },
  { tab: 'Player', Icon: User, line: 'Your pass and your stats', href: '/faq#players' },
  { tab: 'Parent', Icon: UsersRound, line: 'All your kids, one app', href: '/clubs' },
  { tab: 'Supporter', Icon: Heart, line: 'Never miss a goal', href: '/faq#supporters' },
  { tab: 'Sponsor', Icon: Megaphone, line: 'See what your money did', href: '/faq#sponsors' },
] as const;

// "Team picked" tile: a 4-3-3 on the mini pitch, x/y in %, keeper amber, forwards red (same glows as the hero pitch)
const WEEK_PITCH: [number, number, number, '' | 'gk' | 'fw'][] = [
  [12, 50, 1, 'gk'], [32, 20, 2, ''], [30, 42, 4, ''], [30, 62, 5, ''], [32, 82, 3, ''],
  [54, 30, 8, ''], [52, 52, 6, ''], [54, 74, 10, ''], [78, 24, 7, 'fw'], [82, 50, 9, 'fw'], [78, 76, 11, 'fw'],
];

const SAY_LINES = ['Less chasing.', 'More football.'];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** Club blocks shown before "See all clubs" takes the last slot */
const HOME_CLUB_BLOCKS = 12;

export default function PlatformHomePage({ latestNews = [], latestPhotos = [], results = [], demoClub: pickedDemo = null }: { latestNews?: LatestNewsRow[]; latestPhotos?: LatestPhotoRow[]; results?: HomeResultRow[]; demoClub?: HomeDemoClub | null }) {
  const router = useRouter();
  const { clubs: allClubs, matches } = useClub();
  // Tournament-only clubs (public tournament pages) aren't clubs to show off
  const clubs = useMemo(() => allClubs.filter(isListedClub), [allClubs]);
  const liveClubIds = useMemo(() => new Set(matches.filter(m => m.status === 'live' || m.status === 'halftime').map(m => m.club_id)), [matches]);
  // A full grid of blocks; past that, the last block links to the directory
  const clubBlocks = clubs.length > HOME_CLUB_BLOCKS ? clubs.slice(0, HOME_CLUB_BLOCKS - 1) : clubs;
  // News and photos only from clubs the page lists, 3 of each
  const clubOf = (id: string) => clubs.find(c => c.id === id);
  // The newest three posts, news or photos, from clubs the page lists
  const latestPosts = [
    ...latestNews.flatMap(n => {
      const club = clubOf(n.club_id);
      return club ? [{ kind: 'news' as const, id: n.id, at: n.published_at, href: newsPath(club.slug, n.slug), image: n.cover_image_url || club.banner_url || DEFAULT_BANNER, title: n.title, clubName: club.short_name || club.name }] : [];
    }),
    ...latestPhotos.flatMap(p => {
      const club = clubOf(p.club_id);
      return club ? [{ kind: 'photo' as const, id: p.id, at: p.created_at, href: `/${club.slug}/gallery`, image: p.thumbnail_url || p.media_url, title: p.title || p.album_name || 'New photos', clubName: club.short_name || club.name }] : [];
    }),
  ].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 3);
  // The results board: each listed club's newest game (live ones come first), two clubs at most
  const boardGames = useMemo(() => {
    const seen = new Set<string>();
    const out: { game: HomeResultRow; club: (typeof clubs)[number] }[] = [];
    for (const game of results) {
      const club = clubs.find(c => c.id === game.club_id);
      if (!club || seen.has(club.id)) continue;
      seen.add(club.id);
      out.push({ game, club });
      if (out.length === 2) break;
    }
    return out;
  }, [results, clubs]);
  const { user, isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    trackPlatformVisit('/');
  }, []);

  // Hero playground: the visitor's club name + colours drive the live mock beside it
  const [clubName, setClubName] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const palette = FOOTBALL_COLOR_PALETTES[paletteIdx];
  const onPrimary = evaluateColorContrast(palette.primary).bestTextColor;
  const displayName = clubName.trim() || 'Your Club FC';
  const slugCheck = useMemo(() => validateClubSlug(clubName, allClubs), [clubName, allClubs]);
  const previewSlug = slugCheck.cleanSlug || 'yourclub';

  // Interactive Dugout & Matchday Controller State
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [isGoalFlash, setIsGoalFlash] = useState(false);
  const [subInPlayer, setSubInPlayer] = useState('J. Silva #8');
  const [subOutPlayer, setSubOutPlayer] = useState('L. Baker #11');
  const [matchStatus, setMatchStatus] = useState<'live' | 'halftime' | 'ended'>('live');
  const [refCardActive, setRefCardActive] = useState<'yellow' | 'red' | null>(null);
  const [events, setEvents] = useState<DugoutEvent[]>(DEFAULT_EVENTS);
  // The kit picker is gone from the hero; the mock shirts keep one pattern
  const kitStyle: KitStyle = 'stripes';
  // Tactical Pitch state
  const [formation, setFormation] = useState<Formation>('4-3-3');
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(8);
  const activePitchPlayer = TACTICAL_ROSTER.find(p => p.num === selectedPitchPlayer) || TACTICAL_ROSTER[6];

  // Tilt is written straight to CSS variables so mouse moves don't re-render the page
  const handlePitchMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', `${38 - y * 10}deg`);
    el.style.setProperty('--tilt-y', `${x * 12}deg`);
  };

  const handlePitchMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.removeProperty('--tilt-x');
    e.currentTarget.style.removeProperty('--tilt-y');
  };

  // Live match clock (advances steadily between 71' and 89')
  const [minute, setMinute] = useState(72);
  useEffect(() => {
    if (minute >= 89 || matchStatus !== 'live') return;
    const t = setTimeout(() => setMinute(m => m + 1), 3500);
    return () => clearTimeout(t);
  }, [minute, matchStatus]);

  const triggerGoal = () => {
    setHomeScore(s => s + 1);
    setIsGoalFlash(true);
    setTimeout(() => setIsGoalFlash(false), 1400);
    setEvents(prev => [{ id: String(Date.now()), minute, type: 'goal', detail: 'D. Okafor' }, ...prev.slice(0, 3)]);
  };

  const triggerSub = () => {
    const isSilva = subInPlayer.includes('Silva');
    setSubInPlayer(isSilva ? 'J. Park #9' : 'J. Silva #8');
    setSubOutPlayer(isSilva ? 'L. Hughes #12' : 'L. Baker #11');
    const detail = isSilva ? 'J. Park on for L. Hughes' : 'J. Silva on for L. Baker';
    setEvents(p => [{ id: String(Date.now()), minute, type: 'sub', detail }, ...p.slice(0, 3)]);
  };

  const triggerCard = () => {
    const nextCard: 'yellow' | 'red' | null = refCardActive === 'yellow' ? 'red' : refCardActive === 'red' ? null : 'yellow';
    setRefCardActive(nextCard);
    if (nextCard) {
      const detail = nextCard === 'red' ? 'M. Evans, Riverside' : 'T. Cole, Riverside';
      setEvents(p => [{ id: String(Date.now()), minute, type: nextCard, detail }, ...p.slice(0, 3)]);
    }
  };

  const triggerHalfTime = () => {
    setMatchStatus(s => s === 'halftime' ? 'live' : 'halftime');
  };

  const triggerEndMatch = () => {
    setMatchStatus(s => s === 'ended' ? 'live' : 'ended');
  };

  const resetDugout = () => {
    setHomeScore(2);
    setAwayScore(1);
    setIsGoalFlash(false);
    setMatchStatus('live');
    setMinute(72);
    setSubInPlayer('J. Silva #8');
    setSubOutPlayer('L. Baker #11');
    setRefCardActive(null);
    setEvents(DEFAULT_EVENTS);
  };

  const isDugoutModified = events !== DEFAULT_EVENTS || matchStatus !== 'live' || refCardActive !== null;
  const isLive = matchStatus === 'live';

  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ palette: String(paletteIdx) });
    if (clubName.trim()) params.set('name', clubName.trim());
    router.push(`/create-club?${params}`);
  };

  const openAuth = (mode: 'login' | 'signup') => { setAuthMode(mode); setAuthModalOpen(true); };

  // The club picked in Mission Control (F10-9); until one is picked, the first listed club
  const demoClub: HomeDemoClub | undefined = pickedDemo || clubs[0];

  // The closing block's address box goes to the same place as the hero's
  const [closeName, setCloseName] = useState('');
  const claimClose = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (closeName.trim()) params.set('name', closeName.trim());
    router.push(`/create-club${params.size ? `?${params}` : ''}`);
  };

  // Tagline: each word lights up once it crosses the middle of the screen (all lit with reduced motion)
  const sayRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const words = sayRef.current?.querySelectorAll<HTMLElement>('.hv-w');
    if (!words?.length) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      words.forEach(w => w.classList.add('is-on'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-on'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -45% 0px' });
    words.forEach(w => io.observe(w));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      {/* ================= HERO ================= */}
      <section
        className="lp-hero"
        style={{
          '--lp-p': palette.primary,
          '--lp-s': palette.secondary,
          '--lp-a': palette.accent,
          '--lp-on-p': onPrimary,
        } as React.CSSProperties}
      >
        <div className="container lp-hero-stage">
          {/* Upper Row: 1 (Left Controls) & 2 (Right Matchday Center) */}
          <div className="lp-hero-upper">
            {/* 1. On left side */}
            <div className="lp-hero-left">
              {/* No hidden keyword text in the H1 (Google treats it as hidden text); the definition below carries the keywords */}
              <h1 className="lp-h1">
                Grassroots club.<br />
                Big-club matchday.
              </h1>

              <p className="lp-hero-sub">
                itsfootball.club is the free platform for grassroots football clubs: club website, live match centre and member passes.
              </p>

              {/* 1.2 Claim URL section */}
              <form className="lp-claim" onSubmit={claim}>
                <div className="lp-claim-field">
                  <label htmlFor="lp-club-name" className="lp-claim-prefix">itsfootball.club/</label>
                  <input
                    id="lp-club-name"
                    value={clubName}
                    onChange={e => setClubName(e.target.value)}
                    placeholder="yourclub"
                    autoComplete="off"
                    maxLength={60}
                    aria-describedby="lp-claim-status"
                  />
                </div>
                <button type="submit" className="lp-claim-btn">
                  Claim URL
                </button>
              </form>
              <div
                id="lp-claim-status"
                aria-live="polite"
                className={`lp-claim-status ${clubName.trim() ? (slugCheck.valid ? 'ok' : 'bad') : ''}`}
              >
                {!clubName.trim() ? (
                  <>Type your club&apos;s name to check your web address.</>
                ) : slugCheck.valid ? (
                  <><CheckCircle2 size={15} /> itsfootball.club/{slugCheck.cleanSlug} looks free. Claim it before someone else does.</>
                ) : (
                  <><AlertCircle size={15} /> {slugCheck.error}</>
                )}
              </div>

              {/* 1.3 Club colour picker */}
              <div className="lp-color-kit-section">
                <div className="lp-swatches-col">
                  <span className="lp-swatches-label" id="lp-colours-label">Club colours</span>
                  <div className="lp-swatch-boxes" role="group" aria-labelledby="lp-colours-label">
                    {FOOTBALL_COLOR_PALETTES.map((p, i) => (
                      <button
                        key={p.name}
                        type="button"
                        className={`lp-swatch-box ${paletteIdx === i ? 'is-active' : ''}`}
                        style={{ background: `linear-gradient(135deg, ${p.primary} 0 50%, ${p.accent} 50% 100%)` }}
                        onClick={() => setPaletteIdx(i)}
                        aria-label={p.name}
                        aria-pressed={paletteIdx === i}
                        title={p.name}
                      />
                    ))}
                  </div>
                  <span className="lp-swatch-name">{palette.name}</span>
                </div>

              </div>
            </div>

          {/* Right Column: Live Matchday Command Console */}
          <div
            className="lp-stage"
            role="region"
            aria-label="Try the live match centre"
            data-theme="dark"
          >
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <div className="lp-dots">
                  <i className="dot-red" />
                  <i className="dot-yellow" />
                  <i className="dot-green" />
                </div>
                <div className="lp-browser-tab">
                  <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                  <span>{displayName} · Match Centre</span>
                </div>
                <div className="lp-url">itsfootball.club/{previewSlug}</div>
              </div>

              <div className={`lp-score ${isGoalFlash ? 'is-goal-flash' : ''}`}>
                <div className="lp-mock-clock">{isLive ? `${minute}'` : matchStatus === 'halftime' ? 'HT' : 'FT'}</div>

                <div className="lp-mock-score-row">
                  <div className="lp-mock-team-badge">
                    <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                    <span className="lp-mock-team" title={displayName}>{displayName}</span>
                  </div>
                  <div className="lp-mock-digit">{homeScore}</div>
                  <span className="lp-mock-colon">:</span>
                  <div className="lp-mock-digit">{awayScore}</div>
                  <div className="lp-mock-team-badge">
                    <span className="lp-mock-team">Riverside</span>
                  </div>
                </div>

                <div className="lp-mock-live-wrap">
                  <span className={`lp-mock-live-badge is-${matchStatus}`} aria-live="polite">
                    {isLive ? '● Live Match' : matchStatus === 'halftime' ? 'Half Time' : 'Full Time'}
                  </span>
                </div>

                {/* Dual-Channel Electronic LED Substitution Board */}
                <div className="lp-sub-matrix" aria-live="polite">
                  <div className="lp-sub-panel in">
                    <span className="lp-sub-tag">SUB IN:</span>
                    <span className="lp-sub-num">{subInPlayer}</span>
                  </div>
                  <div className="lp-sub-panel out">
                    <span className="lp-sub-tag">SUB OUT:</span>
                    <span className="lp-sub-num">{subOutPlayer}</span>
                  </div>
                </div>

                {/* 5 Prominent Tactile Action Cards */}
                <div className="lp-action-cards" role="toolbar" aria-label="Touchline matchday controls">
                  <button
                    type="button"
                    className={`lp-action-card btn-goal ${isGoalFlash ? 'is-active' : ''}`}
                    onClick={triggerGoal}
                    disabled={!isLive}
                  >
                    <Goal size={16} />
                    <span>Goal!</span>
                  </button>
                  <button
                    type="button"
                    className="lp-action-card btn-sub"
                    onClick={triggerSub}
                    disabled={!isLive}
                  >
                    <ArrowLeftRight size={16} />
                    <span>Sub</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-card ${refCardActive ? 'is-active' : ''}`}
                    onClick={triggerCard}
                    disabled={!isLive}
                  >
                    <span className="lp-mini-card" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-half ${matchStatus === 'halftime' ? 'is-active' : ''}`}
                    onClick={triggerHalfTime}
                    disabled={matchStatus === 'ended'}
                    aria-pressed={matchStatus === 'halftime'}
                  >
                    <Clock size={16} />
                    <span>Half Time</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-end ${matchStatus === 'ended' ? 'is-active' : ''}`}
                    onClick={triggerEndMatch}
                    aria-pressed={matchStatus === 'ended'}
                  >
                    <X size={16} />
                    <span>End Match</span>
                  </button>
                </div>

                {/* Live Match Events Summary (2-column layout matching mockup) */}
                <div className="lp-mockup-events">
                  <div className="lp-mockup-events-title">
                    <span>Live Match Events</span>
                    {isDugoutModified && (
                      <button type="button" className="lp-mock-reset" onClick={resetDugout}>
                        <RotateCcw size={11} /> Reset
                      </button>
                    )}
                  </div>
                  <ul className="lp-mockup-events-list" aria-live="polite">
                    {events.map(ev => (
                      <li key={ev.id} className="lp-mock-event">
                        {ev.type === 'goal' ? <Goal size={13} color="#10B981" />
                          : ev.type === 'sub' ? <ArrowLeftRight size={12} color="#10B981" />
                          : <span className={`lp-card-${ev.type}`} />}
                        <span className="lp-mock-ev-time">{ev.minute}&apos;</span>
                        <span className={`lp-mock-ev-desc ${ev.type === 'sub' ? 'green' : ev.type === 'goal' ? '' : ev.type}`}>
                          <b>{EVENT_LABEL[ev.type]}</b> {ev.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Lineup pitch laid beneath the copy and match centre */}
          <div className="lp-hero-pitch-layer">
            <div className="lp-hero-pitch-grid">
              <div
              className="lp-pitch-3d-scene"
              onMouseMove={handlePitchMouseMove}
              onMouseLeave={handlePitchMouseLeave}
            >
              <div className="lp-tactical-pitch">
                {/* Full Pitch Authentic Markings */}
                <div className="lp-pitch-boundary" />
                <div className="lp-pitch-halfway" />
                <div className="lp-pitch-center-circle">
                  <div className="lp-pitch-center-spot" />
                </div>

                {/* Left Penalty Area (Defending) */}
                <div className="lp-pitch-box left" />
                <div className="lp-pitch-goal-area left" />
                <div className="lp-pitch-penalty-spot left" />
                <div className="lp-pitch-penalty-arc left" />

                {/* Right Penalty Area (Attacking) */}
                <div className="lp-pitch-box right" />
                <div className="lp-pitch-goal-area right" />
                <div className="lp-pitch-penalty-spot right" />
                <div className="lp-pitch-penalty-arc right" />

                {/* 4 Corner Arcs */}
                <div className="lp-pitch-corner top-left" />
                <div className="lp-pitch-corner bottom-left" />
                <div className="lp-pitch-corner top-right" />
                <div className="lp-pitch-corner bottom-right" />

                {/* Dynamic Passing Network with Directional Arrowheads */}
                <svg className="lp-pitch-mesh" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <marker id="meshArrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
                      <path d="M 0 2 L 6 5 L 0 8 z" fill="rgba(110, 231, 183, 0.9)" />
                    </marker>
                  </defs>
                  {TACTICAL_LINKS[formation].map(([fromIdx, toIdx, hasArrow], lIdx) => {
                    const fromCoord = FORMATIONS[formation][fromIdx];
                    const toCoord = FORMATIONS[formation][toIdx];
                    if (!fromCoord || !toCoord) return null;
                    return (
                      <line
                        key={`${formation}-${lIdx}`}
                        x1={`${fromCoord[0]}%`}
                        y1={`${fromCoord[1]}%`}
                        x2={`${toCoord[0]}%`}
                        y2={`${toCoord[1]}%`}
                        className="lp-pitch-link"
                        markerEnd={hasArrow ? "url(#meshArrow)" : undefined}
                      />
                    );
                  })}
                </svg>

                {/* 11 player tokens */}
                {FORMATIONS[formation].map(([x, y], i) => {
                  const player = TACTICAL_ROSTER[i];
                  const isSelected = selectedPitchPlayer === player.num;
                  return (
                    <button
                      key={player.num}
                      type="button"
                      className={`lp-pitch-token zone-${player.zone} ${isSelected ? 'is-selected' : ''}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onClick={() => setSelectedPitchPlayer(player.num)}
                      aria-label={`#${player.label} ${player.name}, ${player.role}`}
                      aria-pressed={isSelected}
                      title={`${player.name} (${player.role})`}
                    >
                      <span className="lp-token-num">{player.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Docked Player Inspector Card (matching mockup) */}
            <div className="lp-workbench-card">
              <div className="lp-wcard-header">
                <div className="lp-wcard-avatar">{activePitchPlayer.label}</div>
                <div className="min-w-0 flex-1">
                  <div className="lp-wcard-name">#{activePitchPlayer.label} {activePitchPlayer.name}</div>
                  <div className="lp-wcard-sub">
                    <Check size={12} color="#10B981" /> Confirmed {activePitchPlayer.confirmed} &middot; {activePitchPlayer.role}
                  </div>
                </div>
                <span className="lp-wcard-role-pill">
                  {activePitchPlayer.zone === 'gk' ? 'GK' : activePitchPlayer.zone === 'def' ? 'DEF' : activePitchPlayer.zone === 'mid' ? 'MID' : 'FWD'}
                </span>
              </div>

              <div className="lp-wcard-stats">
                <div className="lp-wcard-stat-col">
                  <div className="lp-wcard-stat-label">Goals</div>
                  <div className="lp-wcard-stat-val">{activePitchPlayer.goals}</div>
                  <div className="lp-wcard-stat-sub">This season</div>
                </div>
                <div className="lp-wcard-stat-col">
                  <div className="lp-wcard-stat-label">Assists</div>
                  <div className="lp-wcard-stat-val">{activePitchPlayer.assists}</div>
                  <div className="lp-wcard-stat-sub">This season</div>
                </div>
              </div>

              <div className="lp-wcard-section">
                <div className="lp-wcard-section-label">Formation Selector</div>
                <div className="lp-formation-btns">
                  {(['4-3-3', '4-4-2', '3-5-2'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`lp-formation-btn ${formation === f ? 'is-active' : ''}`}
                      onClick={() => setFormation(f)}
                      aria-pressed={formation === f}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Trust bar under the hero (the pitch runs to the hero's bottom edge) */}
      <div className="container">
        <div className="lp-hero-footer-bar">
          <div className="lp-hero-meta">
            <span className="lp-free"><Check size={15} /> $0 a month, free forever</span>
            <span><Check size={15} /> Your crest, colours &amp; domain</span>
            <span><Check size={15} /> Nothing for supporters to install</span>
          </div>
          {demoClub && (
            <Link href={`/${demoClub.slug}`} className="lp-demo">
              Not ready to claim? Look around {demoClub.name}&apos;s live club site <ArrowRight size={14} />
            </Link>
          )}
          {isAuthenticated && user ? (
            <div className="lp-hero-signin">
              Welcome back, {user.full_name.split(' ')[0]}.{' '}
              <Link href="/my-clubs" className="lp-linkbtn">Go to my clubs</Link>
            </div>
          ) : (
            <div className="lp-hero-signin">
              Already run a club here?{' '}
              <button type="button" className="lp-linkbtn" onClick={() => openAuth('login')}>Sign in</button>
            </div>
          )}
        </div>
      </div>

      {/* ================= THE WEEK: four pictures on the hero's pitch, two words each ================= */}
      <section className="hm-sec" aria-labelledby="hv-week-h">
        <div className="container">
          <div className="hv-head">
            <h2 id="hv-week-h" className="hv-h2">Your week, sorted.</h2>
            <span className="hv-example">Example week</span>
          </div>
          <ol className="hv-week">
            <li className="hv-day">
              <div className="hv-pic" data-theme="dark">
                <div className="hv-fx"><small>Sunday 9:00 am</small><b>Under 12s v Riverside</b><small>Home</small></div>
              </div>
              <p className="hv-cap"><b>Mon</b> Fixture up</p>
            </li>
            <li className="hv-day">
              <div className="hv-pic" data-theme="dark">
                <div className="hv-tally">
                  <div className="is-in"><b>14</b> In</div>
                  <div className="is-maybe"><b>2</b> Maybe</div>
                  <div className="is-out"><b>1</b> Out</div>
                </div>
              </div>
              <p className="hv-cap"><b>Wed</b> Players reply</p>
            </li>
            <li className="hv-day">
              <div className="hv-pic" data-theme="dark">
                <div className="hv-mini" aria-hidden="true">
                  {WEEK_PITCH.map(([x, y, n, kind]) => (
                    <span key={n} className={`hv-tok${kind ? ` is-${kind}` : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>{n}</span>
                  ))}
                </div>
              </div>
              <p className="hv-cap"><b>Fri</b> Team picked</p>
            </li>
            <li className="hv-day">
              <div className="hv-pic" data-theme="dark">
                <div className="hv-goal">
                  <b className="hv-goal-score">2–1</b>
                  <div className="hv-alert"><i aria-hidden="true"><Bell size={16} /></i><span><b>Goal, {displayName}</b><small>67 minutes</small></span></div>
                </div>
              </div>
              <p className="hv-cap"><b>Sun</b> Goal alert sent</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ================= WHO IT'S FOR: one line each ================= */}
      <section className="hm-sec" aria-labelledby="hv-roles-h">
        <div className="container">
          <h2 id="hv-roles-h" className="hv-h2 hv-head">Something for everyone at the club.</h2>
          <ul className="hv-roles">
            {ROLES.map(r => (
              <li key={r.tab}>
                <Link href={r.href} className="hv-role">
                  <span className="hv-role-ic"><r.Icon size={22} aria-hidden="true" /></span>
                  <span><b>{r.tab}</b><span>{r.line}</span></span>
                  <ArrowRight size={16} className="hv-role-go" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= THIS WEEKEND: real clubs' photos, news and games ================= */}
      {clubs.length > 0 && (
        <section className="hm-sec" aria-labelledby="hm-clubs-h">
          <div className="container">
            <div className="hv-head">
              <h2 id="hm-clubs-h" className="hv-h2">This weekend on itsfootball.club.</h2>
              <Link href="/clubs" className="hm-link">All {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}</Link>
            </div>
            {latestPosts.length + boardGames.length > 0 ? (
              <div className={`hv-board${latestPosts.length === 0 ? ' no-posts' : ''}`}>
                {latestPosts.map((p, i) => (
                  <Link key={`${p.kind}-${p.id}`} href={p.href} className={`hv-post${i === 0 ? ' is-big' : ''}`}>
                    <img src={p.image} alt="" loading="lazy" decoding="async" />
                    <span><small>{p.clubName}</small>{p.title}</span>
                  </Link>
                ))}
                {boardGames.map(({ game, club }) => {
                  const live = game.status === 'live' || game.status === 'halftime';
                  const hidden = game.scores_hidden;
                  const homeWon = game.home_score > game.away_score;
                  const awayWon = game.away_score > game.home_score;
                  const side = (name: string, logo: string | null, score: number, dim: boolean) => (
                    <div className={`hm-game-row${dim ? ' is-dim' : ''}`}>
                      {logo ? <img src={logo} alt="" width={26} height={26} loading="lazy" decoding="async" /> : <i aria-hidden="true">{initials(name)}</i>}
                      <span>{name}</span>
                      {!hidden && <b>{score}</b>}
                    </div>
                  );
                  return (
                    <Link key={game.id} href={matchPath(club.slug, game)} className="hm-game">
                      <div className="hm-game-top">
                        <span>{game.team_name || club.short_name || club.name}</span>
                        {live ? (
                          <span className="hm-game-live">{game.status === 'halftime' ? 'Half time' : `Live ${game.current_minute ?? ''}'`}</span>
                        ) : (
                          <span><LocalTime value={game.match_date} /></span>
                        )}
                      </div>
                      {side(game.home_team_name, game.home_team_logo, game.home_score, !hidden && !live && awayWon)}
                      {side(game.away_team_name, game.away_team_logo, game.away_score, !hidden && !live && homeWon)}
                      {hidden && <div className="hm-game-hidden">Scores hidden</div>}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="hm-crests">
                {clubBlocks.map(club => (
                  <Link key={club.id} href={`/${club.slug}`} className="hm-crest">
                    <img src={club.logo_url || DEFAULT_CREST} alt="" width={30} height={30} loading="lazy" decoding="async" />
                    {club.name}
                    {liveClubIds.has(club.id) && <span className="hm-game-live">Live</span>}
                  </Link>
                ))}
                {clubBlocks.length < clubs.length && (
                  <Link href="/clubs" className="hm-crest hm-crest-more">+{clubs.length - clubBlocks.length} more</Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= PRICE: the one number ================= */}
      <section className="hm-sec" aria-labelledby="hv-free-h">
        <div className="container">
          <div className="hv-free">
            <h2 id="hv-free-h" className="hv-zero">$0<span>a month, free forever</span></h2>
            <ul className="hv-nones" aria-label="What you won't pay for">
              {['Subscription', 'Locked features', 'Ads', 'Bank card to sign up'].map(x => (
                <li key={x}><s>{x}</s><span className="sr-only"> none</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= TAGLINE: words light up as they cross the middle of the screen ================= */}
      <section className="hv-say" aria-label="Less chasing. More football.">
        <div className="container">
          <p ref={sayRef} aria-hidden="true">
            {SAY_LINES.map((line, li) => (
              <span key={line} className="hv-say-line">
                {line.split(' ').map((w, wi) => (
                  <span key={w} className={`hv-w${li === SAY_LINES.length - 1 && wi === line.split(' ').length - 1 ? ' is-green' : ''}`}>{w} </span>
                ))}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ================= FAQ: questions only until opened (FAQPage schema) ================= */}
      <section className="hm-sec" aria-labelledby="hm-faq-h">
        <div className="container">
          <div className="hv-head">
            <h2 id="hm-faq-h" className="hv-h2">Questions?</h2>
            <Link href="/faq" className="hm-link">All answers</Link>
          </div>
          <div className="hm-faq-list hv-faq">
            {HOMEPAGE_FAQS.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CLOSE: the hero's action again ================= */}
      <section className="hm-sec hm-sec-last">
        <div className="container">
          <div className="hm-block hv-close">
            <h2 className="hm-h2 hv-h2">Your club&apos;s address is waiting.</h2>
            <div>
              <form className="hv-claim" onSubmit={claimClose}>
                <label htmlFor="hv-club-name">itsfootball.club/</label>
                <input id="hv-club-name" value={closeName} onChange={e => setCloseName(e.target.value)} placeholder="yourclub" autoComplete="off" maxLength={60} />
                <button type="submit">Claim it</button>
              </form>
              <p className="hm-small">$0 a month. No bank card required.</p>
            </div>
          </div>
        </div>
      </section>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
        redirectTo="/my-clubs"
      />

      <Footer />
    </div>
  );
}
