'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { sponsorClickHref } from '@/lib/sponsors';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import { DEFAULT_BANNER, DEFAULT_CREST } from '@/lib/crest';
import { CREATE_CLUB_STEPS } from '@/lib/faq';
import './home.css';
import {
  ArrowRight, ArrowLeftRight, AlertCircle, BarChart3, Bell, CalendarCheck, Check, CheckCircle2, ClipboardList, Clock,
  DoorOpen, Flame, Gift, Goal, Heart, Megaphone, QrCode, Radio, RotateCcw, Shield, Ticket, Trophy, User, Users,
  UsersRound, Wallet, X,
} from 'lucide-react';
import { LINEUP_TOOL, PLAYING_TIME_TOOL, RESULT_TOOL, TOOLS_HUB, TOURNAMENT_TOOL } from '@/lib/tool-pages';
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

// The free tools teased on the homepage; the rest are on /tools
const HOME_TOOLS = [
  { tool: LINEUP_TOOL, text: 'Pick a formation and download a team sheet.' },
  { tool: PLAYING_TIME_TOOL, text: 'Equal minutes for everyone, with a sub plan.' },
  { tool: RESULT_TOOL, text: 'Turn the final score into an Instagram post.' },
  { tool: TOURNAMENT_TOOL, text: 'Fixtures, tables and a bracket on one live page.' },
];

// "I'm a..." switcher: each role gets its own pitch, the features it uses, and the action that role can take.
// secondary: 'demo' links to a live club site, 'share' sends this page to whoever runs the club.
const ROLES = [
  {
    id: 'coach', tab: 'Coach', Icon: ClipboardList,
    headline: 'Know your XI before Thursday.',
    body: 'Send one availability link, see who is in, and drag them onto the pitch. On matchday, log goals, cards and subs from the touchline.',
    points: [
      'Players reply in a tap, so no chasing in the group chat',
      'Lineup builder on a tactical pitch, published to the club site',
      'Other clubs can invite your team to a friendly',
    ],
    cta: { label: 'Set up your team', href: '/create-club' }, secondary: 'demo',
  },
  {
    id: 'committee', tab: 'Committee', Icon: Shield,
    headline: 'One dashboard instead of five apps.',
    body: 'Squad, fixtures, members, money, merch, content and sponsors in one place, with roles for your president, secretary and treasurer.',
    points: [
      'Memberships paid by card or bank transfer, with receipts',
      'A club shop for kits and merch, with every order in one ledger',
      'Give a volunteer only the gate scanner or shop orders',
      'A club website with your crest, colours and own domain',
    ],
    cta: { label: 'Claim your club', href: '/create-club' }, secondary: 'demo',
  },
  {
    id: 'player', tab: 'Player', Icon: User,
    headline: 'Your pass, your stats, your streak.',
    body: 'Players never set anything up. Your club adds you, and you get a member pass on your phone, availability in a tap and your goals on the board.',
    points: [
      'A digital member pass with your own QR code',
      'Reply to availability in one tap',
      'Goals, assists and attendance streaks on the ClubScore leaderboard',
    ],
    cta: { label: 'Find your club', href: '/clubs' }, secondary: 'share',
  },
  {
    id: 'parent', tab: 'Parent', Icon: UsersRound,
    headline: 'All your kids, one app.',
    body: 'Answer for each child, pay their fees and keep up with their games, all in one place.',
    points: [
      'Say In or Out for each of your children',
      'Add a brother or sister with the same join form',
      'Fee reminders come to you, and you pay by card or bank transfer',
      'Junior teams can keep their scores off the public site',
    ],
    cta: { label: 'Find your club', href: '/clubs' }, secondary: 'share',
  },
  {
    id: 'supporter', tab: 'Supporter', Icon: Heart,
    headline: 'Never miss a goal.',
    body: 'Follow your club and your phone tells you when it kicks off, every goal and the final score. Nothing to install.',
    points: [
      'Kick-off, goal, line-up and full-time alerts',
      'The live match page opens in any browser',
      'Buy tickets and club kit, and RSVP to events',
      "Member perks from the club's sponsors",
    ],
    cta: { label: 'Find your club', href: '/clubs' }, secondary: 'demo',
  },
  {
    id: 'sponsor', tab: 'Sponsor', Icon: Megaphone,
    headline: 'Proof your money worked.',
    body: 'Back a local club and see what it bought: your logo across their site and events, with every impression and click tracked.',
    points: [
      'Tiered placements across the club site and event pages',
      'Sign up and pay online from the club sponsor page',
      'A report ready for renewal talks',
    ],
    cta: { label: 'Find a club to back', href: '/clubs' }, secondary: 'demo',
  },
] as const;

