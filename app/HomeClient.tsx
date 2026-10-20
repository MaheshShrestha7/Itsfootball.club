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
import ScoreboardDigitRoll from '@/components/ScoreboardDigitRoll';
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
  Layers, ClipboardList, Share2, Timer, RotateCcw, AlertTriangle, Clock, Crosshair, ChevronRight, ChevronDown, FileText,
} from 'lucide-react';
import { LINEUP_TOOL, PLAYING_TIME_TOOL, RESULT_TOOL, TOOLS_HUB, TOURNAMENT_TOOL } from '@/lib/tool-pages';
import { trackPlatformVisit } from '@/lib/platform-tracking';
import { HOMEPAGE_FAQS } from '@/lib/schema';

interface DugoutEvent {
  id: string;
  minute: number;
  type: 'goal' | 'sub' | 'yellow' | 'red';
  headline: string;
  detail: string;
  isHome?: boolean;
}

const DEFAULT_EVENTS: DugoutEvent[] = [
  { id: '1', minute: 71, type: 'goal', headline: 'GOAL!', detail: 'D. Okafor, assist M. Silva', isHome: true },
  { id: '2', minute: 58, type: 'sub', headline: 'Sub', detail: 'J. Park on for L. Hughes', isHome: true },
  { id: '3', minute: 41, type: 'yellow', headline: 'Yellow card', detail: 'Riverside #6 (tactical foul)' },
  { id: '4', minute: 23, type: 'goal', headline: 'Goal', detail: 'M. Silva (free kick)', isHome: true },
];

const KIT_STYLES = [
  { id: 'solid', label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'sash', label: 'Sash' },
  { id: 'checkered', label: 'Checkered' },
] as const;

type KitStyle = typeof KIT_STYLES[number]['id'];

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
  rating: number;
  avgPos: { x: number; y: number };
  zone: 'gk' | 'def' | 'mid' | 'att';
}

const TACTICAL_ROSTER: TacticalPlayer[] = [
  { num: 1, label: '1', name: 'S. Turner', role: 'Goalkeeper', confirmed: 'Thursday 7:22 PM', goals: 0, assists: 1, rating: 7.9, avgPos: { x: 14, y: 50 }, zone: 'gk' },
  { num: 3, label: '3', name: 'M. Romero', role: 'Right Back', confirmed: 'Thursday 6:40 PM', goals: 2, assists: 0, rating: 7.6, avgPos: { x: 32, y: 22 }, zone: 'def' },
  { num: 4, label: '4', name: 'L. Davies', role: 'Center Back', confirmed: 'Wednesday 8:02 PM', goals: 1, assists: 1, rating: 7.8, avgPos: { x: 30, y: 40 }, zone: 'def' },
  { num: 5, label: '5', name: 'C. Dawson', role: 'Center Back', confirmed: 'Wednesday 9:15 PM', goals: 1, assists: 3, rating: 7.5, avgPos: { x: 30, y: 60 }, zone: 'def' },
  { num: 2, label: '2', name: 'J. Lewis', role: 'Left Back', confirmed: 'Thursday 8:30 PM', goals: 0, assists: 4, rating: 7.7, avgPos: { x: 32, y: 80 }, zone: 'def' },
  { num: 12, label: '12', name: 'L. Hughes', role: 'Right Midfielder', confirmed: 'Tuesday 6:15 PM', goals: 4, assists: 6, rating: 7.4, avgPos: { x: 50, y: 24 }, zone: 'mid' },
  { num: 8, label: '8', name: 'J. Silva', role: 'Playmaker', confirmed: 'Wednesday 5:45 PM', goals: 9, assists: 11, rating: 8.4, avgPos: { x: 54, y: 48 }, zone: 'mid' },
  { num: 6, label: '6', name: 'K. Phillips', role: 'Defensive Mid', confirmed: 'Thursday 7:10 PM', goals: 2, assists: 5, rating: 7.9, avgPos: { x: 46, y: 76 }, zone: 'mid' },
  { num: 10, label: '10', name: 'K. De Bruyne', role: 'Attacking Mid', confirmed: 'Wednesday 4:20 PM', goals: 8, assists: 14, rating: 8.8, avgPos: { x: 65, y: 50 }, zone: 'mid' },
  { num: 7, label: '7', name: 'D. Okafor', role: 'Right Winger', confirmed: 'Thursday 6:15 PM', goals: 14, assists: 4, rating: 8.2, avgPos: { x: 74, y: 22 }, zone: 'att' },
  { num: 9, label: '9', name: 'J. Park', role: 'Striker', confirmed: 'Thursday 9:00 PM', goals: 7, assists: 8, rating: 8.6, avgPos: { x: 80, y: 50 }, zone: 'att' },
  { num: 11, label: '11', name: 'S. Adebayo', role: 'Left Winger', confirmed: 'Wednesday 8:20 PM', goals: 6, assists: 5, rating: 8.1, avgPos: { x: 74, y: 80 }, zone: 'att' },
];

