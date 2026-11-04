'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDialog } from '@/lib/use-escape-to-close';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ThemeToggle from '@/components/ThemeToggle';
import PushToggle from '@/components/PushToggle';
import { useShopOpen } from '@/lib/use-shop-open';
import { useMyChildren } from '@/lib/use-my-children';
import { DEFAULT_CREST } from '@/lib/crest';
import { hasMultipleTeams } from '@/lib/teams';
import { Shield, Radio, CreditCard, Users, Calendar, CalendarDays, Trophy, Settings, Menu, X, User, LogOut, UserCog, ShoppingBag, Images, UserPlus, Handshake, BookOpen, Newspaper, Award } from 'lucide-react';
import { matchPath } from '@/lib/slugs';
import { useClubSections } from '@/lib/use-club-sections';

interface ClubNavbarProps {
  club: Club;
}

export default function ClubNavbar({ club }: ClubNavbarProps) {
  const { matches, clubTeams } = useClub();
  // A club with several teams gets a Teams page in place of the single-squad link
  const multiTeam = hasMultipleTeams(clubTeams, club.id);
  const { user, isAuthenticated, logout, hasClubAdminAccess, getUserRoleForClub } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const drawerRef = useDialog<HTMLDivElement>(mobileMenuOpen, () => setMobileMenuOpen(false));
  // The avatar's menu: member pass, account settings, theme, sign out
  const [accountOpen, setAccountOpen] = useState(false);
  const accountPanelRef = useDialog<HTMLDivElement>(accountOpen, () => setAccountOpen(false));
  const accountRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // A click anywhere outside the account menu closes it
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [accountOpen]);

  const isAdmin = hasClubAdminAccess(club.id);
  const userRole = user ? getUserRoleForClub(club.id) : null;
  // Signed in but not a member here (or not approved yet): still offered "Join the Club"
  const isClubMember = !!(isAuthenticated && user && userRole);
  // A parent of a junior here goes to their family page, not Join
  const isParent = useMyChildren(club.id).length > 0;

  const [logoError, setLogoError] = useState(false);

  // Reset error latch whenever club branding updates
  useEffect(() => {
    setLogoError(false);
  }, [club.logo_url]);


  // The Shop link only once the club has something on sale
  const hasShop = useShopOpen(club.id);
  const { tournaments: hasTournaments, gallery: hasGallery, leadership: hasLeadership } = useClubSections(club.id);

  // A match being played right now (half time included, as in the phone tab bar)
  const liveMatch = matches.find(m => m.club_id === club.id && (m.status === 'live' || m.status === 'halftime'));

  // The link bar shows as many links as fit beside the crest and club name. Links marked
  // data-nav-drop give way first (1 first); whatever is left out is still in the menu, so the
  // menu button shows whenever any link is hidden. Below that, it's the menu button alone.
  // Measured, not a fixed breakpoint: what fits depends on the club's name, who is signed in
  // (admins get extra controls) and whether a match is live.
  const rowRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [navFits, setNavFits] = useState(true);
  const [dropCount, setDropCount] = useState(0);
  useEffect(() => {
    const row = rowRef.current, nav = navRef.current, side = sideRef.current, name = nameRef.current;
    if (!row || !nav || !side || !name) return;
    const ctx = document.createElement('canvas').getContext('2d');
    // Last seen width of each link, so a hidden one can still be counted
    const widths = new WeakMap<Element, number>();
    const check = () => {
      // Room the club name needs on two lines (it wraps rather than cutting off): the widest line
      // of its best two-line split, plus the crest and the short-name badge beside it
      const style = getComputedStyle(name);
      let nameMin = Math.ceil(name.scrollWidth * 0.6);
      if (ctx) {
        ctx.font = style.font;
        const spacing = parseFloat(style.letterSpacing) || 0;
        const measure = (t: string) => ctx.measureText(t).width + spacing * t.length;
        const words = club.name.trim().split(/\s+/);
        nameMin = Math.ceil(words.length < 2 ? measure(club.name)
          : Math.min(...words.slice(1).map((_, i) =>
              Math.max(measure(words.slice(0, i + 1).join(' ')), measure(words.slice(i + 1).join(' '))))));
      }
      const badge = name.nextElementSibling as HTMLElement | null;
      // 10% spare: canvas text runs a little narrower than the rendered heading font
      const brandMin = 56 + Math.ceil(nameMin * 1.1) + 4 + (badge ? badge.offsetWidth + 7 : 0);
      // The controls on the right, without the menu button (shown or not, it's added below)
      const trigger = triggerRef.current;
      const sideW = side.offsetWidth - (trigger && trigger.offsetWidth ? trigger.offsetWidth + 8 : 0);
      const gap = parseFloat(getComputedStyle(nav).columnGap) || 16;

      const links = [...nav.children] as HTMLElement[];
      links.forEach(el => { if (el.offsetWidth) widths.set(el, el.offsetWidth + (parseFloat(getComputedStyle(el).marginLeft) || 0)); });
      const widthOf = (els: HTMLElement[]) =>
        els.reduce((sum, el) => sum + (widths.get(el) ?? 0), 0) + gap * Math.max(0, els.length - 1);
      const droppable = links
        .filter(el => el.dataset.navDrop)
        .sort((a, b) => Number(a.dataset.navDrop) - Number(b.dataset.navDrop));
      // clientWidth includes the container's side padding, which the links can't use
      const rowStyle = getComputedStyle(row);
      const rowWidth = row.clientWidth - (parseFloat(rowStyle.paddingLeft) || 0) - (parseFloat(rowStyle.paddingRight) || 0);
      // Less the two 1.25rem gaps between crest, links and controls, and a little spare
      const room = rowWidth - brandMin - sideW - 56;
      const menuButton = 48;

      let drop = 0;
      if (widthOf(links) > room) {
        drop = 1;
        while (drop <= droppable.length && widthOf(links.filter(el => !droppable.slice(0, drop).includes(el))) > room - menuButton) drop++;
      }
      setNavFits(drop <= droppable.length);
      // As a drop level: the data-nav-drop of the last link to give way (links not shown to this
      // visitor, like Sponsor when signed in, leave gaps in the numbering)
      const last = droppable[Math.min(drop, droppable.length) - 1];
      setDropCount(last ? Number(last.dataset.navDrop) : 0);
    };
    check();
    // The heading webfont swaps in after first paint and changes the name's width
    document.fonts?.ready.then(check);
    const observer = new ResizeObserver(check);
    observer.observe(row);
    observer.observe(nav);
    observer.observe(name);
    observer.observe(side);
    return () => observer.disconnect();
  }, [club.name, club.short_name]);
  const dropped = (n: number) => navFits && dropCount >= n;

  // The page they're on, without the slug (a club's own domain serves its pages at the root)
  const pathname = usePathname() || '';
  const here = pathname.startsWith(`/${club.slug}`) ? pathname.slice(club.slug.length + 1) || '/' : pathname;
  const isHere = (path: string) => (path === '/' ? here === '/' : here === path || here.startsWith(`${path}/`));

  const teamsLink = multiTeam ? { path: '/teams', label: 'Teams' } : { path: '/squad', label: 'Squad' };
  // One look for every link in the bar; data-nav-drop: which give way first when space runs out (1 first).
  // `group` starts a new group of links, set a little further from the one before.
  const barLink = (path: string, label: string, drop?: number, group?: boolean) => (
    <Link key={path} href={`/${club.slug}${path === '/' ? '' : path}`} className={`club-nav-link${group ? ' club-nav-group' : ''}`}
      aria-current={isHere(path) ? 'page' : undefined} data-nav-drop={drop} hidden={drop ? dropped(drop) : undefined}>
      {label}
    </Link>
  );
  // Become a Sponsor is a pitch to visitors; signed-in users don't need it in the bar
  const showSponsor = !isAuthenticated;
  // The menu, in the same three groups and order as the bar; links the visitor can't use (no shop yet) left out
  const menuGroups: { title: string; links: { path: string; label: string; icon: typeof Shield }[] }[] = [
    { title: 'Matchday', links: [
      { path: '/fixtures', label: 'Fixtures', icon: Calendar },
      ...(hasTournaments ? [{ path: '/tournaments', label: 'Tournaments', icon: Trophy }] : []),
      { path: '/events', label: 'Events', icon: CalendarDays },
      { path: teamsLink.path, label: teamsLink.label, icon: Users },
    ] },
    { title: 'The club', links: [
      { path: '/', label: 'Club home', icon: Shield },
      { path: '/news', label: 'News', icon: Newspaper },
      ...(hasGallery ? [{ path: '/gallery', label: 'Gallery', icon: Images }] : []),
      ...(hasLeadership ? [{ path: '/leadership', label: 'Leadership', icon: Award }] : []),
      { path: '/about', label: 'About', icon: BookOpen },
    ] },
    { title: 'Support the club', links: [
      ...(hasShop ? [{ path: '/shop', label: 'Shop', icon: ShoppingBag }] : []),
      // SPP-5: for everyone, signed in too: the parents and players who run local businesses are the club's likeliest sponsors
      { path: '/sponsor', label: 'Sponsor', icon: Handshake },
    ] },
  ];

  const passLabel = isClubMember ? 'My member pass' : isParent ? 'My family' : 'Join the club';
  const PassIcon = isClubMember ? CreditCard : isParent ? Users : UserPlus;
  const passHref = isClubMember || isParent ? `/${club.slug}/member` : `/${club.slug}/member?join=1`;

  const avatar = (size: number) => user && (user.avatar_url ? (
    <img loading="lazy" decoding="async" width={size} height={size} src={user.avatar_url} alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: 'var(--club-primary)', color: 'var(--club-primary-contrast, #090D16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 28 ? '0.8rem' : '0.7rem', fontWeight: 800, flexShrink: 0 }}>
      {user.full_name.substring(0, 1).toUpperCase()}
    </span>
  ));
  const who = user ? `${user.full_name}${userRole ? ` (${userRole})` : ''}` : '';

  return (
    <header className="club-navbar" data-nav-fits={navFits ? undefined : 'false'} data-nav-drop={navFits && dropCount ? dropCount : undefined} style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      // The link bar is still laid out (to be measured) while hidden; never let it widen the page
      overflowX: 'clip',
      background: 'rgba(var(--dk-10-15-23), 0.94)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {/* Main Club Navigation */}
      <div ref={rowRef} className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '74px',
        gap: '1.25rem',
      }}>
        {/* Club Crest & Title: the way home (the bar has no separate Home link) */}
        <Link
          href={`/${club.slug}`}
          aria-current={here === '/' ? 'page' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textDecoration: 'none',
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Shield / Crest Container */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '13px',
            border: `2px solid ${club.primary_color}`,
            background: 'linear-gradient(135deg, rgba(var(--tint-rgb), 0.08) 0%, rgba(var(--dk-15-23-42),0.95) 100%)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 14px rgba(0, 0, 0, 0.5), 0 0 16px ${club.primary_color}35`,
            flexShrink: 0,
            padding: '3px',
            position: 'relative',
          }}>
            {club.logo_url && !logoError ? (
              <img loading="eager" decoding="async"
                src={club.logo_url}
                alt={`${club.name} crest`}
                onError={() => setLogoError(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: club.primary_color,
                lineHeight: 1,
              }}>
                <Shield size={22} color={club.primary_color} />
                <span style={{ fontSize: '0.7rem', fontWeight: 900, marginTop: '2px', color: 'var(--text-primary)' }}>
                  {club.short_name || 'FC'}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              {/* Long names wrap to a second line; only a name too long for two lines ends in "..." */}
              <span ref={nameRef} className="club-nav-name" title={club.name} style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1rem, 3.8vw, 1.25rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                textWrap: 'balance',
                overflowWrap: 'anywhere',
              }}>
                {club.name}
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop links, in three groups: matchday, the club, supporting it */}
        <nav ref={navRef} aria-label="Club" style={{ display: 'none', alignItems: 'center', gap: '1rem', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }} className="desktop-nav">
          {barLink('/fixtures', 'Fixtures')}
          {hasTournaments && barLink('/tournaments', 'Tournaments', 7)}
          {barLink('/events', 'Events', 8)}
          {barLink(teamsLink.path, teamsLink.label, 9)}
          {barLink('/news', 'News', 6, true)}
          {hasGallery && barLink('/gallery', 'Gallery', 2)}
          {hasLeadership && barLink('/leadership', 'Leadership', 3)}
          {barLink('/about', 'About', 4)}
          {hasShop && barLink('/shop', 'Shop', 5, true)}
          {showSponsor && barLink('/sponsor', 'Sponsor', 1, !hasShop)}
        </nav>

        <div ref={sideRef} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Live match: on phones the tab bar's Live tab says it, so the pill is for wider screens */}
          {liveMatch && (
            <Link href={matchPath(club.slug, liveMatch)} aria-label="Live match: open the match centre" className="club-nav-live">
              <span className="badge badge-live" style={{ padding: '0.2rem 0.5rem' }}>
                <span className="pulse-dot" /> LIVE
              </span>
            </Link>
          )}

          {/* Visitors: sign in (members sign in on the club's member page, by emailed link) and join */}
          {!isAuthenticated && (
            <Link href={`/${club.slug}/member`} className="club-nav-desk club-nav-text">Sign in</Link>
          )}
          {!isClubMember && !isParent && (
            <Link href={`/${club.slug}/member?join=1`} className="club-nav-desk btn btn-primary btn-sm row">
              <UserPlus size={14} aria-hidden="true" />
              <span>Join</span>
            </Link>
          )}

          {isAdmin && (
            <Link href={`/${club.slug}/admin`} className="club-nav-desk club-nav-text" aria-current={isHere('/admin') ? 'page' : undefined}>
              <Settings size={15} aria-hidden="true" />
              <span>Admin Room</span>
            </Link>
          )}

          <PushToggle clubId={club.id} clubName={club.name} className="club-icon-btn" />
          {/* Signed in, the theme is in the avatar's menu; on phones it's in the menu drawer */}
          {!(isAuthenticated && user) && <ThemeToggle className="club-nav-desk club-icon-btn" />}

          {isAuthenticated && user && (
            <div ref={accountRef} className="club-nav-desk" style={{ position: 'relative' }}>
              <button
                type="button"
                className="club-icon-btn club-icon-btn-round"
                aria-expanded={accountOpen}
                aria-controls="club-account-menu"
                aria-label={`${who}: account menu`}
                title={who}
                onClick={() => setAccountOpen(o => !o)}
              >
                {avatar(28)}
              </button>
              {accountOpen && (
                <div ref={accountPanelRef} id="club-account-menu" className="club-account-panel"
                  onClick={e => { if ((e.target as HTMLElement).closest('a')) setAccountOpen(false); }}>
                  <div className="club-account-who">
                    {avatar(32)}
                    <div style={{ minWidth: 0 }}>
                      <div className="club-account-name">{user.full_name}</div>
                      <div className="text-meta">{userRole || 'Not a member yet'}</div>
                    </div>
                  </div>
                  <Link href={passHref} className="club-menu-link">
                    <PassIcon size={16} aria-hidden="true" />
                    <span>{passLabel}</span>
                  </Link>
                  <Link href={`/${club.slug}/account`} className="club-menu-link" aria-current={isHere('/account') ? 'page' : undefined}>
                    <UserCog size={16} aria-hidden="true" />
                    <span>Account settings</span>
                  </Link>
                  <ThemeToggle className="club-menu-link" label="Light or dark theme" />
                  <button type="button" className="club-menu-link club-menu-signout" onClick={() => { setAccountOpen(false); logout(); }}>
                    <LogOut size={16} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Menu trigger: phones, and desktop whenever a link gave way for room */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="club-menu-drawer"
            ref={triggerRef}
            className="mobile-trigger club-icon-btn"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer via Portal */}
      {isMounted && mobileMenuOpen && createPortal(
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div
            ref={drawerRef}
            id="club-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${club.name} menu`}
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
          >
            <div>
              {/* Drawer Club Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div className="row row-loose" style={{ minWidth: 0 }}>
                  <img loading="lazy" decoding="async" width={32} height={32}
                    src={club.logo_url || DEFAULT_CREST}
                    alt={`${club.name} crest`}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1.5px solid ${club.primary_color}`, objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{club.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="club-icon-btn"
                  aria-label="Close menu"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              {/* Who's signed in, first */}
              {isAuthenticated && user && (
                <div className="club-account-who" style={{ padding: '0 0.25rem 1rem' }}>
                  {avatar(36)}
                  <div style={{ minWidth: 0 }}>
                    <div className="club-account-name">{user.full_name}</div>
                    <div className="text-meta">{userRole || 'Not a member yet'}</div>
                  </div>
                </div>
              )}

              {/* The one main action (and the match centre while a match is on) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {liveMatch && (
                  <Link
                    href={matchPath(club.slug, liveMatch)}
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--c-red)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      padding: '0.65rem 1rem',
                      fontWeight: 700,
                    }}
                  >
                    <Radio size={16} aria-hidden="true" />
                    <span>Live now: match centre</span>
                  </Link>
                )}
                <Link
                  href={passHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
                >
                  <PassIcon size={16} aria-hidden="true" />
                  <span>{passLabel}</span>
                </Link>
              </div>

              {/* Section links, grouped */}
              {menuGroups.filter(g => g.links.length).map(group => (
                <div key={group.title} style={{ marginBottom: '1rem' }}>
                  <div className="club-menu-heading">{group.title}</div>
                  {group.links.map(({ path, label, icon: Icon }) => (
                    <Link key={path} href={`/${club.slug}${path === '/' ? '' : path}`} onClick={() => setMobileMenuOpen(false)}
                      className="club-menu-link" aria-current={isHere(path) ? 'page' : undefined}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              ))}

              {isAdmin && (
                <Link
                  href={`/${club.slug}/admin`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="club-menu-link club-menu-admin"
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>Admin Room</span>
                </Link>
              )}
            </div>

            {/* Theme, then sign in / out, at the foot */}
            <div style={{ paddingTop: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAuthenticated && user && (
                <Link href={`/${club.slug}/account`} onClick={() => setMobileMenuOpen(false)} className="club-menu-link"
                  aria-current={isHere('/account') ? 'page' : undefined}>
                  <UserCog size={16} aria-hidden="true" />
                  <span>Account settings</span>
                </Link>
              )}
              <ThemeToggle className="club-menu-link" label="Light or dark theme" />
              {isAuthenticated && user ? (
                <button type="button" className="club-menu-link club-menu-signout" onClick={() => { logout(); setMobileMenuOpen(false); }}>
                  <LogOut size={16} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              ) : (
                <Link
                  href={`/${club.slug}/member`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}
                >
                  <User size={16} aria-hidden="true" />
                  <span>Sign in</span>
                </Link>
              )}
            </div>
          </div>
        </div>,
        // Inside the club's theme wrapper, so the menu gets the club's colours (--club-primary)
        document.querySelector('.club-theme-root') || document.body
      )}

      <style jsx>{`
        /* Desktop-only controls (Sign in, Join, Admin Room, the avatar, the theme): on phones they're in the drawer */
        .club-navbar :global(.club-nav-desk) {
          display: none !important;
        }
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
          }
          .club-navbar :global(.club-nav-desk) {
            display: inline-flex !important;
          }
          .mobile-trigger {
            display: none !important;
          }
          /* Too narrow for the full link bar: keep it measurable but out of sight, show the menu */
          header[data-nav-fits='false'] .desktop-nav {
            position: absolute;
            top: 0;
            left: 0;
            visibility: hidden;
            pointer-events: none;
          }
          /* Hide at once: links transition 'all', so visibility would lag the jump to the corner and flash over the crest */
          header[data-nav-fits='false'] .desktop-nav,
          header[data-nav-fits='false'] .desktop-nav :global(*) {
            transition: none !important;
          }
          header[data-nav-fits='false'] .mobile-trigger {
            display: inline-flex !important;
          }
          /* Some links gave way for room: they're in the menu, so show its button too */
          header[data-nav-drop] .mobile-trigger {
            display: inline-flex !important;
          }
          .desktop-nav > :global([hidden]) {
            display: none !important;
          }
        }
        /* Phones (and the installed app) have the tab bar's Live tab */
        @media (max-width: 768px), (display-mode: standalone) {
          .club-navbar :global(.club-nav-live) {
            display: none;
          }
        }
        .club-navbar :global(.club-nav-live) {
          display: inline-flex;
          align-items: center;
        }
        .desktop-nav > :global(.club-nav-link) {
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.35rem 0;
          border-bottom: 2px solid transparent;
        }
        /* The first link of a group sits a little further from the group before */
        .desktop-nav > :global(.club-nav-group) {
          margin-left: 0.75rem;
        }
        .desktop-nav > :global(.club-nav-link:hover) {
          color: var(--text-primary);
        }
        .desktop-nav > :global(.club-nav-link[aria-current='page']) {
          color: var(--text-primary);
          border-bottom-color: var(--club-primary);
        }
        /* Quiet text controls on the right: Sign in, Admin Room */
        .club-navbar :global(.club-nav-text) {
          align-items: center;
          gap: 0.4rem;
          min-height: 40px;
          padding: 0 0.5rem;
          border-radius: 10px;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.9rem;
          white-space: nowrap;
        }
        .club-navbar :global(.club-nav-text:hover),
        .club-navbar :global(.club-nav-text[aria-current='page']) {
          color: var(--text-primary);
          background: rgba(var(--tint-rgb), 0.06);
        }
        /* One look for every icon button in the bar and the drawer: bell, theme, avatar, menu, close */
        :global(.club-icon-btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          padding: 0;
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          background: rgba(var(--tint-rgb), 0.04);
          color: var(--text-secondary);
          cursor: pointer;
        }
        :global(.club-icon-btn:hover) {
          color: var(--text-primary);
          background: rgba(var(--tint-rgb), 0.08);
        }
        /* Phones: a full 44px tap target */
        @media (max-width: 899px) {
          :global(.club-icon-btn) {
            width: 44px;
            height: 44px;
          }
        }
        :global(.club-icon-btn-round) {
          border-radius: 50%;
        }
        /* The bell when following: the club's colour on the icon and edge, no filled tile */
        :global(.club-icon-btn[aria-pressed='true']) {
          color: var(--club-ink);
          border-color: rgba(var(--club-primary-rgb), 0.45);
        }
        :global(.club-icon-btn[aria-expanded='true']) {
          border-color: rgba(var(--club-primary-rgb), 0.45);
        }
        .club-navbar :global(.club-account-panel) {
          position: absolute;
          top: calc(100% + 0.6rem);
          right: 0;
          width: 260px;
          padding: 0.5rem;
          border-radius: 12px;
          border: 1px solid var(--border-medium);
          background: var(--bg-surface-elevated);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
        }
        :global(.club-account-who) {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.5rem 0.6rem 0.65rem;
          min-width: 0;
        }
        .club-navbar :global(.club-account-who) {
          border-bottom: 1px solid var(--border-subtle);
          margin-bottom: 0.35rem;
        }
        :global(.club-account-name) {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-primary);
          overflow-wrap: break-word;
        }
        :global(.club-menu-heading) {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          padding: 0 0.85rem 0.35rem;
        }
        :global(.club-menu-link) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.6rem 0.85rem;
          min-height: 44px;
          border: 0;
          border-radius: 8px;
          background: none;
          color: var(--text-secondary);
          font: inherit;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }
        :global(.club-menu-link:hover) {
          color: var(--text-primary);
          background: rgba(var(--tint-rgb), 0.04);
        }
        :global(.club-menu-link[aria-current='page']) {
          color: var(--text-primary);
          background: rgba(var(--tint-rgb), 0.06);
        }
        :global(.club-menu-link[aria-current='page'] svg) {
          color: var(--club-primary);
        }
        :global(.club-menu-admin) {
          color: var(--club-ink);
          background: rgba(var(--club-primary-rgb), 0.1);
        }
        :global(.club-menu-signout:hover) {
          color: var(--c-red);
        }
      `}</style>
    </header>
  );
}
