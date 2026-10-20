'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { isListedClub } from '@/lib/public-tournaments';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import SponsorLogo from '@/components/SponsorLogo';
import { useClub, validateClubSlug } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { sponsorHref } from '@/lib/sponsors';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import { DEFAULT_BANNER, DEFAULT_CREST } from '@/lib/crest';
import { CREATE_CLUB_STEPS } from '@/lib/faq';
import './home.css';
import {
  Shield, Radio, Trophy, Users, QrCode, Zap, Globe, ArrowRight, Check, X,
  CheckCircle2, AlertCircle, Flame, Wallet, BarChart3, Newspaper, CalendarCheck, DoorOpen,
  Palette, Crown, Mail, Upload, Search, Images, ArrowLeftRight, Goal, Megaphone,
  Layers, ClipboardList, Share2, Timer, RotateCcw, AlertTriangle, Clock,
} from 'lucide-react';
import { LINEUP_TOOL, PLAYING_TIME_TOOL, RESULT_TOOL, TOOLS_HUB, TOURNAMENT_TOOL } from '@/lib/tool-pages';
import { trackPlatformVisit } from '@/lib/platform-tracking';
import { HOMEPAGE_FAQS } from '@/lib/schema';

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

// The availability tile: a sample of replies, not everyone says yes
const AVAILABILITY = [
  { num: 1, name: 'S. Turner', role: 'Goalkeeper', status: 'in' },
  { num: 4, name: 'L. Davies', role: 'Center Back', status: 'in' },
  { num: 8, name: 'J. Silva', role: 'Playmaker', status: 'in' },
  { num: 15, name: 'R. Grant', role: 'Winger', status: 'maybe' },
  { num: 7, name: 'D. Okafor', role: 'Right Winger', status: 'in' },
  { num: 9, name: 'J. Park', role: 'Striker', status: 'in' },
  { num: 18, name: 'T. Moss', role: 'Striker', status: 'out' },
  { num: 6, name: 'K. Phillips', role: 'Defensive Mid', status: 'in' },
] as const;
const AVAIL_LABEL = { in: 'In', maybe: 'Maybe', out: 'Out' };

const BENCH_SQUAD = [
  { num: 14, name: 'E. Dier', role: 'Sub · CB' },
  { num: 16, name: 'B. White', role: 'Sub · FB' },
  { num: 17, name: 'O. Watkins', role: 'Sub · ST' },
  { num: 19, name: 'C. Wilson', role: 'Sub · MID' },
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

const PASS_TIERS = [
  { id: 'player', label: 'Player', name: 'Alex Morgan', role: 'Senior Squad #10', color: '#10B981', num: '10', type: 'MATCHDAY PASS' },
  { id: 'supporter', label: 'Member', name: 'Jordan Davies', role: 'Grandstand West', color: '#F59E0B', num: 'SEA', type: 'SEASON TICKET' },
  { id: 'official', label: 'Official', name: 'Sarah Chen', role: 'All-Area Access', color: '#A78BFA', num: 'COM', type: 'COMMITTEE' },
] as const;

type PassTierId = typeof PASS_TIERS[number]['id'];

// The free tools teased on the homepage; the rest are on /tools
const HOME_TOOLS = [
  { tool: LINEUP_TOOL, Icon: ClipboardList, color: 'var(--c-blue)', text: 'Pick a formation and download a team sheet.' },
  { tool: PLAYING_TIME_TOOL, Icon: Timer, color: 'var(--c-green)', text: 'Equal minutes for everyone, with a sub plan.' },
  { tool: RESULT_TOOL, Icon: Images, color: 'var(--c-red)', text: 'Turn the final score into an Instagram post.' },
  { tool: TOURNAMENT_TOOL, Icon: Trophy, color: 'var(--c-amber)', text: 'Fixtures, tables and a bracket on one live page.' },
];

// "I'm a..." switcher: each role gets its own pitch and the action that role can actually take.
// secondary: 'demo' links to a live club site, 'share' sends this page to whoever runs the club.
const AUDIENCES = [
  {
    id: 'coach', tab: 'Managers & coaches', Icon: ClipboardList, color: 'var(--c-amber)',
    headline: 'Know your XI before Thursday.',
    body: 'Send one availability link, see who is in, and drag them onto the pitch. On matchday, log goals, cards and subs from the touchline.',
    points: [
      'Players reply in a tap, so no chasing in the group chat',
      'Lineup builder on a tactical pitch, published to the club site',
      'A live match centre you run from your phone',
      'ClubScore rewards turning up, so attendance looks after itself',
    ],
    cta: { label: 'Set up your team', href: '/create-club' }, secondary: 'demo',
  },
  {
    id: 'committee', tab: 'Committee', Icon: Shield, color: 'var(--c-green)',
    headline: 'One dashboard instead of five apps.',
    body: 'Squad, fixtures, members, money, merch, content and sponsors in one place, with roles for your president, secretary and treasurer.',
    points: [
      'Memberships paid by card or bank transfer, with receipts',
      'A club shop for kits and merch, with every order in one ledger',
      'Bulk member import and a QR member pass for everyone',
      'A club website with your crest, colours and own domain',
    ],
    cta: { label: 'Claim your club', href: '/create-club' }, secondary: 'demo',
  },
  {
    id: 'player', tab: 'Players', Icon: Users, color: 'var(--c-sky)',
    headline: 'Your pass, your stats, your streak.',
    body: 'Players never set anything up. Your club adds you, and you get a member pass on your phone, availability in a tap and your goals on the board.',
    points: [
      'A digital member pass with your own QR code',
      'Reply to availability in one tap',
      'Goals, assists and attendance streaks on the ClubScore leaderboard',
      'Nothing to install',
    ],
    cta: { label: 'Find your club', href: '/clubs' }, secondary: 'share',
  },
  {
    id: 'sponsor', tab: 'Sponsors', Icon: Megaphone, color: 'var(--c-purple)',
    headline: 'Proof your money worked.',
    body: 'Back a local club and see what it bought: your logo across their site and events, with every impression and click tracked.',
    points: [
      'Tiered placements across the club site and event pages',
      'Impressions and clicks tracked for you',
      'Sign up and pay online from the club sponsor page',
      'A report ready for renewal talks',
    ],
    cta: { label: 'Find a club to back', href: '/clubs' }, secondary: 'demo',
  },
] as const;

const SPONSOR_TIER_WEIGHT: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, grassroots: 4 };