type RoleId = typeof ROLES[number]['id'];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** A small pass, the same shape on the Committee and Player tabs */
function MiniPass({ clubName }: { clubName: string }) {
  return (
    <div className="hm-pass">
      <small>Player pass, {clubName}</small>
      <span className="hm-pass-qr" aria-hidden="true"><QRCodeSVG value="https://itsfootball.club" size={48} /></span>
      <b>Alex Morgan</b>
      <small>Senior squad, valid 2026/27</small>
    </div>
  );
}

/** Each role's features, with a small example of each. Sample data is always captioned Example. */
function RoleFeatures({ id, clubName }: { id: RoleId; clubName: string }) {
  switch (id) {
    case 'coach':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><Radio size={18} aria-hidden="true" /> Live match centre</h4>
            <p>Run the clock from the touchline. Supporters follow on the club site in real time.</p>
            <figure>
              <div className="hm-score"><b>2 - 1</b><span className="hm-game-live">Live 67&apos;</span></div>
              <div className="hm-timeline" aria-hidden="true"><i /><b style={{ left: '25%' }} /><b className="y" style={{ left: '45%' }} /><b style={{ left: '64%' }} /><b style={{ left: '72%' }} /></div>
              <figcaption>Example match</figcaption>
            </figure>
          </article>
          <article className="hm-feat">
            <h4><Users size={18} aria-hidden="true" /> Availability</h4>
            <table className="hm-table"><tbody>
              <tr><td>#8 J. Silva</td><td className="is-in">In</td></tr>
              <tr><td>#15 R. Grant</td><td className="is-maybe">Maybe</td></tr>
              <tr><td>#18 T. Moss</td><td className="is-out">Out</td></tr>
            </tbody></table>
            <figcaption>Example replies</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Trophy size={18} aria-hidden="true" /> Tournaments</h4>
            <p>Brackets, round-robins and group tables update as you enter scores.</p>
            <table className="hm-table"><tbody>
              <tr><td><b>Lions</b></td><td><b>2</b></td></tr>
              <tr><td>United</td><td>1</td></tr>
            </tbody></table>
            <figcaption>Example cup</figcaption>
          </article>
        </div>
      );
    case 'committee':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><Wallet size={18} aria-hidden="true" /> Subs, shop and money</h4>
            <figure>
              <div className="hm-score"><b>$2,340</b><span>of $3,000 season subs</span></div>
              <div className="hm-bar" aria-hidden="true"><i /></div>
              <table className="hm-table"><tbody>
                <tr><td>Senior membership, J. Park</td><td>$120</td></tr>
                <tr><td>Shop, home shirt x2</td><td>$90</td></tr>
              </tbody></table>
              <figcaption>Example ledger</figcaption>
            </figure>
          </article>
          <article className="hm-feat">
            <h4><QrCode size={18} aria-hidden="true" /> Member passes</h4>
            <MiniPass clubName={clubName} />
            <figcaption>Example pass</figcaption>
          </article>
          <article className="hm-feat">
            <h4><DoorOpen size={18} aria-hidden="true" /> Door check-in</h4>
            <p>Scan member passes at the door with any phone.</p>
          </article>
        </div>
      );
    case 'player':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><Flame size={18} aria-hidden="true" /> ClubScore</h4>
            <p>Points for goals, assists, clean sheets and, most of all, showing up.</p>
            <table className="hm-table"><tbody>
              <tr><td>1 Marco Silva <small>5 games in a row</small></td><td><b>412</b></td></tr>
              <tr><td>2 Dami Okafor</td><td><b>388</b></td></tr>
              <tr><td>3 Jae Park</td><td><b>351</b></td></tr>
            </tbody></table>
            <figcaption>Example leaderboard</figcaption>
          </article>
          <article className="hm-feat">
            <h4><QrCode size={18} aria-hidden="true" /> Your pass</h4>
            <MiniPass clubName={clubName} />
            <figcaption>Example pass</figcaption>
          </article>
          <article className="hm-feat">
            <h4><CalendarCheck size={18} aria-hidden="true" /> This Sunday</h4>
            <div className="hm-kid"><span>Are you in?</span><span className="hm-seg" aria-hidden="true"><span className="on">In</span><span>Out</span></span></div>
            <figcaption>Example</figcaption>
          </article>
        </div>
      );
    case 'parent':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><CalendarCheck size={18} aria-hidden="true" /> This Saturday</h4>
            <div className="hm-kid"><span>Mia, Under 10s</span><span className="hm-seg" aria-hidden="true"><span className="on">In</span><span>Out</span></span></div>
            <div className="hm-kid"><span>Leo, Under 7s</span><span className="hm-seg" aria-hidden="true"><span>In</span><span className="on">Out</span></span></div>
            <figcaption>Example family</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Wallet size={18} aria-hidden="true" /> Fees</h4>
            <table className="hm-table"><tbody>
              <tr><td>Mia, winter season</td><td className="is-in">Paid</td></tr>
              <tr><td>Leo, winter season</td><td className="is-maybe">Due</td></tr>
            </tbody></table>
            <figcaption>Example</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Shield size={18} aria-hidden="true" /> Junior results</h4>
            <p>When a junior team hides scores, the public site shows the game but not the score.</p>
          </article>
        </div>
      );
    case 'supporter':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><Bell size={18} aria-hidden="true" /> Alerts on your phone</h4>
            <div className="hm-alert"><i aria-hidden="true" /><span><b>Goal! {clubName} 2 - 1 Riverside</b><small>67 minutes</small></span></div>
            <div className="hm-alert"><i aria-hidden="true" /><span><b>Kick-off: {clubName} v Riverside</b><small>Follow it live</small></span></div>
            <figcaption>Example alerts</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Ticket size={18} aria-hidden="true" /> Tickets and shop</h4>
            <table className="hm-table"><tbody>
              <tr><td>Grand final ticket</td><td>$10</td></tr>
              <tr><td>Home shirt</td><td>$45</td></tr>
            </tbody></table>
            <figcaption>Example prices</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Gift size={18} aria-hidden="true" /> Member perks</h4>
            <p>Deals from local sponsors, shown to members with their pass.</p>
          </article>
        </div>
      );
    case 'sponsor':
      return (
        <div className="hm-feats">
          <article className="hm-feat hm-feat-wide">
            <h4><BarChart3 size={18} aria-hidden="true" /> Season report</h4>
            <table className="hm-table"><tbody>
              <tr><td>Impressions</td><td><b>12,400</b></td></tr>
              <tr><td>Clicks</td><td><b>486</b></td></tr>
              <tr><td>Click rate</td><td><b>3.9%</b></td></tr>
            </tbody></table>
            <figcaption>Example report</figcaption>
          </article>
          <article className="hm-feat">
            <h4><Megaphone size={18} aria-hidden="true" /> Placements</h4>
            <p>Your logo on the club site, match pages and event pages, by tier.</p>
          </article>
          <article className="hm-feat">
            <h4><Gift size={18} aria-hidden="true" /> Member perks</h4>
            <p>Offer a deal to the club&apos;s members, shown with their pass.</p>
          </article>
        </div>
      );
  }
}