const BENCH_SQUAD = [
  { num: 14, name: 'E. Dier', role: 'Sub · CB' },
  { num: 16, name: 'B. White', role: 'Sub · FB' },
  { num: 17, name: 'O. Watkins', role: 'Sub · ST' },
  { num: 19, name: 'C. Wilson', role: 'Sub · MID' },
];

const FORMATIONS: Record<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2', { label: string; coords: [number, number][] }> = {
  '4-3-3': {
    label: '4-3-3',
    coords: [
      [11, 50],  // 0: GK
      [29, 18],  // 1: 3
      [31, 39],  // 2: 4
      [31, 61],  // 3: 5
      [29, 82],  // 4: DF
      [48, 22],  // 5: MF
      [48, 50],  // 6: 8
      [48, 78],  // 7: 6
      [63, 50],  // 8: 10
      [74, 20],  // 9: 7
      [78, 50],  // 10: 9
      [74, 80],  // 11: 11
    ],
  },
  '4-4-2': {
    label: '4-4-2',
    coords: [
      [11, 50],  // 0: GK
      [29, 18],  // 1: 3
      [31, 39],  // 2: 4
      [31, 61],  // 3: 5
      [29, 82],  // 4: DF
      [50, 18],  // 5: MF
      [48, 38],  // 6: 8
      [48, 62],  // 7: 6
      [62, 50],  // 8: 10
      [50, 82],  // 9: 7
      [78, 38],  // 10: 9
      [78, 62],  // 11: 11
    ],
  },
  '3-5-2': {
    label: '3-5-2',
    coords: [
      [11, 50],  // 0: GK
      [29, 26],  // 1: 3
      [27, 50],  // 2: 4
      [29, 74],  // 3: 5
      [49, 86],  // 4: DF
      [49, 14],  // 5: MF
      [47, 36],  // 6: 8
      [44, 50],  // 7: 6
      [60, 50],  // 8: 10
      [47, 64],  // 9: 7
      [78, 38],  // 10: 9
      [78, 62],  // 11: 11
    ],
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    coords: [
      [11, 50],  // 0: GK
      [29, 18],  // 1: 3
      [31, 39],  // 2: 4
      [31, 61],  // 3: 5
      [29, 82],  // 4: DF
      [46, 36],  // 5: MF
      [46, 64],  // 6: 6
      [62, 50],  // 7: 8
      [64, 50],  // 8: 10
      [74, 18],  // 9: 7
      [80, 50],  // 10: 9
      [74, 82],  // 11: 11
    ],
  },
};

const TACTICAL_LINKS: Record<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2', [number, number, boolean?][]> = {
  '4-3-3': [
    [0, 2, true],
    [1, 2, false],
    [2, 3, false],
    [3, 4, false],
    [2, 6, true],
    [3, 6, true],
    [6, 5, true],
    [6, 7, true],
    [6, 8, true],
    [8, 10, true],
    [5, 9, true],
    [7, 11, true],
  ],
  '4-4-2': [
    [1, 2, false],
    [2, 3, false],
    [3, 4, false],
    [2, 6, true],
    [3, 7, true],
    [6, 5, true],
    [7, 9, true],
    [6, 8, true],
    [7, 8, true],
    [8, 10, true],
    [8, 11, true],
  ],
  '3-5-2': [
    [1, 2, false],
    [2, 3, false],
    [2, 7, true],
    [7, 6, true],
    [7, 9, true],
    [6, 8, true],
    [9, 8, true],
    [8, 10, true],
    [8, 11, true],
  ],
  '4-2-3-1': [
    [1, 2, false],
    [2, 3, false],
    [3, 4, false],
    [2, 5, true],
    [3, 6, true],
    [5, 7, true],
    [6, 7, true],
    [7, 8, true],
    [8, 10, true],
    [7, 9, true],
    [7, 11, true],
  ],
};


