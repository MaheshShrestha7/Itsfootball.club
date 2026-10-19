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
  Layers, ClipboardList, Share2, Timer, RotateCcw,
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
  { id: 'hoops', label: 'Hoops' },
  { id: 'sash', label: 'Sash' },
] as const;

type KitStyle = typeof KIT_STYLES[number]['id'];

function MiniJersey({ primary, accent, style }: { primary: string; accent: string; style: KitStyle }) {
  const sId = `pat-s-${primary.replace(/[^a-zA-Z0-9]/g, '')}-${accent.replace(/[^a-zA-Z0-9]/g, '')}`;
  const hId = `pat-h-${primary.replace(/[^a-zA-Z0-9]/g, '')}-${accent.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))', flexShrink: 0 }}>
      <defs>
        <pattern id={sId} width="8" height="32" patternUnits="userSpaceOnUse">
          <rect width="4" height="32" fill={primary} />
          <rect x="4" width="4" height="32" fill={accent} />
        </pattern>
        <pattern id={hId} width="32" height="8" patternUnits="userSpaceOnUse">
          <rect width="32" height="4" fill={primary} />
          <rect y="4" width="32" height="4" fill={accent} />
        </pattern>
      </defs>
      <path
        d="M9 4L3 9L7 14L10 12V28H22V12L25 14L29 9L23 4H19C19 6 17 7 16 7C15 7 13 6 13 4H9Z"
        fill={
          style === 'solid' ? primary :
          style === 'stripes' ? `url(#${sId})` :
          style === 'hoops' ? `url(#${hId})` :
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
  name: string;
  role: string;
  confirmed: string;
  goals: number;
  assists: number;
}

const TACTICAL_ROSTER: TacticalPlayer[] = [
  { num: 1, name: 'S. Turner', role: 'Goalkeeper', confirmed: 'Thursday 7:22 PM', goals: 0, assists: 1 },
  { num: 2, name: 'C. Dawson', role: 'Left Back', confirmed: 'Wednesday 9:15 PM', goals: 1, assists: 3 },
  { num: 3, name: 'M. Romero', role: 'Center Back', confirmed: 'Thursday 6:40 PM', goals: 2, assists: 0 },
  { num: 4, name: 'L. Davies', role: 'Center Back', confirmed: 'Wednesday 8:02 PM', goals: 1, assists: 1 },
  { num: 5, name: 'J. Lewis', role: 'Right Back', confirmed: 'Thursday 8:30 PM', goals: 0, assists: 4 },
  { num: 6, name: 'K. Phillips', role: 'Defensive Mid', confirmed: 'Thursday 7:10 PM', goals: 2, assists: 5 },
  { num: 7, name: 'L. Hughes', role: 'Midfielder', confirmed: 'Tuesday 6:15 PM', goals: 4, assists: 6 },
  { num: 8, name: 'M. Silva', role: 'Playmaker', confirmed: 'Wednesday 5:45 PM', goals: 9, assists: 11 },
  { num: 9, name: 'J. Park', role: 'Left Winger', confirmed: 'Thursday 9:00 PM', goals: 7, assists: 8 },
  { num: 10, name: 'D. Okafor', role: 'Striker', confirmed: 'Thursday 6:15 PM', goals: 14, assists: 4 },
  { num: 11, name: 'S. Adebayo', role: 'Right Winger', confirmed: 'Wednesday 8:20 PM', goals: 6, assists: 5 },
];

const BENCH_SQUAD = [
  { num: 12, name: 'R. Sterling', role: 'Sub · FWD' },
  { num: 14, name: 'E. Dier', role: 'Sub · CB' },
  { num: 16, name: 'B. White', role: 'Sub · FB' },
  { num: 17, name: 'O. Watkins', role: 'Sub · ST' },
  { num: 19, name: 'C. Wilson', role: 'Sub · MID' },
];

const FORMATIONS: Record<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2', { label: string; coords: [number, number][] }> = {
  '4-3-3': {
    label: '4-3-3',
    coords: [
      [8, 50],   // 1 GK
      [26, 16],  // 2 LB
      [24, 38],  // 3 CB
      [24, 62],  // 4 CB
      [26, 84],  // 5 RB
      [48, 30],  // 6 CM
      [42, 50],  // 7 CDM
      [48, 70],  // 8 CM
      [74, 18],  // 9 LW
      [82, 50],  // 10 ST
      [74, 82],  // 11 RW
    ],
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    coords: [
      [8, 50],   // 1 GK
      [26, 16],  // 2 LB
      [24, 38],  // 3 CB
      [24, 62],  // 4 CB
      [26, 84],  // 5 RB
      [42, 35],  // 6 CDM
      [42, 65],  // 7 CDM
      [64, 18],  // 8 LM
      [62, 50],  // 9 CAM
      [64, 82],  // 10 RM
      [82, 50],  // 11 ST
    ],
  },
  '3-5-2': {
    label: '3-5-2',
    coords: [
      [8, 50],   // 1 GK
      [24, 25],  // 2 LCB
      [22, 50],  // 3 CB
      [24, 75],  // 4 RCB
      [48, 12],  // 5 LWB
      [46, 35],  // 6 CM
      [40, 50],  // 7 CDM
      [46, 65],  // 8 CM
      [48, 88],  // 9 RWB
      [78, 36],  // 10 ST
      [78, 64],  // 11 ST
    ],
  },
  '4-4-2': {
    label: '4-4-2',
    coords: [
      [8, 50],   // 1 GK
      [26, 16],  // 2 LB
      [24, 38],  // 3 CB
      [24, 62],  // 4 CB
      [26, 84],  // 5 RB
      [52, 16],  // 6 LM
      [48, 38],  // 7 CM
      [48, 62],  // 8 CM
      [52, 84],  // 9 RM
      [78, 36],  // 10 ST
      [78, 64],  // 11 ST
    ],
  },
};

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
  const [isGoalFlash, setIsGoalFlash] = useState(false);
  const [subBoardActive, setSubBoardActive] = useState(false);
  const [refCardActive, setRefCardActive] = useState<'yellow' | 'red' | null>(null);
  const [events, setEvents] = useState<DugoutEvent[]>(DEFAULT_EVENTS);
  const [kitStyle, setKitStyle] = useState<KitStyle>('stripes');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  // Tactical Pitch state
  const [formation, setFormation] = useState<'4-3-3' | '4-2-3-1' | '3-5-2' | '4-4-2'>('4-3-3');
  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<number | null>(10);
  const activePitchPlayer = TACTICAL_ROSTER.find(p => p.num === selectedPitchPlayer);

  // Live match clock (advances steadily between 71' and 89')
  const [minute, setMinute] = useState(72);
  useEffect(() => {
    if (minute >= 89) return;
    const t = setTimeout(() => setMinute(m => m + 1), 3500);
    return () => clearTimeout(t);
  }, [minute]);

  const triggerGoal = () => {
    setHomeScore(s => s + 1);
    setIsGoalFlash(true);
    setTimeout(() => setIsGoalFlash(false), 1400);
    const newEv: DugoutEvent = {
      id: String(Date.now()),
      minute: minute,
      type: 'goal',
      headline: 'GOAL!',
      detail: `${displayName} scores! Touchline eruption`,
      isHome: true,
    };
    setEvents(prev => [newEv, ...prev.slice(0, 4)]);
  };

  const triggerSub = () => {
    setSubBoardActive(prev => {
      const next = !prev;
      if (next) {
        const newEv: DugoutEvent = {
          id: String(Date.now()),
          minute: minute,
          type: 'sub',
          headline: 'Tactical Sub',
          detail: '#10 J. Park on for #7 L. Hughes',
          isHome: true,
        };
        setEvents(p => [newEv, ...p.slice(0, 4)]);
      }
      return next;
    });
  };

  const triggerCard = () => {
    const nextCard: 'yellow' | 'red' | null = refCardActive === 'yellow' ? 'red' : refCardActive === 'red' ? null : 'yellow';
    setRefCardActive(nextCard);
    if (nextCard) {
      const newEv: DugoutEvent = {
        id: String(Date.now()),
        minute: minute,
        type: nextCard,
        headline: nextCard === 'red' ? 'RED CARD!' : 'Yellow Card',
        detail: nextCard === 'red' ? 'Riverside #4 violent conduct' : 'Riverside #6 deliberate handball',
      };
      setEvents(p => [newEv, ...p.slice(0, 4)]);
    }
  };

  const resetDugout = () => {
    setHomeScore(2);
    setIsGoalFlash(false);
    setSubBoardActive(false);
    setRefCardActive(null);
    setEvents(DEFAULT_EVENTS);
  };

  const isDugoutModified = homeScore !== 2 || subBoardActive || refCardActive !== null || events.length !== 4;

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
        <div className="container lp-hero-grid">
          <div>
            <div className="lp-kicker lp-matchday-tag">
              <span className="pulse-dot" aria-hidden="true" />
              Matchday Saturday &middot; Free Grassroots Platform
            </div>

            <h1 className="lp-h1">
              <span className="sr-only">Free football club website with live match centre — </span>
              {/* Explicit breaks: left to wrap, the fallback font fits "Big-club matchday." on one line
                  and the webfont doesn't, so the swap would shift the whole page */}
              Grassroots club.<br /><em>Big-club</em><br />matchday.
            </h1>

            <p className="lp-hero-sub">
              itsfootball.club is the free platform for grassroots football and soccer clubs: your official club website, live match centre,
              digital member passes, subs collection, a merch shop and sponsor reporting, run by your committee from one
              dashboard. No developer. No spreadsheets. No 40-message group chats.
            </p>

            <form className="lp-claim" onSubmit={claim}>
              <div className="lp-claim-field">
                <label htmlFor="lp-club-name" className="lp-claim-prefix">itsfootball.club/</label>
                <input
                  id="lp-club-name"
                  value={clubName}
                  onChange={e => setClubName(e.target.value)}
                  placeholder="your club name"
                  autoComplete="off"
                  maxLength={60}
                  aria-describedby="lp-claim-status"
                />
              </div>
              <button type="submit" className="lp-claim-btn">
                Claim it <ArrowRight size={17} />
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

            <div className="lp-swatches" role="group" aria-label="Preview club colours">
              <span className="lp-swatches-label">Try your colours</span>
              {FOOTBALL_COLOR_PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  type="button"
                  className="lp-swatch"
                  aria-label={p.name}
                  aria-pressed={i === paletteIdx}
                  title={p.name}
                  onClick={() => setPaletteIdx(i)}
                  style={{ '--sw-p': p.primary, '--sw-a': p.accent } as React.CSSProperties}
                />
              ))}
            </div>

            <div className="lp-kit-styles" role="group" aria-label="Kit pattern style">
              <span className="lp-swatches-label">Kit pattern:</span>
              <div className="lp-kit-pills">
                {KIT_STYLES.map(k => (
                  <button
                    key={k.id}
                    type="button"
                    className={`lp-kit-pill ${kitStyle === k.id ? 'is-active' : ''}`}
                    onClick={() => setKitStyle(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {demoClub && (
              <Link href={`/${demoClub.slug}`} className="lp-demo">
                Not ready to claim? Look around {demoClub.name}&apos;s live club site <ArrowRight size={14} />
              </Link>
            )}

            <div className="lp-hero-meta">
              <span><Check size={15} /> Free to set up</span>
              <span><Check size={15} /> Your crest, colours &amp; domain</span>
              <span><Check size={15} /> Nothing for supporters to install</span>
            </div>

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

          {/* Live product mock, painted in the visitor's name and colours */}
          <div
            ref={stageRef}
            className="lp-stage"
            aria-hidden="true"
            data-theme="dark"
            onMouseMove={handleStageMouseMove}
            onMouseLeave={handleStageMouseLeave}
          >
            <div className="lp-toast">
              <div className="lp-toast-ico"><CalendarCheck size={16} /></div>
              <div>
                <b>Sam R. is in for Saturday</b>
                <small>16 available · 2 out · 3 yet to reply</small>
              </div>
            </div>

            <div className="lp-browser">
              <div className="lp-browser-bar">
                <div className="lp-dots"><i /><i /><i /></div>
                <div className="lp-url">itsfootball.club/<b>{previewSlug}</b></div>
              </div>
              <div className="lp-club-head">
                <div className="lp-crest-wrap">
                  <div className="lp-crest">{initials(displayName)}</div>
                  <MiniJersey primary={palette.primary} accent={palette.accent} style={kitStyle} />
                </div>
                <div className="min-w-0">
                  <div className="lp-club-name">{displayName}</div>
                  <div className="lp-club-nav"><span>Fixtures</span><span>Squad</span><span>News</span><span>Membership</span></div>
                </div>
              </div>
              <div className={`lp-score ${isGoalFlash ? 'is-goal-flash' : ''}`}>
                <div className="lp-score-top">
                  <span className="lp-live-chip"><span className="pulse-dot" /> LIVE {minute}&apos;</span>
                  <span className="lp-comp">Sunday League · Div 2 · Pitch 1</span>
                </div>
                <div className="lp-board">
                  <div className="lp-team">
                    <div className="lp-crest">{initials(displayName)}</div>
                    <span>{displayName}</span>
                  </div>
                  <div className="lp-digits">
                    <div style={{ zoom: 0.65 }}>
                      <ScoreboardDigitRoll value={homeScore} isGoal={isGoalFlash} accentColor={palette.accent} />
                    </div>
                    <span className="sep">:</span>
                    <div style={{ zoom: 0.65 }}>
                      <ScoreboardDigitRoll value={1} />
                    </div>
                  </div>
                  <div className="lp-team">
                    <div className="lp-team-away">RVR</div>
                    <span>Riverside Rovers</span>
                  </div>
                </div>

                {/* Touchline Action Controller Buttons */}
                <div className="lp-dugout-bar" role="toolbar" aria-label="Touchline matchday controls">
                  <div className="lp-dugout-title">TOUCHLINE ACTION</div>
                  <div className="lp-dugout-btns">
                    <button
                      type="button"
                      className={`lp-dugout-btn lp-btn-goal ${isGoalFlash ? 'is-active' : ''}`}
                      onClick={triggerGoal}
                      title="Celebrate a goal and advance the score roll"
                    >
                      <Goal size={13} /> Goal!
                    </button>
                    <button
                      type="button"
                      className={`lp-dugout-btn lp-btn-sub ${subBoardActive ? 'is-active' : ''}`}
                      onClick={triggerSub}
                      title="Toggle the 4th official electronic LED substitution board"
                    >
                      <ArrowLeftRight size={13} /> Sub
                    </button>
                    <button
                      type="button"
                      className={`lp-dugout-btn lp-btn-card ${refCardActive ? 'is-active' : ''}`}
                      onClick={triggerCard}
                      title="Cycle yellow and red referee cards"
                    >
                      <span className={refCardActive === 'red' ? 'lp-card-red' : 'lp-card-yellow'} />
                      {refCardActive === 'red' ? 'Red Card' : 'Card'}
                    </button>
                    {isDugoutModified && (
                      <button
                        type="button"
                        className="lp-dugout-reset"
                        onClick={resetDugout}
                        title="Reset match simulation"
                      >
                        <RotateCcw size={11} /> Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Electronic Sub Board */}
                {subBoardActive && (
                  <div className="lp-sub-board" aria-live="polite">
                    <div className="lp-sub-panel in">
                      <span className="lp-sub-tag">▲ IN</span>
                      <span className="lp-sub-num">10</span>
                      <span className="lp-sub-name">J. Park</span>
                    </div>
                    <div className="lp-sub-panel out">
                      <span className="lp-sub-tag">▼ OUT</span>
                      <span className="lp-sub-num">07</span>
                      <span className="lp-sub-name">L. Hughes</span>
                    </div>
                  </div>
                )}

                {/* Match Events Timeline */}
                <div className="lp-timeline">
                  {events.map(ev => (
                    <div key={ev.id} className={`lp-ev ${ev.type === 'goal' ? 'lp-ev-goal is-in' : ''}`}>
                      <time>{ev.minute}&apos;</time>
                      {ev.type === 'goal' ? (
                        <Goal size={14} color={palette.accent} />
                      ) : ev.type === 'sub' ? (
                        <ArrowLeftRight size={13} color="var(--c-sky)" />
                      ) : ev.type === 'red' ? (
                        <span className="lp-card-red" />
                      ) : (
                        <span className="lp-card-yellow" />
                      )}
                      <span><b>{ev.headline}</b> {ev.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="lp-pass"
              style={{
                transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) rotateZ(5deg)`,
                transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="lp-pass-top">
                <div>
                  <div className="lp-pass-label">MEMBER PASS · 2026/27</div>
                  <div className="lp-pass-name">Alex Morgan</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{initials(displayName)} · Senior member</div>
                </div>
              </div>
              <div className="lp-pass-row">
                <span className="lp-pass-verified"><Check size={11} /> VERIFIED</span>
                <div className="lp-pass-qr"><QRCodeSVG value={`https://itsfootball.club/${previewSlug}/verify`} size={58} /></div>
              </div>
            </div>
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
            <div className="lp-eyebrow">Sound familiar?</div>
            <h2 className="lp-h2">Your club runs on volunteers. Not on five different apps.</h2>
          </div>
          <div className="lp-vs lp-reveal">
            <div className="lp-vs-col lp-vs-before lp-play">
              <div className="lp-vs-title">Most clubs today</div>
              <ul>
                <li><X size={16} /><span><s>&ldquo;Who&apos;s available Saturday?&rdquo; buried in the group chat</s></span></li>
                <li><X size={16} /><span><s>Subs tracked in someone&apos;s spreadsheet, chased in cash</s></span></li>
                <li><X size={16} /><span><s>A social page as the club&apos;s only &ldquo;website&rdquo;</s></span></li>
                <li><X size={16} /><span><s>Scores posted hours later, if at all</s></span></li>
                <li><X size={16} /><span><s>Sponsors who never see what their money did</s></span></li>
              </ul>
            </div>
            <div className="lp-vs-col lp-vs-after">
              <div className="lp-vs-title">With itsfootball.club</div>
              <ul>
                <li><Check size={16} /><span>Players tap in or out from one link, and you pick the lineup from who&apos;s in</span></li>
                <li><Check size={16} /><span>Memberships paid by card or bank transfer, with receipts and a proper ledger</span></li>
                <li><Check size={16} /><span>A real club website with your crest, colours and own address</span></li>
                <li><Check size={16} /><span>Every goal, card and sub live, straight from the touchline</span></li>
                <li><Check size={16} /><span>A sponsor report with impressions and clicks, ready for renewal talks</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURE BENTO ================= */}
      <section className="lp-section" id="features" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="lp-head lp-reveal">
            <div className="lp-eyebrow">Everything your club runs on</div>
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

            {/* Member pass */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#34D399' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><QrCode size={19} /></div>
                <h3>Digital member passes</h3>
                <p>Every member gets a pass with their own QR code. Scan it at the gate, or put up a door QR so people check themselves in.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-scan">
                  <div className="lp-scan-reticle">
                    <i /><i /><i /><i />
                    <div className="lp-scan-qr"><QRCodeSVG value="https://itsfootball.club" size={64} /></div>
                  </div>
                  <div className="lp-scan-laser" />
                  <div className="lp-stamp">ACCESS GRANTED</div>
                </div>
              </div>
            </article>

            {/* Interactive Tactical Pitch & Lineup Workbench */}
            <article className="lp-tile lp-tile-wide lp-reveal" style={{ '--tc': '#60A5FA' } as React.CSSProperties}>
              <div className="lp-tile-head-row">
                <div>
                  <div className="lp-tile-ico"><Users size={19} /></div>
                  <h3>Tactical pitch &amp; 1-tap availability</h3>
                  <p>Share one link before Thursday. When players tap in, arrange your XI on the pitch and publish the team sheet.</p>
                </div>
                <div className="lp-pitch-formation-picker" role="group" aria-label="Pitch formation">
                  <span className="lp-formation-label">Formation:</span>
                  <div className="lp-formation-btns">
                    {(Object.keys(FORMATIONS) as Array<keyof typeof FORMATIONS>).map(f => (
                      <button
                        key={f}
                        type="button"
                        className={`lp-formation-btn ${formation === f ? 'is-active' : ''}`}
                        onClick={() => setFormation(f)}
                      >
                        {FORMATIONS[f].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lp-viz lp-tactical-stage">
                <div className="lp-tactical-pitch">
                  <div className="lp-pitch-half" />
                  <div className="lp-pitch-box" />
                  <div className="lp-pitch-goal-area" />
                  <div className="lp-pitch-penalty-spot" />
                  <div className="lp-pitch-center-arc" />

                  {/* 11 Dynamic Player Tokens */}
                  {FORMATIONS[formation].coords.map(([x, y], i) => {
                    const player = TACTICAL_ROSTER[i];
                    const isSelected = selectedPitchPlayer === player.num;
                    return (
                      <button
                        key={player.num}
                        type="button"
                        className={`lp-pitch-token ${isSelected ? 'is-selected' : ''}`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        onClick={() => setSelectedPitchPlayer(isSelected ? null : player.num)}
                        title={`${player.name} (${player.role})`}
                      >
                        <span className="lp-token-num">{player.num}</span>
                        <span className="lp-token-name">{player.name.split(' ')[1] || player.name}</span>
                      </button>
                    );
                  })}

                  {/* Floating Tactical Inspector Card */}
                  {activePitchPlayer && (
                    <div className="lp-pitch-inspector" aria-live="polite">
                      <div className="lp-inspector-top">
                        <div className="lp-inspector-badge">#{activePitchPlayer.num}</div>
                        <div className="min-w-0">
                          <div className="lp-inspector-name">{activePitchPlayer.name}</div>
                          <div className="lp-inspector-role">{activePitchPlayer.role}</div>
                        </div>
                        <button
                          type="button"
                          className="lp-inspector-close"
                          onClick={() => setSelectedPitchPlayer(null)}
                          aria-label="Close player card"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="lp-inspector-status">
                        <span className="pulse-dot" style={{ background: '#10B981', width: 6, height: 6 }} />
                        <span>Confirmed &middot; {activePitchPlayer.confirmed}</span>
                      </div>
                      <div className="lp-inspector-stats">
                        <span><b>{activePitchPlayer.goals}</b> goals</span>
                        <span><b>{activePitchPlayer.assists}</b> assists</span>
                        <span className="lp-inspector-tag">Starting XI</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Availability Status Bar & Bench Strip */}
                <div className="lp-tactical-footer">
                  <div className="lp-avail-badges">
                    <span className="lp-avail-badge in">
                      <Check size={12} /> 11 Starting XI
                    </span>
                    <span className="lp-avail-badge sub">
                      <ArrowLeftRight size={12} /> 5 Bench
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
            <div className="lp-eyebrow">One platform, everyone at the club</div>
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
            <div className="lp-eyebrow">Kick-off in three steps</div>
            <h2 className="lp-h2">Live before your next training session.</h2>
          </div>
          <div className="lp-steps">
            {CREATE_CLUB_STEPS.map((s, i) => (
              <div key={s.name} className="lp-step lp-reveal">
                <div className="lp-step-n">0{i + 1}</div>
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
              <div className="lp-eyebrow">Free tools, no sign-up</div>
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
                <div className="lp-eyebrow">See it for real</div>
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
              <div className="lp-eyebrow">Club partners</div>
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
            <div className="lp-eyebrow">Grassroots club FAQ</div>
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
            <div className="lp-eyebrow" style={{ justifyContent: 'center' }}><Zap size={13} /> Free to set up</div>
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