const SPONSOR_TIER_WEIGHT: Record<string, number> = { platinum: 0, gold: 1, silver: 2, bronze: 3, grassroots: 4 };

/** Club blocks shown before "See all clubs" takes the last slot */
const HOME_CLUB_BLOCKS = 12;

export default function PlatformHomePage({ latestNews = [], latestPhotos = [], results = [], demoClub: pickedDemo = null }: { latestNews?: LatestNewsRow[]; latestPhotos?: LatestPhotoRow[]; results?: HomeResultRow[]; demoClub?: HomeDemoClub | null }) {
  const router = useRouter();
  const { clubs: allClubs, sponsors, matches } = useClub();
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
  // The results board: each listed club's newest game (live ones come first), three clubs at most
  const boardGames = useMemo(() => {
    const seen = new Set<string>();
    const out: { game: HomeResultRow; club: (typeof clubs)[number] }[] = [];
    for (const game of results) {
      const club = clubs.find(c => c.id === game.club_id);
      if (!club || seen.has(club.id)) continue;
      seen.add(club.id);
      out.push({ game, club });
      if (out.length === 3) break;
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

  // The club picked in Mission Control (F10-9); until one is picked, the first listed club
  const demoClub: HomeDemoClub | undefined = pickedDemo || clubs[0];

  const [roleIdx, setRoleIdx] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (roleIdx + step + ROLES.length) % ROLES.length;
    setRoleIdx(next);
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

  return (
    <div className="lp" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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

      {/* ================= WHO'S PLAYING: the core loop, as one colour block ================= */}
      <section className="hm-sec">
        <div className="container">
          <div className="hm-block">
            <h2 className="hm-h2">Who&apos;s playing Sunday, sorted before Friday.</h2>
            <p className="hm-lede">No more counting thumbs-up in the group chat.</p>
            <ol className="hm-steps hm-steps-row">
              <li><h3>Players answer</h3><p>Each player gets a link by email or WhatsApp and taps one button.</p></li>
              <li><h3>You pick the team</h3><p>The line-up builder starts from the players who said In.</p></li>
              <li><h3>Everyone sees it</h3><p>The line-up goes on your club site at a link anyone can open.</p></li>
            </ol>
          </div>
        </div>
      </section>

      {/* ================= FEATURES BY ROLE: one switcher; every panel stays in the HTML ================= */}
      <section className="hm-sec" id="features" aria-labelledby="hm-features-h">
        <div className="container">
          <h2 id="hm-features-h" className="hm-h2">From kick-off to the clubhouse, in one place.</h2>
          <p className="hm-lede">Everything here is live in the product today.</p>
          <div className="hm-pick">
            <span id="hm-pick-label">I&apos;m a</span>
            <div className="hm-tabs" role="tablist" aria-labelledby="hm-pick-label" onKeyDown={onTabKey}>
              {ROLES.map((r, i) => (
                <button
                  key={r.id}
                  ref={el => { tabRefs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`hm-tab-${r.id}`}
                  aria-selected={i === roleIdx}
                  aria-controls={`hm-panel-${r.id}`}
                  tabIndex={i === roleIdx ? 0 : -1}
                  className="hm-tab"
                  onClick={() => setRoleIdx(i)}
                >
                  <r.Icon size={18} aria-hidden="true" /> {r.tab}
                </button>
              ))}
            </div>
          </div>
          {ROLES.map((r, i) => (
            <div
              key={r.id}
              id={`hm-panel-${r.id}`}
              role="tabpanel"
              aria-labelledby={`hm-tab-${r.id}`}
              hidden={i !== roleIdx}
              className="hm-panel"
            >
              <div>
                <h3 className="hm-role-h">{r.headline}</h3>
                <p className="hm-role-body">{r.body}</p>
                <ul className="hm-points">
                  {r.points.map(pt => <li key={pt}>{pt}</li>)}
                </ul>
                <div className="hm-actions">
                  <Link href={r.cta.href} className="btn btn-primary">{r.cta.label}</Link>
                  {r.secondary === 'share' ? (
                    <button type="button" className="btn btn-secondary" onClick={shareLink}>
                      <span aria-live="polite">{copied ? 'Link copied' : 'Send this to your committee'}</span>
                    </button>
                  ) : demoClub && (
                    <Link href={`/${demoClub.slug}`} className="btn btn-secondary">See a live club site</Link>
                  )}
                </div>
              </div>
              <RoleFeatures id={r.id} clubName={displayName} />
            </div>
          ))}
          <div className="hm-also">
            <h3>Also in every club site</h3>
            <ul>
              {['News and match reports', 'Homepage photo carousel', 'Events and socials', 'Door check-in', 'Seasons', 'Committee page', 'Your crest, colours and domain', 'Visitor numbers', 'Contact inbox', 'Bulk member import', 'Search-friendly pages'].map(x => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= PRICE: the one number, said once, with how we are paid ================= */}
      <section className="hm-sec" aria-labelledby="hm-free-h">
        <div className="container">
          <div className="hm-free">
            <div>
              <p className="hm-free-zero"><b>$0</b><span>a month</span></p>
              <h2 id="hm-free-h" className="hm-h2">Free forever. Not a free trial.</h2>
              <p className="hm-lede">Every club gets every feature from day one. There&apos;s nothing to upgrade to later.</p>
              <Link href="/create-club" className="btn btn-primary hm-free-btn">Create your club</Link>
              <p className="hm-small hm-free-note">No bank card required. Sign up and enjoy.</p>
            </div>
            <dl className="hm-free-sum">
              <div><dt>Subscription</dt><dd>None</dd></div>
              <div><dt>Paid plans or locked features</dt><dd>None</dd></div>
              <div><dt>Ads from other companies</dt><dd>None</dd></div>
              <div><dt>How we keep it free</dt><dd>A small booking fee, added when someone pays your club by card. We never take a cut of what your club charges, so that money goes back into the game: nets, kits and the oranges at half-time. <Link href="/pricing" className="hm-link">How card payments work</Link></dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* ================= FREE TOOLS (no club needed): one slim band ================= */}
      <section className="hm-sec" aria-labelledby="hm-tools-h">
        <div className="container">
          <div className="hm-tools">
            <div>
              <h2 id="hm-tools-h">Not ready for a club site? Start with a free tool.</h2>
              <Link href={TOOLS_HUB.path} className="hm-link">See all free tools</Link>
            </div>
            <ul>
              {HOME_TOOLS.map(t => (
                <li key={t.tool.path}>
                  <Link href={t.tool.path}><b>{t.tool.label}</b><span>{t.text}</span></Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= PROOF: real clubs, their latest games, sponsors and posts ================= */}
      {clubs.length > 0 && (
        <section className="hm-sec" aria-labelledby="hm-clubs-h">
          <div className="container">
            <div className="hm-head">
              <div>
                <h2 id="hm-clubs-h" className="hm-h2">Clubs already on the pitch.</h2>
                <p className="hm-lede">
                  {clubs.length} {clubs.length === 1 ? 'club runs' : 'clubs run'} on itsfootball.club
                  {allSponsors.length > 0 && <>, backed by {allSponsors.length} local {allSponsors.length === 1 ? 'sponsor' : 'sponsors'}</>}.
                </p>
              </div>
              <Link href="/clubs" className="hm-link">Browse all clubs</Link>
            </div>

            {boardGames.length > 0 ? (
              <div className="hm-board">
                {boardGames.map(({ game, club }) => {
                  const live = game.status === 'live' || game.status === 'halftime';
                  const hidden = game.scores_hidden;
                  const homeWon = game.home_score > game.away_score;
                  const awayWon = game.away_score > game.home_score;
                  const side = (name: string, logo: string | null, score: number, dim: boolean, showScore: boolean) => (
                    <div className={`hm-game-row${dim ? ' is-dim' : ''}`}>
                      {logo ? <img src={logo} alt="" width={26} height={26} loading="lazy" decoding="async" /> : <i aria-hidden="true">{initials(name)}</i>}
                      <span>{name}</span>
                      {showScore && <b>{score}</b>}
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
                      {side(game.home_team_name, game.home_team_logo, game.home_score, !hidden && !live && awayWon, !hidden)}
                      {side(game.away_team_name, game.away_team_logo, game.away_score, !hidden && !live && homeWon, !hidden)}
                      {hidden && <div className="hm-game-hidden">Scores hidden</div>}
                    </Link>
                  );
                })}
                <Link href="/clubs" className="hm-game-more">
                  See all {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}
                  <small>Fixtures, results and squads</small>
                </Link>
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

            {allSponsors.length > 0 && (
              <div className="hm-sponsors">
                <h3>Backed by local sponsors</h3>
                <div className="hm-sponsor-row">
                  {allSponsors.map(({ sponsor, club }) => {
                    const href = sponsorClickHref(sponsor.website_url, club.slug);
                    return (
                      <a
                        key={sponsor.id}
                        href={href || `/${club.slug}`}
                        target={href ? '_blank' : undefined}
                        rel={href ? 'sponsored noopener' : undefined}
                        className="hm-sponsor"
                        title={`${sponsor.name}, ${club.short_name || club.name}`}
                      >
                        <SponsorLogo src={sponsor.logo_url} name={sponsor.name} height={34} style={{ maxWidth: 140 }} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {latestPosts.length > 0 && (
              <div className="hm-posts">
                {latestPosts.map(p => (
                  <Link key={`${p.kind}-${p.id}`} href={p.href} className="hm-post">
                    <img src={p.image} alt="" loading="lazy" decoding="async" />
                    <span>
                      <small>{p.clubName}, {p.kind === 'news' ? 'news' : 'photos'}</small>
                      <span className="hm-post-title">{p.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= FAQ: two columns; every question stays on the page (FAQPage schema) ================= */}
      <section className="hm-sec" aria-labelledby="hm-faq-h">
        <div className="container hm-faq">
          <div>
            <h2 id="hm-faq-h" className="hm-h2">Frequently asked questions.</h2>
            <p className="hm-lede">What committees, volunteers and managers ask before they start.</p>
            <Link href="/faq" className="hm-link">Read all 30+ answers</Link>
          </div>
          <div className="hm-faq-list">
            {HOMEPAGE_FAQS.map(f => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CLOSE: the setup steps and the one action, as a colour block ================= */}
      <section className="hm-sec hm-sec-last">
        <div className="container">
          <div className="hm-block hm-close">
            <div>
              <h2 className="hm-h2">Give your club the matchday it deserves.</h2>
              <p className="hm-lede">Set up your club website, fixtures, squad and member passes this week, and run your next match live from the touchline.</p>
              <Link href="/create-club" className="hm-block-btn">Create your club</Link>
              <p className="hm-small">$0 a month, free forever. No bank card required.</p>
            </div>
            <ol className="hm-steps hm-steps-list">
              {CREATE_CLUB_STEPS.map(s => (
                <li key={s.name}><h3>{s.name}</h3><p>{s.text}</p></li>
              ))}
            </ol>
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