const PASS_TIERS = [
  { id: 'player', label: 'Player', name: 'Alex Morgan', role: 'Senior Squad #10', color: '#10B981', num: '10', type: 'MATCHDAY PASS' },
  { id: 'supporter', label: 'Member', name: 'Jordan Davies', role: 'Grandstand West', color: '#F59E0B', num: 'SEA', type: 'SEASON TICKET' },
  { id: 'official', label: 'Official', name: 'Sarah Chen', role: 'All-Area Access', color: '#A78BFA', num: 'COM', type: 'COMMITTEE' },
] as const;

type PassTierId = typeof PASS_TIERS[number]['id'];

// The free tools teased on the homepage; the rest are on /tools
const HOME_TOOLS = [
  { tool: LINEUP_TOOL, Icon: ClipboardList, color: 'var(--c-blue)', text: 'Pick a formation, name your players and download a team sheet for the group chat.' },
  { tool: PLAYING_TIME_TOOL, Icon: Timer, color: 'var(--c-green)', text: 'Give every player the same minutes, with a sub schedule you can print or send.' },
  { tool: RESULT_TOOL, Icon: Images, color: 'var(--c-red)', text: 'Turn the full-time score and scorers into a story or post for Instagram.' },
  { tool: TOURNAMENT_TOOL, Icon: Trophy, color: 'var(--c-amber)', text: 'Draw the fixtures and share a live page with tables and a bracket.' },
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

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'FC';
  return words.length === 1 ? words[0].slice(0, 3).toUpperCase() : words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

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
  const [events, setEvents] = useState<DugoutEvent[]>([
    { id: '1', minute: 72, type: 'goal', headline: '72\' Goal', detail: 'J. Silva, Home' },
    { id: '2', minute: 68, type: 'yellow', headline: '68\' Yellow Card', detail: 'T. Cole, Away' },
    { id: '3', minute: 65, type: 'sub', headline: '65\' Sub', detail: 'Tactical replacement' },
    { id: '4', minute: 55, type: 'red', headline: '55\' Red Card', detail: 'M. Evans, Away' },
  ]);
  const [kitStyle, setKitStyle] = useState<KitStyle>('stripes');
  const [isKitFlash, setIsKitFlash] = useState(false);
  const handleKitSelect = (style: KitStyle) => {
    setKitStyle(style);
    setIsKitFlash(true);
    setTimeout(() => setIsKitFlash(false), 1200);
  };
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  // Tactical Pitch state & Dynamic 3D Tilt
  const [formation, setFormation] = useState<'4-3-3' | '4-4-2' | '3-5-2'>('4-3-3');
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(8);
  const activePitchPlayer = TACTICAL_ROSTER.find(p => p.num === selectedPitchPlayer) || TACTICAL_ROSTER[6];
  const [pitchTilt, setPitchTilt] = useState({ x: 26, y: 0 });
  const pitchRef = useRef<HTMLDivElement>(null);

  const handlePitchMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setPitchTilt({
      x: 26 - y * 14,
      y: x * 12,
    });
  };

  const handlePitchMouseLeave = () => {
    setPitchTilt({ x: 26, y: 0 });
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
    const newEv: DugoutEvent = {
      id: String(Date.now()),
      minute: minute,
      type: 'goal',
      headline: `${minute}' Goal`,
      detail: `${displayName} scores! Touchline eruption`,
      isHome: true,
    };
    setEvents(prev => [newEv, ...prev.slice(0, 3)]);
  };

  const triggerSub = () => {
    const isSilva = subInPlayer.includes('Silva');
    setSubInPlayer(isSilva ? 'J. Park #10' : 'J. Silva #8');
    setSubOutPlayer(isSilva ? 'L. Hughes #7' : 'L. Baker #11');
    const newEv: DugoutEvent = {
      id: String(Date.now()),
      minute: minute,
      type: 'sub',
      headline: `${minute}' Sub`,
      detail: isSilva ? '#10 J. Park on' : '#8 J. Silva on',
      isHome: true,
    };
    setEvents(p => [newEv, ...p.slice(0, 3)]);
  };

  const triggerCard = () => {
    const nextCard: 'yellow' | 'red' | null = refCardActive === 'yellow' ? 'red' : refCardActive === 'red' ? null : 'yellow';
    setRefCardActive(nextCard);
    if (nextCard) {
      const newEv: DugoutEvent = {
        id: String(Date.now()),
        minute: minute,
        type: nextCard,
        headline: nextCard === 'red' ? `${minute}' Red Card` : `${minute}' Yellow Card`,
        detail: nextCard === 'red' ? 'M. Evans, violent tackle' : 'T. Cole, tactical foul',
      };
      setEvents(p => [newEv, ...p.slice(0, 3)]);
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
    setSubInPlayer('J. Silva #8');
    setSubOutPlayer('L. Baker #11');
    setRefCardActive(null);
    setEvents(DEFAULT_EVENTS);
  };

  const isDugoutModified = homeScore !== 2 || matchStatus !== 'live' || refCardActive !== null || events.length !== 4;

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 10), y: x * 10 });
  };

  const handleStageMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Holographic Pass & Turnstile state
  const [passTier, setPassTier] = useState<PassTierId>('player');
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'granted'>('idle');
  const [passTilt, setPassTilt] = useState({ x: 0, y: 0 });

  const triggerGateScan = () => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setTimeout(() => {
      setScanState('granted');
    }, 850);
  };

  const handlePassMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setPassTilt({ x: -(y * 14), y: x * 14 });
  };

  const handlePassMouseLeave = () => {
    setPassTilt({ x: 0, y: 0 });
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
              {/* 1.1 "Grassroot club. Big-club matchday" section */}
              <h1 className="lp-h1">
                <span className="sr-only">Free football club website with live match centre — </span>
                Grassroots club.<br />
                Big-club matchday.
              </h1>

              <p className="lp-hero-sub">
                Empowering your local club with professional matchday tools.
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
                  <div className="lp-swatches-header">
                    <span className="lp-swatches-label">Primary</span>
                    <span className="lp-swatches-label">Secondary</span>
                    <span className="lp-swatches-label">Tertiary</span>
                  </div>
                  <div className="lp-swatch-boxes" role="group" aria-label="Palette selection">
                    {[
                      { name: 'Navy Blue', hex: '#0F1E36' },
                      { name: 'White', hex: '#FFFFFF' },
                      { name: 'Gold', hex: '#D4AF37' },
                      { name: 'Red', hex: '#DC2626' },
                      { name: 'Green', hex: '#16A34A' },
                    ].map((sw, i) => (
                      <button
                        key={sw.name}
                        type="button"
                        className={`lp-swatch-box ${paletteIdx === i ? 'is-active' : ''}`}
                        style={{ background: sw.hex }}
                        onClick={() => setPaletteIdx(i)}
                        title={sw.name}
                      />
                    ))}
                  </div>
                  <div className="lp-swatch-dropdown-chips">
                    <button
                      type="button"
                      className="lp-chip-dropdown is-active"
                      onClick={() => setPaletteIdx((paletteIdx + 1) % FOOTBALL_COLOR_PALETTES.length)}
                    >
                      <span className="lp-chip-dot" style={{ background: palette.primary }} />
                      <span>{palette.name.split(' ')[0] || 'Navy Blue'}</span>
                      <ChevronDown size={12} />
                    </button>
                    <span className="lp-chip-dropdown">
                      <span className="lp-chip-dot" style={{ background: '#D4AF37' }} />
                      <span>Gold</span>
                    </span>
                    <span className="lp-chip-dropdown">
                      <span className="lp-chip-dot" style={{ background: '#16A34A' }} />
                      <span>Green</span>
                    </span>
                  </div>
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
                        onClick={() => handleKitSelect(k.id as any)}
                        title={`Select ${k.label} Kit Pattern`}
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
            ref={stageRef}
            className="lp-stage"
            aria-hidden="true"
            data-theme="dark"
            onMouseMove={handleStageMouseMove}
            onMouseLeave={handleStageMouseLeave}
          >
            <div
              className="lp-browser"
              style={{
                transform: `perspective(1000px) rotateX(${tilt.x * 0.35}deg) rotateY(${tilt.y * 0.35}deg)`,
              }}
            >
              <div className="lp-browser-bar">
                <div className="lp-dots">
                  <i className="dot-red" />
                  <i className="dot-yellow" />
                  <i className="dot-green" />
                </div>
                <div className="lp-browser-tab">
                  <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                  <span>itsfootball.club - Matchday Center</span>
                </div>
                <div className="lp-url">itsfootball.club</div>
              </div>

              <div className={`lp-score ${isGoalFlash ? 'is-goal-flash' : ''}`}>
                <div className="lp-mock-clock">{minute}:14</div>

                <div className="lp-mock-score-row">
                  <div className={`lp-mock-team-badge ${isKitFlash ? 'is-kit-flash' : ''}`} title={`Home Kit: ${kitStyle}`}>
                    <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                    <span className="lp-mock-team">HOME</span>
                  </div>
                  <div className="lp-mock-digit">{homeScore}</div>
                  <span className="lp-mock-colon">:</span>
                  <div className="lp-mock-digit">{awayScore}</div>
                  <div className="lp-mock-team-badge">
                    <span className="lp-mock-team">AWAY</span>
                  </div>
                </div>

                <div className="lp-mock-live-wrap">
                  <span className="lp-mock-live-badge">● Live Match</span>
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
                    title="Celebrate a goal and advance the score roll"
                  >
                    <Goal size={16} />
                    <span>Goal!</span>
                  </button>
                  <button
                    type="button"
                    className="lp-action-card btn-sub"
                    onClick={triggerSub}
                    title="Execute player substitution on LED board"
                  >
                    <ArrowLeftRight size={16} />
                    <span>Sub</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-card ${refCardActive ? 'is-active' : ''}`}
                    onClick={triggerCard}
                    title="Cycle referee yellow/red cards"
                  >
                    <span className="lp-mini-card" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-half ${matchStatus === 'halftime' ? 'is-active' : ''}`}
                    onClick={triggerHalfTime}
                    title="Toggle half time whistle"
                  >
                    <Clock size={16} />
                    <span>Half Time</span>
                  </button>
                  <button
                    type="button"
                    className={`lp-action-card btn-end ${matchStatus === 'ended' ? 'is-active' : ''}`}
                    onClick={triggerEndMatch}
                    title="Full time whistle"
                  >
                    <X size={16} />
                    <span>End Match</span>
                  </button>
                </div>

                {/* Live Match Events Summary (2-column layout matching mockup) */}
                <div className="lp-mockup-events">
                  <div className="lp-mockup-events-title">Live Match Events</div>
                  <div className="lp-mockup-events-grid">
                    <div className="lp-mockup-events-col-left">
                      <div className="lp-mock-event">
                        <Goal size={13} color="#10B981" />
                        <span className="lp-mock-ev-time">72&apos; Goal</span>
                        <span className="lp-mock-ev-desc">J. Silva, Home</span>
                      </div>
                    </div>
                    <div className="lp-mockup-events-col-right">
                      <div className="lp-mock-event">
                        <span className="lp-card-yellow" />
                        <span className="lp-mock-ev-time">68&apos;</span>
                        <span className="lp-mock-ev-desc yellow"><b>Yellow Card</b> T. Cole, Away</span>
                      </div>
                      <div className="lp-mock-event">
                        <ArrowLeftRight size={12} color="#10B981" />
                        <span className="lp-mock-ev-time">65&apos;</span>
                        <span className="lp-mock-ev-desc green"><b>Sub</b></span>
                      </div>
                      <div className="lp-mock-event">
                        <span className="lp-card-red" />
                        <span className="lp-mock-ev-time">55&apos;</span>
                        <span className="lp-mock-ev-desc red"><b>Red Card</b> M. Evans, Away</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* 3. Just underneath 1 & 2: Lineup graphic (interactive) showing as if layed beneath 1 & 2 */}
          <div className="lp-hero-pitch-layer">
            <div className="lp-hero-pitch-grid">
              <div
                ref={pitchRef}
              className="lp-pitch-3d-scene"
              onMouseMove={handlePitchMouseMove}
              onMouseLeave={handlePitchMouseLeave}
            >
              <div
                className="lp-tactical-pitch"
                style={{
                  transform: `rotateX(${pitchTilt.x}deg) rotateY(${pitchTilt.y}deg) scale(0.96)`,
                }}
              >
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
                    const fromCoord = FORMATIONS[formation].coords[fromIdx];
                    const toCoord = FORMATIONS[formation].coords[toIdx];
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

                {/* 11 3D Neon Glowing Player Tokens */}
                {FORMATIONS[formation].coords.map(([x, y], i) => {
                  const player = TACTICAL_ROSTER[i];
                  const isSelected = selectedPitchPlayer === player.num;
                  return (
                    <button
                      key={player.num}
                      type="button"
                      className={`lp-pitch-token zone-${player.zone} ${isSelected ? 'is-selected' : ''}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onClick={() => setSelectedPitchPlayer(player.num)}
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
                    <Clock size={12} color="#10B981" /> {activePitchPlayer.goals ? `${activePitchPlayer.goals} Goals` : 'Matchday XI'} &middot; {activePitchPlayer.role}
                  </div>
                </div>
                <span className="lp-wcard-role-pill">
                  {activePitchPlayer.zone === 'gk' ? 'GK' : activePitchPlayer.zone === 'def' ? 'DEF' : activePitchPlayer.zone === 'mid' ? 'MID' : 'FWD'}
                </span>
              </div>

              <div className="lp-wcard-stats">
                <div className="lp-wcard-stat-col">
                  <div className="lp-wcard-stat-label">Rating</div>
                  <div className="lp-wcard-stat-val">{activePitchPlayer.rating.toFixed(1)}</div>
                  <div className="lp-wcard-stat-sub">Pass Map &middot; {activePitchPlayer.assists} Ast</div>
                </div>
                <div className="lp-passmap-widget">
                  <div className="lp-passmap-title">Avg Position</div>
                  <div className="lp-passmap-box">
                    <div className="lp-passmap-pitch-outline" />
                    <div
                      className="lp-passmap-heat"
                      style={{
                        left: `${activePitchPlayer.avgPos.x}%`,
                        top: `${activePitchPlayer.avgPos.y}%`,
                        transition: 'left 0.35s ease, top 0.35s ease',
                      }}
                    />
                    <span
                      className="lp-passmap-dot"
                      style={{
                        left: `${activePitchPlayer.avgPos.x}%`,
                        top: `${activePitchPlayer.avgPos.y}%`,
                        transition: 'left 0.35s ease, top 0.35s ease',
                      }}
                    />
                  </div>
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
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lp-wcard-actions">
                <button type="button" className="lp-wcard-action-btn">
                  <div className="lp-wcard-btn-left">
                    <Crosshair size={14} color="#60A5FA" />
                    <span>Set Pieces</span>
                  </div>
                  <ChevronRight size={14} />
                </button>
                <button type="button" className="lp-wcard-action-btn">
                  <div className="lp-wcard-btn-left">
                    <FileText size={14} color="#34D399" />
                    <span>Tactical Notes</span>
                  </div>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

          {/* Trust and Meta Footer Bar below 3D Pitch */}
          <div className="lp-hero-footer-bar">
            <div className="lp-hero-meta">
              <span><Check size={15} /> Free to set up</span>
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
      </section>

      {/* ================= CLUB STRIP (real clubs) ================= */}
      {clubs.length > 0 && (
        <div className="lp-strip">
          <div className="container lp-strip-inner">
            <span className="lp-strip-label">Already kicking off on itsfootball.club</span>
            <div className="lp-strip-clubs">
              {clubs.slice(0, 12).map(c => (
                <Link key={c.id} href={`/${c.slug}`} className="lp-strip-club">
                  <img src={c.logo_url || DEFAULT_CREST} alt="" width={24} height={24} loading="lazy" decoding="async" />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= BEFORE / AFTER ================= */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-head lp-head-center lp-reveal">
            <div className="lp-matchday-tag">
              <span className="pulse-dot" /> The Matchday Reality Check
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
                <span className="lp-chat-badge">9 AM CHAOS</span>
              </div>

              <div className="lp-chat-messages">
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Dave M. (CB) <time>8:42 AM</time></div>
                  <div className="lp-bubble-text">Anyone got spare shinpads and socks? Left mine in the boot of someone&apos;s car last week 🤦‍♂️</div>
                </div>
                <div className="lp-bubble">
                  <div className="lp-bubble-author">Kev T. (Striker) <time>8:59 AM</time></div>
                  <div className="lp-bubble-text">Gaffer can&apos;t play today, back seized up taking the wheelie bins out. Good luck lads</div>
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
                    <div className="lp-hub-sub">Saturday 10:30 AM Kick-off &middot; Pitch 1 Ready</div>
                  </div>
                </div>
                <span className="lp-hub-badge">CONTROLLED</span>
              </div>

              <div className="lp-hub-cards">
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">1-Tap Squad Confirmation</div>
                    <div className="lp-hub-item-desc">Starting XI + 4 Bench locked on Thursday night. 0 group chat arguments.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Digital Match Sheet &amp; Tactical XI</div>
                    <div className="lp-hub-item-desc">Ref and opposition view official team sheet from a live link on their phone.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Automated Sub Ledger &amp; Ref Fee</div>
                    <div className="lp-hub-item-desc">100% of player subs settled digitally via card. Ref paid on time from club wallet.</div>
                  </div>
                </div>
                <div className="lp-hub-item">
                  <div className="lp-hub-item-icon check"><Check size={16} /></div>
                  <div>
                    <div className="lp-hub-item-title">Ground GPS &amp; Turnstile Passes</div>
                    <div className="lp-hub-item-desc">Pitch directions and member passes in supporters&apos; Apple/Google Wallets.</div>
                  </div>
                </div>
              </div>

              <div className="lp-hub-footer">
                <div className="lp-hub-pill">
                  <span className="pulse-dot" style={{ background: '#10B981', width: 7, height: 7 }} />
                  <span>15 Players Ready &middot; Ref Fee Settled &middot; Live Match Centre Armed</span>
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
              <span className="pulse-dot" /> Club Operating System
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
                <p>Every member gets a wallet pass with their own QR code. Scan it at the gate or turnstile in under a second.</p>
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
                    <div
                      className="lp-pass-3d-wrap"
                      onMouseMove={handlePassMouseMove}
                      onMouseLeave={handlePassMouseLeave}
                    >
                      <div
                        className={`lp-holo-pass ${scanState === 'granted' ? 'is-granted' : ''}`}
                        style={{
                          transform: `perspective(600px) rotateX(${passTilt.x}deg) rotateY(${passTilt.y}deg)`,
                          '--tier-color': currentTier.color,
                        } as React.CSSProperties}
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
                  <p>Send one link before Thursday. When players tap in, your starting XI is locked, the ref gets a digital match sheet, and subs know their roles.</p>
                </div>
              </div>

              <div className="lp-viz lp-avail-stage">
                <div className="lp-avail-grid">
                  {TACTICAL_ROSTER.slice(0, 8).map(player => (
                    <div key={player.num} className="lp-avail-card">
                      <div className="lp-avail-card-num">#{player.num}</div>
                      <div className="lp-avail-card-info">
                        <div className="lp-avail-card-name">{player.name}</div>
                        <div className="lp-avail-card-role">{player.role}</div>
                      </div>
                      <span className="lp-avail-card-status">
                        <Check size={12} /> Confirmed
                      </span>
                    </div>
                  ))}
                </div>
                <div className="lp-tactical-footer">
                  <div className="lp-avail-badges">
                    <span className="lp-avail-badge in">
                      <Check size={12} /> 11 Starting XI Confirmed
                    </span>
                    <span className="lp-avail-badge sub">
                      <ArrowLeftRight size={12} /> 5 Bench Available
                    </span>
                    <span className="lp-avail-badge out">
                      <X size={12} /> 2 Unavailable
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
            <article className="lp-tile lp-reveal" style={{ '--tc': '#FBBF24' } as React.CSSProperties}>
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
              <span className="pulse-dot" /> Every Matchday Role
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
              <span className="pulse-dot" /> 3-Minute Setup
            </div>
            <h2 className="lp-h2">Live before your next training session.</h2>
          </div>
          <div className="lp-steps">
            {CREATE_CLUB_STEPS.map((s, i) => (
              <div key={s.name} className="lp-step lp-reveal">
                <div className="lp-step-marker">
                  <span className="lp-step-badge">STEP 0{i + 1}</span>
                  <span className="lp-step-milestone">{i === 0 ? 'Club Identity' : i === 1 ? 'Squad Setup' : 'Matchday 1'}</span>
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
          <div className="lp-head lp-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div className="lp-matchday-tag">
                <span className="pulse-dot" /> Grassroots Utility Hub
              </div>
              <h2 id="lp-tools-h" className="lp-h2">Not ready for a club site? Start with a tool.</h2>
            </div>
            <Link href={TOOLS_HUB.path} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              All free tools <ArrowRight size={16} />
            </Link>
          </div>
          <div className="lp-tools">
            {HOME_TOOLS.map(t => (
              <Link key={t.tool.path} href={t.tool.path} className="lp-tile lp-tool lp-reveal" style={{ '--tc': t.color } as React.CSSProperties}>
                <div className="lp-tile-ico"><t.Icon size={20} /></div>
                <h3>{t.tool.label}</h3>
                <p>{t.text}</p>
                <span className="lp-tool-go">Open the tool <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= REAL CLUBS ================= */}
      {clubs.length > 0 && (
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="lp-head lp-reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <div className="lp-matchday-tag">
                  <span className="pulse-dot" /> Live Network
                </div>
                <h2 className="lp-h2">Clubs already on the pitch.</h2>
              </div>
              <Link href="/clubs" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
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
          </div>
        </section>
      )}

      {/* ================= SPONSORS (aggregated across every club) ================= */}
      {allSponsors.length > 0 && (
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="lp-head lp-head-center lp-reveal">
              <div className="lp-matchday-tag">
              <span className="pulse-dot" /> Grassroots Sponsors
            </div>
              <h2 className="lp-h2">Backed by sponsors across the network.</h2>
            </div>
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
                    className="glass-panel glass-panel-interactive sponsor-scroll-card"
                    style={{
                      width: '220px', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', textAlign: 'center', gap: '0.75rem',
                      borderTop: isPlatinum ? '3px solid #F59E0B' : `3px solid ${club.primary_color}`,
                    }}
                  >
                    <SponsorLogo src={sponsor.logo_url} name={sponsor.name}
                      height={isPlatinum ? 56 : isGold ? 46 : 38} style={{ maxWidth: '100%' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{sponsor.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-subtle)', width: '100%', justifyContent: 'center' }}>
                      <img loading="lazy" decoding="async" width={18} height={18} src={club.logo_url || DEFAULT_CREST} alt=""
                        style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />
                      <span className="text-meta">{club.short_name} · <span style={{ textTransform: 'capitalize' }}>{sponsor.tier}</span></span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: '880px' }}>
          <div className="lp-head lp-head-center lp-reveal">
            <div className="lp-matchday-tag">
              <span className="pulse-dot" /> Committee FAQ
            </div>
            <h2 className="lp-h2">Frequently asked questions.</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginTop: '0.5rem' }}>
              Everything club committees, volunteers, and managers ask before getting started.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '1.75rem' }}>
            {HOMEPAGE_FAQS.map(f => (
              <details
                key={f.q}
                className="glass-panel"
                style={{ padding: '1.15rem 1.4rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
              >
                <summary style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{f.q}</span>
                  <span style={{ color: 'var(--club-ink)', fontSize: '1.2rem', fontWeight: 300 }}>+</span>
                </summary>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: '0.85rem', fontSize: '0.98rem' }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
            <Link href="/faq" style={{ color: 'var(--club-ink)', fontWeight: 700, fontSize: '0.98rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              Read the full FAQ with all 30+ answers <ArrowRight size={15} />
            </Link>
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
              <Link href="/create-club" className="btn btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                Create your club <ArrowRight size={18} />
              </Link>
              {!isAuthenticated && (
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => openAuth('signup')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Create a free account
                </button>
              )}
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