export default function PlatformHomePage() {
  const router = useRouter();
  const { clubs: allClubs, sponsors } = useClub();
  // Tournament-only clubs (public tournament pages) aren't clubs to show off
  const clubs = useMemo(() => allClubs.filter(isListedClub), [allClubs]);
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
  const [kitStyle, setKitStyle] = useState<KitStyle>('stripes');
  const [isKitFlash, setIsKitFlash] = useState(false);
  const handleKitSelect = (style: KitStyle) => {
    setKitStyle(style);
    setIsKitFlash(true);
    setTimeout(() => setIsKitFlash(false), 1200);
  };
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

  // Holographic Pass & Turnstile state
  const [passTier, setPassTier] = useState<PassTierId>('player');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'granted'>('idle');

  const triggerGateScan = () => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setTimeout(() => {
      setScanState('granted');
    }, 850);
  };

  const claim = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ palette: String(paletteIdx) });
    if (clubName.trim()) params.set('name', clubName.trim());
    router.push(`/create-club?${params}`);
  };

  // Every active sponsor across every club, paired with the club that carries them,
  // sorted so higher tiers surface first within the scrollable strip.
  const allSponsors = useMemo(() => {
    const clubById = new Map(clubs.map(c => [c.id, c]));
    return sponsors
      // Club-wide only - event-scoped sponsors show on their own event's page instead.
      .filter(s => s.is_active && !s.event_id)
      .map(s => ({ sponsor: s, club: clubById.get(s.club_id) }))
      .filter((entry): entry is { sponsor: typeof entry.sponsor; club: NonNullable<typeof entry.club> } => !!entry.club)
      .sort((a, b) => {
        const tierDiff = (SPONSOR_TIER_WEIGHT[a.sponsor.tier] ?? 99) - (SPONSOR_TIER_WEIGHT[b.sponsor.tier] ?? 99);
        if (tierDiff !== 0) return tierDiff;
        return a.sponsor.display_order - b.sponsor.display_order;
      });
  }, [clubs, sponsors]);

  const openAuth = (mode: 'login' | 'signup') => { setAuthMode(mode); setAuthModalOpen(true); };

  // ponytail: the first listed club doubles as the demo; add a demo flag on clubs if it needs curating
  const demoClub = clubs[0];

  const [audIdx, setAudIdx] = useState(0);
  const aud = AUDIENCES[audIdx];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // One marker slides between tabs; measured from the selected tab, re-measured when the row reflows
  const tabListRef = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const list = tabListRef.current;
    if (!list || !('ResizeObserver' in window)) return;
    const place = () => {
      const t = tabRefs.current[audIdx];
      if (t) setInd({ x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth, h: t.offsetHeight });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [audIdx]);
  const onTabKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (audIdx + step + AUDIENCES.length) % AUDIENCES.length;
    setAudIdx(next);
    tabRefs.current[next]?.focus();
  };

  const [copied, setCopied] = useState(false);
  const shareLink = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'itsfootball.club', text: 'Club website, live match centre and member passes for our club?', url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* share sheet dismissed or clipboard blocked */ }
  };

  // Bento visuals play once when they scroll into view. "armed" is only set once JS runs, so without it
  // (or with reduced motion) the visuals simply render in their finished state.
  const rootRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    }, { threshold: 0.5 });
    root.querySelectorAll('.lp-play').forEach(el => io.observe(el));
    setArmed(true);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={`lp${armed ? ' lp-armed' : ''}`} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

              {/* 1.3 Color and kit pattern selection */}
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

                <div className="lp-kit-pattern-col">
                  <span className="lp-swatches-label">Kit Pattern</span>
                  <div className="lp-kit-pill-grid">
                    {[
                      {
                        id: 'solid',
                        label: 'Solid',
                        icon: <span className="lp-pattern-dot" />,
                      },
                      {
                        id: 'stripes',
                        label: 'Stripes',
                        icon: (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <rect x="1" y="1" width="2" height="10" rx="0.5" />
                            <rect x="5" y="1" width="2" height="10" rx="0.5" />
                            <rect x="9" y="1" width="2" height="10" rx="0.5" />
                          </svg>
                        ),
                      },
                      {
                        id: 'sash',
                        label: 'Sash',
                        icon: (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <polygon points="1,11 3.5,11 11,2 8.5,2" />
                          </svg>
                        ),
                      },
                      {
                        id: 'checkered',
                        label: 'Checkered',
                        icon: (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <rect x="1" y="1" width="4.5" height="4.5" />
                            <rect x="6.5" y="6.5" width="4.5" height="4.5" />
                          </svg>
                        ),
                      },
                    ].map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        className={`lp-kit-style-pill ${kitStyle === k.id ? 'is-active' : ''}`}
                        onClick={() => handleKitSelect(k.id as KitStyle)}
                        aria-pressed={kitStyle === k.id}
                      >
                        {k.icon}
                        <span>{k.label}</span>
                      </button>
                    ))}
                  </div>
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
                  <div className={`lp-mock-team-badge ${isKitFlash ? 'is-kit-flash' : ''}`}>
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
                  <span className={`lp-mock-kit-pill ${isKitFlash ? 'is-kit-flash' : ''}`} title={`Active Match Kit: ${kitStyle.toUpperCase()}`}>
                    <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                    <span className="lp-kit-tag-text">{kitStyle.toUpperCase()} KIT</span>
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

      {/* ================= BEFORE / AFTER ================= */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-head lp-head-center lp-reveal">
            <div className="lp-matchday-tag">
              The Matchday Reality Check
            </div>
            <h2 className="lp-h2">Your club runs on volunteers. Not on 40-message group chats.</h2>
            <p className="lp-lede" style={{ maxWidth: 640, margin: '0.65rem auto 0' }}>
              Every grassroots manager knows the Sunday morning panic. Here is what happens when your club runs on itsfootball.club instead.
            </p>
          </div>

          <div className="lp-vs-showcase lp-reveal">
            {/* Left Column: Sunday Morning Group Chat Meltdown */}
            <div className="lp-vs-col lp-vs-chaos">
              <div className="lp-chat-header">
                <div className="lp-chat-title-group">
                  <span className="lp-chat-avatar"><Users size={16} /></span>
                  <div>
                    <div className="lp-chat-name">Sunday League Div 2 Squad (19)</div>
                    <div className="lp-chat-sub">14 unread messages &middot; Sunday 9:18 AM</div>
                  </div>
                </div>
                <span className="lp-chat-badge">BEFORE</span>
              </div>

              <div className="lp-chat-messages">
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Dave M. (Centre Back) <time>8:42 AM</time></div>
                  <div className="lp-bubble-text">Anyone got spare shinpads and socks? Left mine in the boot of someone&apos;s car last week 🤦‍♂️</div>
                </div>
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Kev T. (Striker) <time>8:59 AM</time></div>
                  <div className="lp-bubble-text">Can&apos;t play today, did my back taking the wheelie bins out. Sorry guys</div>
                </div>
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Steve (Coach) <time>9:08 AM</time></div>
                  <div className="lp-bubble-text">That leaves us with 9 players. And who has the council padlock key for Pitch 2??</div>
                </div>
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Marcus (Treasurer) <time>9:14 AM</time></div>
                  <div className="lp-bubble-text">URGENT: 7 of you still owe $15 cash for ref fees. If no ref fee, no match! Bring coins!</div>
                </div>
              </div>

              <div className="lp-chat-footer">
                <AlertTriangle size={15} color="#EF4444" />
                <span>Kick-off in 45 mins &middot; 9 players confirmed &middot; Gate locked &middot; $105 cash missing</span>
              </div>
            </div>

            {/* Right Column: itsfootball.club Match Hub */}
            <div className="lp-vs-col lp-vs-control">
              <div className="lp-hub-header">
                <div className="lp-hub-title-group">
                  <span className="lp-hub-avatar"><Check size={16} /></span>
                  <div>
                    <div className="lp-hub-name">{displayName || 'Eastside Rovers'} Match Hub</div>
                    <div className="lp-hub-sub">Sunday 10:00 AM kick-off &middot; Pitch 1</div>
                  </div>
                </div>
                <span className="lp-hub-badge">AFTER</span>
              </div>

              <div className="lp-hub-cards">
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">1-Tap Squad Confirmation</div>
                    <div className="lp-hub-item-desc">Starting XI + 4 bench picked by Thursday night, straight from players&apos; replies.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Lineup Published to the Club Site</div>
                    <div className="lp-hub-item-desc">The XI on a tactical pitch, at a link anyone can open on their phone.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Subs Paid Online</div>
                    <div className="lp-hub-item-desc">Members pay by card or bank transfer and get a receipt. No coins at the gate.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Ground Map &amp; Member Passes</div>
                    <div className="lp-hub-item-desc">Directions to the ground on the club site, and a QR member pass on every phone.</div>
                  </div>
                </div>
              </div>

              <div className="lp-hub-footer">
                <div className="lp-hub-pill">
                  <span className="pulse-dot" style={{ background: '#10B981', width: 7, height: 7 }} />
                  <span>15 Players Ready &middot; Subs Paid &middot; Live Match Centre Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE BENTO ================= */}
      <section className="lp-section" id="features" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="lp-head lp-reveal">
            <div className="lp-matchday-tag">
              Club Operating System
            </div>
            <h2 className="lp-h2">From kick-off to the clubhouse, in one place.</h2>
            <p className="lp-lede">Everything below is live in the product today. Your committee switches it on; supporters, players and sponsors just open a link.</p>
          </div>

          <div className="lp-bento">
            {/* Match centre */}
            <article className="lp-tile lp-tile-wide lp-reveal" style={{ '--tc': '#F87171' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Radio size={19} /></div>
                <h3>Live match centre</h3>
                <p>Run the clock from the touchline and log goals, assists, cards and subs as they happen. Supporters follow on the club site in real time, with the published lineup on a tactical pitch.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-mc">
                  <div className="lp-mc-score"><small>● LIVE 67&apos;</small>2 – 1</div>
                  <div>
                    <div className="lp-mc-track">
                      <div className="lp-mc-line" />
                      <div className="lp-mc-ht" />
                      <div className="lp-mc-pin" style={{ left: '25%', '--d': '405ms' } as React.CSSProperties}><Goal size={12} /></div>
                      <div className="lp-mc-pin y" style={{ left: '45%', '--d': '730ms' } as React.CSSProperties}><span className="lp-card-yellow m-0" /></div>
                      <div className="lp-mc-pin s" style={{ left: '64%', '--d': '1040ms' } as React.CSSProperties}><ArrowLeftRight size={11} /></div>
                      <div className="lp-mc-pin" style={{ left: '72%', '--d': '1170ms' } as React.CSSProperties}><Goal size={12} /></div>
                    </div>
                    <div className="lp-mc-legend"><span>0&apos;</span><span>HT</span><span>90&apos;</span></div>
                  </div>
                </div>
              </div>
            </article>

            {/* 3D Holographic Member Pass & Gate Scanner */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#34D399' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><QrCode size={19} /></div>
                <h3>Digital member passes</h3>
                <p>Every member gets a pass on their phone with their own QR code. Scan it at the gate or turnstile in under a second.</p>
                <div className="lp-tier-pills" role="group" aria-label="Pass tier">
                  {PASS_TIERS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`lp-tier-pill ${passTier === t.id ? 'is-active' : ''}`}
                      onClick={() => { setPassTier(t.id); setScanState('idle'); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-viz lp-pass-stage">
                {(() => {
                  const currentTier = PASS_TIERS.find(t => t.id === passTier) || PASS_TIERS[0];
                  return (
                    <div className="lp-pass-3d-wrap">
                      <div
                        className={`lp-holo-pass ${scanState === 'granted' ? 'is-granted' : ''}`}
                        style={{ '--tier-color': currentTier.color } as React.CSSProperties}
                      >
                        <div className="lp-holo-sheen" aria-hidden="true" />
                        <div className="lp-holo-head">
                          <div>
                            <span className="lp-holo-type">{currentTier.type}</span>
                            <div className="lp-holo-club">{displayName}</div>
                          </div>
                          <span className="lp-holo-num">{currentTier.num}</span>
                        </div>

                        <div className="lp-holo-body">
                          <div>
                            <div className="lp-holo-name">{currentTier.name}</div>
                            <div className="lp-holo-role">{currentTier.role}</div>
                          </div>
                          <div className="lp-holo-qr-wrap">
                            <QRCodeSVG value={`https://itsfootball.club/${previewSlug}/verify`} size={46} />
                            {scanState === 'scanning' && <div className="lp-laser-sweep" />}
                          </div>
                        </div>

                        <div className="lp-holo-footer">
                          <span className="lp-holo-valid">VALID 2026/27</span>
                          <span className="lp-holo-chip"><Check size={10} /> VERIFIED</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gate Scanner Controller */}
                <div className="lp-turnstile-bar">
                  <button
                    type="button"
                    className={`lp-scan-btn ${scanState === 'scanning' ? 'is-scanning' : ''}`}
                    onClick={triggerGateScan}
                  >
                    <Zap size={13} /> {scanState === 'scanning' ? 'Scanning...' : 'Simulate Gate Scan'}
                  </button>
                  <div className={`lp-turnstile-indicator ${scanState}`}>
                    <span className="lp-turnstile-lamp" />
                    <span>
                      {scanState === 'idle' && 'Turnstile ready'}
                      {scanState === 'scanning' && 'Verifying pass...'}
                      {scanState === 'granted' && 'Gate unlocked'}
                    </span>
                  </div>
                </div>
              </div>
            </article>

            {/* Squad Availability & Match Sheets */}
            <article className="lp-tile lp-tile-wide lp-reveal" style={{ '--tc': '#60A5FA' } as React.CSSProperties}>
              <div className="lp-tile-head-row">
                <div>
                  <div className="lp-tile-ico"><Users size={19} /></div>
                  <h3>1-tap availability &amp; official team sheets</h3>
                  <p>Send one link before Thursday. As players tap in, you pick the XI, publish the lineup to the club site, and the bench knows where they stand.</p>
                </div>
              </div>

              <div className="lp-viz lp-avail-stage">
                <div className="lp-avail-grid">
                  {AVAILABILITY.map(player => (
                    <div key={player.num} className="lp-avail-card">
                      <div className="lp-avail-card-num">#{player.num}</div>
                      <div className="lp-avail-card-info">
                        <div className="lp-avail-card-name">{player.name}</div>
                        <div className="lp-avail-card-role">{player.role}</div>
                      </div>
                      <span className={`lp-avail-card-status is-${player.status}`}>
                        {player.status === 'in' ? <Check size={12} /> : player.status === 'out' ? <X size={12} /> : <Clock size={12} />} {AVAIL_LABEL[player.status]}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="lp-tactical-footer">
                  <div className="lp-avail-badges">
                    <span className="lp-avail-badge in">
                      <Check size={12} /> 15 In
                    </span>
                    <span className="lp-avail-badge maybe">
                      <Clock size={12} /> 1 Maybe
                    </span>
                    <span className="lp-avail-badge out">
                      <X size={12} /> 2 Out
                    </span>
                  </div>
                  <div className="lp-bench-row">
                    <span className="lp-bench-heading">Bench:</span>
                    <div className="lp-bench-tags">
                      {BENCH_SQUAD.map(b => (
                        <span key={b.num} className="lp-bench-tag" title={b.role}>
                          #{b.num} {b.name.split(' ')[1]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>


            {/* Payments */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#FBBF24' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Wallet size={19} /></div>
                <h3>Subs, shop &amp; finances</h3>
                <p>Membership plans paid by card (Stripe) or bank transfer, with automatic receipts, and a club shop for kits and merch. Every payment lands in one ledger.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-money">
                  <div className="lp-money-top"><b>$2,340</b><small>of $3,000 season subs</small></div>
                  <div className="lp-bar"><i /></div>
                  <div className="lp-tx"><span>Senior membership · J. Park</span><em>+$120</em></div>
                  <div className="lp-tx"><span>Kit sponsor · Northside Motors</span><em>+$800</em></div>
                  <div className="lp-tx"><span>Shop · Home shirt (M) ×2</span><em>+$90</em></div>
                </div>
              </div>
            </article>

            {/* Sponsors */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#A78BFA' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><BarChart3 size={19} /></div>
                <h3>Sponsor hub</h3>
                <p>Tiered sponsor spots across your site, with tracked impressions and clicks. Export the report when it&apos;s time to renew.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-spark">
                  {[30, 42, 38, 55, 48, 62, 58, 75, 70, 88, 82, 96].map((h, i) => <i key={i} style={{ height: `${h}%`, '--i': i } as React.CSSProperties} />)}
                </div>
                <div className="lp-kpis">
                  <div className="lp-kpi"><b>12.4k</b><small>Impressions</small></div>
                  <div className="lp-kpi"><b>486</b><small>Clicks</small></div>
                  <div className="lp-kpi"><b>3.9%</b><small>CTR</small></div>
                </div>
              </div>
            </article>

            {/* Tournaments */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#2DD4BF' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Trophy size={19} /></div>
                <h3>Tournaments &amp; cups</h3>
                <p>Knockout brackets, round-robin leagues and group stages. Tables update themselves as you enter scores.</p>
              </div>
              <div className="lp-viz">
                <div className="lp-bracket">
                  <div className="lp-bracket-col">
                    <div className="lp-bm"><div className="w"><span>Lions</span><b>3</b></div><div><span>Eagles</span><b>1</b></div></div>
                    <div className="lp-bm"><div><span>Rovers</span><b>0</b></div><div className="w"><span>United</span><b>2</b></div></div>
                  </div>
                  <div className="lp-bracket-col">
                    <div className="lp-bm"><div className="w"><span>Lions</span><b>2</b></div><div><span>United</span><b>1</b></div></div>
                  </div>
                  <div className="lp-trophy"><Trophy size={28} />Lions</div>
                </div>
              </div>
            </article>

            {/* ClubScore */}
            <article className="lp-tile lp-tile-wide lp-reveal" style={{ '--tc': '#FB923C' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Flame size={19} /></div>
                <h3>ClubScore: turn up, climb up</h3>
                <p>Points for goals, assists, clean sheets and, most of all, showing up. Attendance streaks earn badges, and the leaderboard does the motivating so the coach doesn&apos;t have to.</p>
              </div>
              <div className="lp-viz">
                <div className="lp-lb">
                  <div className="lp-lb-row"><span className="lp-lb-rank">01</span><b>Marco Silva</b><span className="lp-lb-badge"><Flame size={11} /> Iron Man 5-Streak</span><span className="lp-lb-pts">412</span></div>
                  <div className="lp-lb-row"><span className="lp-lb-rank">02</span><b>Dami Okafor</b><span className="lp-lb-badge"><Flame size={11} /> 3-Streak</span><span className="lp-lb-pts">388</span></div>
                  <div className="lp-lb-row"><span className="lp-lb-rank">03</span><b>Jae Park</b><span /><span className="lp-lb-pts">351</span></div>
                </div>
              </div>
            </article>
          </div>

          <div className="lp-chips lp-reveal">
            {[
              [Newspaper, 'News, reports & video'],
              [Images, 'Homepage hero carousel'],
              [CalendarCheck, 'Events & socials'],
              [DoorOpen, 'Door self check-in'],
              [Layers, 'Seasons'],
              [Crown, 'Committee showcase'],
              [Palette, 'Crest, colours & kit'],
              [Globe, 'Custom domain'],
              [BarChart3, 'Visitor analytics'],
              [Mail, 'Contact inbox'],
              [Upload, 'Bulk member import'],
              [Search, 'Built for Google'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Globe;
              return <span key={label as string} className="lp-chip"><I size={15} /> {label as string}</span>;
            })}
          </div>
        </div>
      </section>

      {/* ================= AUDIENCE SWITCHER ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="lp-head lp-head-center lp-reveal">
            <div className="lp-matchday-tag">
              Every Matchday Role
            </div>
            <h2 className="lp-h2">What&apos;s in it for you?</h2>
          </div>
          <div className="lp-reveal">
            <div ref={tabListRef} className={`lp-aud-tabs${ind ? ' has-ind' : ''}`} role="tablist" aria-label="I am a" onKeyDown={onTabKey}>
              {ind && (
                <span
                  className="lp-aud-ind"
                  aria-hidden="true"
                  style={{ transform: `translate(${ind.x}px, ${ind.y}px)`, width: ind.w, height: ind.h, '--rc': aud.color } as React.CSSProperties}
                />
              )}
              {AUDIENCES.map((a, i) => (
                <button
                  key={a.id}
                  ref={el => { tabRefs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`lp-aud-tab-${a.id}`}
                  aria-selected={i === audIdx}
                  aria-controls="lp-aud-panel"
                  tabIndex={i === audIdx ? 0 : -1}
                  className="lp-aud-tab"
                  style={{ '--rc': a.color } as React.CSSProperties}
                  onClick={() => setAudIdx(i)}
                >
                  <a.Icon size={16} /> {a.tab}
                </button>
              ))}
            </div>
            <div
              key={aud.id}
              id="lp-aud-panel"
              role="tabpanel"
              aria-labelledby={`lp-aud-tab-${aud.id}`}
              className="lp-aud-panel"
              style={{ '--rc': aud.color } as React.CSSProperties}
            >
              <div>
                <div className="lp-role-who"><aud.Icon size={14} /> {aud.tab}</div>
                <h3>{aud.headline}</h3>
                <p>{aud.body}</p>
                <div className="lp-aud-actions">
                  <Link href={aud.cta.href} className="btn btn-primary">
                    {aud.cta.label} <ArrowRight size={16} />
                  </Link>
                  {aud.secondary === 'share' ? (
                    <button type="button" className="btn btn-secondary" onClick={shareLink}>
                      <Share2 size={16} /> <span aria-live="polite">{copied ? 'Link copied' : 'Send this to your committee'}</span>
                    </button>
                  ) : demoClub && (
                    <Link href={`/${demoClub.slug}`} className="btn btn-secondary">See a live club site</Link>
                  )}
                </div>
              </div>
              <ul className="lp-aud-points">
                {aud.points.map(pt => <li key={pt}><Check size={16} /><span>{pt}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="lp-head lp-reveal">
            <div className="lp-matchday-tag">
              3-Minute Setup
            </div>
            <h2 className="lp-h2">Live before your next training session.</h2>
          </div>
          <div className="lp-steps">
            {CREATE_CLUB_STEPS.map((s, i) => (
              <div key={s.name} className="lp-step lp-reveal">
                <div className="lp-step-marker">
                  <span className="lp-step-badge">STEP 0{i + 1}</span>
                  <span className="lp-step-milestone">{s.milestone}</span>
                </div>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FREE TOOLS (no club needed) ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }} aria-labelledby="lp-tools-h">
        <div className="container">
          <div className="lp-head lp-head-split lp-reveal">
            <div>
              <div className="lp-matchday-tag">Free tools</div>
              <h2 id="lp-tools-h" className="lp-h2">Not ready for a club site? Start with a tool.</h2>
            </div>
            <Link href={TOOLS_HUB.path} className="btn btn-secondary lp-head-link">
              All free tools <ArrowRight size={16} />
            </Link>
          </div>
          <div className="lp-tools">
            {HOME_TOOLS.map(t => (
              <Link key={t.tool.path} href={t.tool.path} className="lp-tile lp-tool lp-reveal" style={{ '--tc': t.color } as React.CSSProperties}>
                <div className="lp-tile-ico"><t.Icon size={20} /></div>
                <div>
                  <h3>{t.tool.label} <ArrowRight size={14} className="lp-tool-arrow" /></h3>
                  <p>{t.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PROOF: real clubs and their sponsors ================= */}
      {clubs.length > 0 && (
        <section className="lp-section" style={{ paddingTop: 0 }} aria-labelledby="lp-clubs-h">
          <div className="container">
            <div className="lp-head lp-head-split lp-reveal">
              <div>
                <div className="lp-matchday-tag">On the network</div>
                <h2 id="lp-clubs-h" className="lp-h2">Clubs already on the pitch.</h2>
                <p className="lp-lede">
                  {clubs.length} {clubs.length === 1 ? 'club runs' : 'clubs run'} on itsfootball.club
                  {allSponsors.length > 0 && <>, backed by {allSponsors.length} local {allSponsors.length === 1 ? 'sponsor' : 'sponsors'}</>}.
                </p>
              </div>
              <Link href="/clubs" className="btn btn-secondary lp-head-link">
                Browse all clubs <ArrowRight size={16} />
              </Link>
            </div>
            <div className="lp-clubs">
              {clubs.slice(0, 6).map(club => (
                <Link
                  key={club.id}
                  href={`/${club.slug}`}
                  className="lp-clubcard lp-reveal"
                  style={{ '--cc': club.primary_color } as React.CSSProperties}
                >
                  <div className="lp-clubcard-banner">
                    <img className="bg" src={club.banner_url || DEFAULT_BANNER} alt="" loading="lazy" decoding="async" />
                  </div>
                  <div className="lp-clubcard-body">
                    <img className="lp-clubcard-crest" src={club.logo_url || DEFAULT_CREST} alt={`${club.name} crest`} width={56} height={56} loading="lazy" decoding="async" />
                    <h3>{club.name}</h3>
                    <div className="lp-clubcard-meta">{club.short_name} · Est. {club.founded_year}{club.stadium_name ? ` · ${club.stadium_name}` : ''}</div>
                    <div className="lp-clubcard-url">{club.custom_domain || `itsfootball.club/${club.slug}`} <ArrowRight size={13} /></div>
                  </div>
                </Link>
              ))}
            </div>

            {allSponsors.length > 0 && (
              <>
                <h3 className="lp-subhead lp-reveal">Backed by local sponsors</h3>
                <div className="sponsor-scroll-strip">
                  {allSponsors.map(({ sponsor, club }) => {
                    const href = sponsorHref(sponsor.website_url);
                    const isPlatinum = sponsor.tier === 'platinum' || sponsor.size_scale === 'xl';
                    const isGold = sponsor.tier === 'gold' || sponsor.size_scale === 'lg';
                    return (
                      <a
                        key={sponsor.id}
                        href={href || `/${club.slug}`}
                        target={href ? '_blank' : undefined}
                        rel={href ? 'noopener noreferrer' : undefined}
                        className="glass-panel glass-panel-interactive sponsor-scroll-card lp-sponsor"
                        style={{ '--sc': isPlatinum ? '#F59E0B' : club.primary_color } as React.CSSProperties}
                      >
                        <SponsorLogo src={sponsor.logo_url} name={sponsor.name} height={isPlatinum ? 56 : isGold ? 46 : 38} style={{ maxWidth: '100%' }} />
                        <div className="lp-sponsor-name">{sponsor.name}</div>
                        <div className="lp-sponsor-club">
                          <img loading="lazy" decoding="async" width={18} height={18} src={club.logo_url || DEFAULT_CREST} alt="" />
                          <span className="text-meta">{club.short_name} · <span className="lp-sponsor-tier">{sponsor.tier}</span></span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }} aria-labelledby="lp-faq-h">
        <div className="container lp-faq">
          <div className="lp-head lp-head-center lp-reveal">
            <div className="lp-matchday-tag">Committee FAQ</div>
            <h2 id="lp-faq-h" className="lp-h2">Frequently asked questions.</h2>
            <p className="lp-lede">Everything club committees, volunteers, and managers ask before getting started.</p>
          </div>
          <div className="lp-faq-list">
            {HOMEPAGE_FAQS.map(f => (
              <details key={f.q} className="glass-panel lp-faq-item">
                <summary>
                  <span>{f.q}</span>
                  <span className="lp-faq-icon" aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <div className="lp-faq-more">
            <Link href="/faq">Read the full FAQ with all 30+ answers <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="lp-final lp-reveal" data-theme="dark">
            <div className="lp-matchday-tag" style={{ justifyContent: 'center' }}><Zap size={13} /> Free to set up &middot; No credit card required</div>
            <h2 className="lp-h2">Give your club the matchday it deserves.</h2>
            <p>Set up your club website, fixtures, squad and member passes this week, and run your next match live from the touchline.</p>
            <div className="lp-final-actions">
              <Link href="/create-club" className="btn btn-primary btn-lg lp-head-link">
                Create your club <ArrowRight size={18} />
              </Link>
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
