'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import ScoreboardDigitRoll from '@/components/ScoreboardDigitRoll';
import { useClub, validateClubSlug } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { sponsorHref } from '@/lib/sponsors';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import { DEFAULT_BANNER, DEFAULT_CREST } from '@/lib/crest';
import './home.css';
import {
  Shield, Radio, Trophy, Users, QrCode, Zap, Globe, ArrowRight, Check, X,
  CheckCircle2, AlertCircle, Flame, Wallet, BarChart3, Newspaper, CalendarCheck, DoorOpen,
  Palette, Crown, Mail, Upload, Search, Images, ArrowLeftRight, Goal, Megaphone,
  Layers, ClipboardList, Share2,
} from 'lucide-react';

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
    body: 'Squad, fixtures, members, money, content and sponsors in one place, with roles for your president, secretary and treasurer.',
    points: [
      'Memberships paid by card or bank transfer, with receipts',
      'Income and expenses in one ledger',
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
  const { clubs, sponsors } = useClub();
  const { user, isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Hero playground: the visitor's club name + colours drive the live mock beside it
  const [clubName, setClubName] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const palette = FOOTBALL_COLOR_PALETTES[paletteIdx];
  const onPrimary = evaluateColorContrast(palette.primary).bestTextColor;
  const displayName = clubName.trim() || 'Your Club FC';
  const slugCheck = useMemo(() => validateClubSlug(clubName, clubs), [clubName, clubs]);
  const previewSlug = slugCheck.cleanSlug || 'yourclub';

  // One scripted goal so the mock reads as live: the clock ticks on and the home side scores at 71'
  const [minute, setMinute] = useState(67);
  useEffect(() => {
    if (minute >= 74) return;
    const t = setTimeout(() => setMinute(m => m + 1), 1800);
    return () => clearTimeout(t);
  }, [minute]);
  const goalIn = minute >= 71;

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
            <div className="lp-kicker">
              <span className="pulse-dot" aria-hidden="true" />
              Built for grassroots &amp; community football
            </div>

            <h1 className="lp-h1">
              {/* Explicit breaks: left to wrap, the fallback font fits "Big-club matchday." on one line
                  and the webfont doesn't, so the swap would shift the whole page */}
              Grassroots club.<br /><em>Big-club</em><br />matchday.
            </h1>

            <p className="lp-hero-sub">
              Your official club website, live match centre, digital member passes, subs collection and sponsor
              reporting, run by your committee from one dashboard. No developer. No spreadsheets. No 40-message group chats.
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
          <div className="lp-stage" aria-hidden="true" data-theme="dark">
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
                <div className="lp-crest">{initials(displayName)}</div>
                <div className="min-w-0">
                  <div className="lp-club-name">{displayName}</div>
                  <div className="lp-club-nav"><span>Fixtures</span><span>Squad</span><span>News</span><span>Membership</span></div>
                </div>
              </div>
              <div className="lp-score">
                <div className="lp-score-top">
                  <span className="lp-live-chip"><span className="pulse-dot" /> LIVE {minute}&apos;</span>
                  <span className="lp-comp">Sunday League · Div 2</span>
                </div>
                <div className="lp-board">
                  <div className="lp-team">
                    <div className="lp-crest">{initials(displayName)}</div>
                    <span>{displayName}</span>
                  </div>
                  <div className="lp-digits">
                    <div style={{ zoom: 0.62 }}><ScoreboardDigitRoll value={goalIn ? 2 : 1} isGoal={goalIn && minute < 74} /></div>
                    <span className="sep">:</span>
                    <div style={{ zoom: 0.62 }}><ScoreboardDigitRoll value={1} /></div>
                  </div>
                  <div className="lp-team">
                    <div className="lp-team-away">RVR</div>
                    <span>Riverside Rovers</span>
                  </div>
                </div>
                <div className="lp-timeline">
                  <div className={`lp-ev lp-ev-goal${goalIn ? ' is-in' : ''}`}>
                    <time>71&apos;</time><Goal size={15} color={palette.accent} /><span><b>GOAL!</b> D. Okafor, assist M. Silva</span>
                  </div>
                  <div className="lp-ev"><time>58&apos;</time><ArrowLeftRight size={14} color="var(--c-sky)" /><span>Sub: J. Park on for L. Hughes</span></div>
                  <div className="lp-ev"><time>41&apos;</time><span className="lp-card-yellow" /><span>Yellow card, Riverside #6</span></div>
                  <div className="lp-ev"><time>23&apos;</time><Goal size={15} color="var(--text-primary)" /><span><b>Goal</b> M. Silva</span></div>
                </div>
              </div>
            </div>

            <div className="lp-pass">
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

            {/* Lineup + availability */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#60A5FA' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Users size={19} /></div>
                <h3>Availability &amp; lineups</h3>
                <p>Share one link and players reply in a tap. Then drag the ones who are in onto the pitch and publish the XI.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-pitch">
                  <div className="lp-pitch-half" />
                  {[[8, 50], [24, 20], [22, 40], [22, 60], [24, 80], [40, 30], [38, 50], [40, 70], [56, 22], [58, 50], [56, 78]].map(([x, y], i) => (
                    <div key={i} className="lp-pl" style={{ left: `${x}%`, top: `${y}%`, '--i': i } as React.CSSProperties}>{i + 1}</div>
                  ))}
                </div>
                <div className="lp-avail">
                  <span style={{ background: 'rgba(16,185,129,.15)', color: 'var(--c-green)' }}>16 in</span>
                  <span style={{ background: 'rgba(239,68,68,.12)', color: 'var(--c-red)' }}>2 out</span>
                  <span style={{ background: 'rgba(148,163,184,.12)', color: 'var(--text-primary)' }}>3 maybe</span>
                </div>
              </div>
            </article>

            {/* Payments */}
            <article className="lp-tile lp-reveal" style={{ '--tc': '#FBBF24' } as React.CSSProperties}>
              <div>
                <div className="lp-tile-ico"><Wallet size={19} /></div>
                <h3>Subs &amp; club finances</h3>
                <p>Membership plans paid by card (Stripe) or bank transfer, with automatic receipts. Income and expenses sit in one ledger.</p>
              </div>
              <div className="lp-viz lp-play">
                <div className="lp-money">
                  <div className="lp-money-top"><b>$2,340</b><small>of $3,000 season subs</small></div>
                  <div className="lp-bar"><i /></div>
                  <div className="lp-tx"><span>Senior membership · J. Park</span><em>+$120</em></div>
                  <div className="lp-tx"><span>Kit sponsor · Northside Motors</span><em>+$800</em></div>
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
            <div className="lp-step lp-reveal">
              <div className="lp-step-n">01</div>
              <h3>Claim your club</h3>
              <p>Pick your name and web address, upload your crest and choose your colours. The kit preview updates as you go.</p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step-n">02</div>
              <h3>Bring in the squad</h3>
              <p>Import members in bulk, add fixtures for the season and appoint your committee.</p>
            </div>
            <div className="lp-step lp-reveal">
              <div className="lp-step-n">03</div>
              <h3>Share the link</h3>
              <p>Post your club address in the group chat. From then on, matchday runs from your phone.</p>
            </div>
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
                    <img loading="lazy" decoding="async" src={sponsor.logo_url} alt={`${sponsor.name} logo`}
                      style={{ height: isPlatinum ? '56px' : isGold ? '46px' : '38px', maxWidth: '100%', objectFit: 'contain' }} />
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
