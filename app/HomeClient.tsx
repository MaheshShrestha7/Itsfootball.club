'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  ArrowRight, ArrowLeftRight, AlertCircle, Check, CheckCircle2, Clock,
  Goal, RotateCcw, X,
} from 'lucide-react';
import { trackPlatformVisit } from '@/lib/platform-tracking';
import { HOMEPAGE_FAQS } from '@/lib/schema';
import { matchPath, newsPath } from '@/lib/slugs';
import LocalTime from '@/components/LocalTime';
import type { HomeDemoClub, HomeResultRow, HomeUpcomingRow, LatestNewsRow, LatestPhotoRow } from '@/lib/supabase/club-lookup';
import FootballBand from '@/components/FootballBand';
import RoleCards from '@/components/RoleCards';

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

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** Club blocks shown before "See all clubs" takes the last slot */
const HOME_CLUB_BLOCKS = 12;

export default function PlatformHomePage({ latestNews = [], latestPhotos = [], results = [], upcoming = [], demoClub: pickedDemo = null }: { latestNews?: LatestNewsRow[]; latestPhotos?: LatestPhotoRow[]; results?: HomeResultRow[]; upcoming?: HomeUpcomingRow[]; demoClub?: HomeDemoClub | null }) {
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
  // Newest album: its photos grouped, so one event shows once (not three tiles with the same title)
  const album = (() => {
    const first = latestPhotos.find(p => clubOf(p.club_id));
    if (!first) return null;
    const key = (p: LatestPhotoRow) => `${p.club_id}|${p.album_name || p.title || ''}`;
    const photos = latestPhotos.filter(p => key(p) === key(first)).slice(0, 3);
    const club = clubOf(first.club_id)!;
    return { club, photos, title: first.album_name || first.title || 'New photos', at: first.created_at };
  })();
  const news = latestNews.flatMap(n => {
    const club = clubOf(n.club_id);
    return club ? [{ id: n.id, at: n.published_at, href: newsPath(club.slug, n.slug), image: n.cover_image_url || club.banner_url || DEFAULT_BANNER, title: n.title, clubName: club.short_name || club.name }] : [];
  }).slice(0, 3);
  // Coming up: the next four fixtures and public events of listed clubs
  const comingUp = upcoming.flatMap(u => {
    const club = clubOf(u.club_id);
    if (!club) return [];
    return [u.kind === 'match'
      ? { key: `m-${u.id}`, at: u.at, href: matchPath(club.slug, u), title: `${u.home_team_name} v ${u.away_team_name}`, where: u.venue, club }
      : { key: `e-${u.id}`, at: u.at, href: `/${club.slug}/events/${u.id}`, title: u.title, where: u.location, club }];
  }).slice(0, 4);
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

  // Hero playground: the visitor's club name + colours drive the player's kit and the live demo below
  const [clubName, setClubName] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const palette = FOOTBALL_COLOR_PALETTES[paletteIdx];
  const onPrimary = evaluateColorContrast(palette.primary).bestTextColor;
  const displayName = clubName.trim() || 'Your Club FC';
  const slugCheck = useMemo(() => validateClubSlug(clubName, allClubs), [clubName, allClubs]);

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
          <div className="lp-hero-upper">
            <div className="lp-hero-left">
              {/* No hidden keyword text in the H1 (Google treats it as hidden text); the definition below carries the keywords */}
              <h1 className="lp-h1 lp-h1-stack">
                <span>Football.</span> <span>Community.</span> <span>Passion.</span>
              </h1>

              <p className="lp-hero-tag">The complete football club operating system.</p>
              <p className="lp-hero-sub">
                Website, live match centre and member passes for grassroots clubs. Free.
              </p>

              {/* Was the trust bar under the hero: now under the sentence, so the hero has no empty block */}
              <div className="lp-hero-trust">
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

            {/* Right: the 3D player, with the address box under him */}
            <div className="lp-hero-right">
              <FootballBand kit={palette.primary} />
              {/* Claim URL */}
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
                {!clubName.trim() ? null : slugCheck.valid ? (
                  <><CheckCircle2 size={15} /> itsfootball.club/{slugCheck.cleanSlug} looks free. Claim it before someone else does.</>
                ) : (
                  <><AlertCircle size={15} /> {slugCheck.error}</>
                )}
              </div>

              {/* Club colours: repaint his kit */}
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
          </div>

        </div>
      </section>

      {/* ================= LIVE: score a game from the touchline (moved down from the hero) ================= */}
      <section
        className="hm-sec lp-live"
        aria-labelledby="lp-live-h"
        style={{ '--lp-p': palette.primary, '--lp-s': palette.secondary, '--lp-a': palette.accent, '--lp-on-p': onPrimary } as React.CSSProperties}
      >
        <div className="container lp-live-grid">
          <div className="lp-live-copy">
            <h2 id="lp-live-h" className="hv-h2">Score it from the touchline.</h2>
            <p>Tap Goal on your phone. Everyone following the club sees it. Try it here.</p>
            <RoleCards />
          </div>
          {/* Right Column: Live Matchday Command Console */}
        <div
          className="lp-stage"
          role="region"
          aria-label="Try the live match centre"
          data-theme="dark"
        >
          <div className="lp-browser">
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
      </section>

      {/* ================= LATEST: newest album, results board, news headlines (real club data only) ================= */}
      {clubs.length > 0 && (
        <section className="hm-sec" aria-labelledby="hm-clubs-h">
          <div className="container">
            <div className="hv-head">
              <h2 id="hm-clubs-h" className="hv-h2">Latest from our clubs.</h2>
              <Link href="/clubs" className="hm-link">All {clubs.length} {clubs.length === 1 ? 'club' : 'clubs'}</Link>
            </div>
            {album || news.length || boardGames.length || comingUp.length ? (
              <div className={`lt${album ? '' : ' no-album'}`}>
                {album && (
                  <Link href={`/${album.club.slug}/gallery`} className="lt-album">
                    <span className={`lt-pics n${album.photos.length}`}>
                      {album.photos.map(ph => <img key={ph.id} src={ph.thumbnail_url || ph.media_url} alt="" loading="lazy" decoding="async" />)}
                    </span>
                    <span className="lt-cap">
                      <img src={album.club.logo_url || DEFAULT_CREST} alt="" width={36} height={36} loading="lazy" decoding="async" />
                      <span><b>{album.title}</b><small>{album.club.short_name || album.club.name} photos, <LocalTime value={album.at} options={{ day: 'numeric', month: 'short' }} /></small></span>
                    </span>
                  </Link>
                )}
                {comingUp.length > 0 && (
                  <div className="lt-up">
                    <h3>Coming up</h3>
                    <ul>
                      {comingUp.map(u => (
                        <li key={u.key}>
                          <Link href={u.href}>
                            <span className="lt-date"><b><LocalTime value={u.at} options={{ day: 'numeric' }} /></b><LocalTime value={u.at} options={{ month: 'short' }} /></span>
                            <span><b>{u.title}</b><small>{u.club.short_name || u.club.name}, <LocalTime value={u.at} options={{ weekday: 'short', hour: 'numeric', minute: '2-digit' }} format="both" />{u.where ? `, ${u.where}` : ''}</small></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {boardGames.length > 0 && (
                  <div className="lt-board">
                    <h3>Results</h3>
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
                        <Link key={game.id} href={matchPath(club.slug, game)} className="lt-game">
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
                )}
                {news.length > 0 && (
                  <div className="lt-news">
                    <h3>News</h3>
                    <ul>
                      {news.map(n => (
                        <li key={n.id}>
                          <Link href={n.href}>
                            <img src={n.image} alt="" width={64} height={64} loading="lazy" decoding="async" />
                            <span><b>{n.title}</b><small>{n.clubName}, <LocalTime value={n.at} options={{ day: 'numeric', month: 'short' }} /></small></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
