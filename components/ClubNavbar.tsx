'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
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
import { Shield, Radio, CreditCard, Users, Calendar, CalendarDays, Trophy, Settings, Menu, X, User, LogOut, ShoppingBag, Images, UserPlus, Handshake, BookOpen, Newspaper } from 'lucide-react';
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
  useEscapeToClose(mobileMenuOpen, setMobileMenuOpen);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
  const { tournaments: hasTournaments, gallery: hasGallery } = useClubSections(club.id);

  // Check if any match for this club is currently LIVE
  const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');

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
      // The theme/notification controls, without the menu button (shown or not, it's added below)
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
      // visitor, like Become a Sponsor when signed in, leave gaps in the numbering)
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
    return () => observer.disconnect();
  }, [club.name, club.short_name]);
  const dropped = (n: number) => navFits && dropCount >= n;

  // The page they're on, without the slug (a club's own domain serves its pages at the root)
  const pathname = usePathname() || '';
  const here = pathname.startsWith(`/${club.slug}`) ? pathname.slice(club.slug.length + 1) || '/' : pathname;
  const isHere = (path: string) => (path === '/' ? here === '/' : here === path || here.startsWith(`${path}/`));
  const teamsLink = multiTeam ? { path: '/teams', label: 'Teams' } : { path: '/squad', label: 'Squad' };
  // One look for every link in the bar; data-nav-drop: which give way first when space runs out (1 first)
  const barLink = (path: string, label: string, drop?: number) => (
    <Link key={path} href={`/${club.slug}${path === '/' ? '' : path}`} className="club-nav-link" aria-current={isHere(path) ? 'page' : undefined}
      data-nav-drop={drop} hidden={drop ? dropped(drop) : undefined}>
      {label}
    </Link>
  );
  // The menu, in three groups; links the visitor can't use (no shop yet, sponsor pitch once signed in) left out
  const menuGroups: { title: string; links: { path: string; label: string; icon: typeof Shield }[] }[] = [
    { title: 'Matchday', links: [
      { path: '/fixtures', label: 'Fixtures & Results', icon: Calendar },
      ...(hasTournaments ? [{ path: '/tournaments', label: 'Tournaments & Cups', icon: Trophy }] : []),
      { path: '/events', label: 'Events & Trainings', icon: CalendarDays },
    ] },
    { title: 'The club', links: [
      { path: '/', label: 'Club home', icon: Shield },
      { path: '/about', label: 'About the Club', icon: BookOpen },
      { path: teamsLink.path, label: multiTeam ? 'Our Teams' : 'Squad & Stats', icon: Users },
      { path: '/news', label: 'Latest News', icon: Newspaper },
      ...(hasGallery ? [{ path: '/gallery', label: 'Gallery & Videos', icon: Images }] : []),
    ] },
    { title: 'Support the club', links: [
      ...(hasShop ? [{ path: '/shop', label: 'Club Shop', icon: ShoppingBag }] : []),
      ...(!isAuthenticated ? [{ path: '/sponsor', label: 'Become a Sponsor', icon: Handshake }] : []),
    ] },
  ];

  return (
    <header data-nav-fits={navFits ? undefined : 'false'} data-nav-drop={navFits && dropCount ? dropCount : undefined} style={{
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
        {/* Club Crest & Title */}
        <Link
          href={`/${club.slug}`}
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

        {/* Desktop Links */}
        <nav ref={navRef} style={{ display: 'none', alignItems: 'center', gap: '1rem', marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }} className="desktop-nav">
          {barLink('/', 'Club')}

          {/* Live match: otherwise the match centre is just the Fixtures link, so it isn't listed twice */}
          {liveMatch && (
            <Link href={matchPath(club.slug, liveMatch)} aria-label="Live match: open the match centre" style={{ display: 'flex', alignItems: 'center' }}>
              <span className="badge badge-live" style={{ padding: '0.2rem 0.5rem' }}>
                <span className="pulse-dot" /> LIVE
              </span>
            </Link>
          )}

          {barLink('/fixtures', 'Fixtures')}
          {barLink(teamsLink.path, teamsLink.label, 8)}
          {barLink('/events', 'Events', 7)}
          {hasTournaments && barLink('/tournaments', 'Tournaments', 6)}
          {barLink('/news', 'News', 5)}
          {hasShop && barLink('/shop', 'Shop', 4)}
          {barLink('/about', 'About', 3)}
          {hasGallery && barLink('/gallery', 'Gallery', 2)}
          {/* Become a Sponsor is a pitch to visitors; signed-in users don't need it in the bar */}
          {!isAuthenticated && barLink('/sponsor', 'Sponsor', 1)}

          {/* Admin Portal Gateway */}
          {isAdmin && (
            <Link
              href={`/${club.slug}/admin`}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'rgba(var(--club-primary-rgb), 0.12)',
                color: 'var(--club-ink)',
                border: '1px solid rgba(var(--club-primary-rgb), 0.4)',
                fontWeight: 700,
              }}
            >
              <Settings size={14} />
              <span>Admin Room</span>
            </Link>
          )}

          {/* Auth Identity Controls */}
          {/* Join the Club, for anyone who isn't a member here (members reach their pass from their avatar) */}
          {!isClubMember && !isParent && (
            <Link href={`/${club.slug}/member?join=1`} className="btn btn-primary btn-sm row" style={{ marginLeft: '0.25rem' }}>
              <UserPlus size={14} />
              <span>Join</span>
            </Link>
          )}

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link
                href={`/${club.slug}/member`}
                aria-label={`${user.full_name}${userRole ? ` (${userRole})` : ''}: my member pass`}
                title={`${user.full_name}${userRole ? ` (${userRole})` : ''}: my member pass`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.2rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(var(--tint-rgb), 0.05)',
                  border: '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                }}
              >
                {user.avatar_url ? (
                  <img loading="lazy" decoding="async" width={24} height={24}
                    src={user.avatar_url}
                    alt={`${user.full_name} photo`}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--club-primary)', color: 'var(--club-primary-contrast, #090D16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                    {user.full_name.substring(0, 1).toUpperCase()}
                  </div>
                )}
              </Link>

              <button
                type="button"
                onClick={() => logout()}
                title="Sign Out"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Members sign in on the club's member page (emailed link), not with a platform account */}
              <Link href={`/${club.slug}/member`} className="btn btn-secondary btn-sm row">
                <User size={14} />
                <span>Sign In</span>
              </Link>
            </div>
          )}
        </nav>

        <div ref={sideRef} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <PushToggle clubId={club.id} clubName={club.name} />
        <ThemeToggle />
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '8px',
          }}
          aria-label="Toggle Menu"
          ref={triggerRef}
          className="mobile-trigger touch-target"
        >
          <Menu size={24} />
        </button>
        </div>
      </div>

      {/* Mobile Menu Drawer via Portal */}
      {isMounted && mobileMenuOpen && createPortal(
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
          >
            <div>
              {/* Drawer Club Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div className="row row-loose">
                  <img loading="lazy" decoding="async" width={32} height={32}
                    src={club.logo_url || DEFAULT_CREST}
                    alt={`${club.name} crest`}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1.5px solid ${club.primary_color}`, objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{club.name}</div>
                    <div className="text-meta">Official Matchday Portal</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: 'rgba(var(--tint-rgb), 0.06)', border: 'none', color: 'var(--text-primary)', padding: '0.45rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label="Close Menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Action Buttons: Match Centre & Member Pass */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <Link
                  href={liveMatch ? matchPath(club.slug, liveMatch) : `/${club.slug}/fixtures`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: liveMatch ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--tint-rgb), 0.06)',
                    color: liveMatch ? 'var(--c-red)' : 'var(--text-primary)',
                    border: `1px solid ${liveMatch ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-subtle)'}`,
                    padding: '0.65rem 1rem',
                    fontWeight: 700,
                  }}
                >
                  <Radio size={16} color={liveMatch ? '#EF4444' : 'currentColor'} />
                  <span>{liveMatch ? 'Watch Match Centre (LIVE)' : 'Match-Day Centre'}</span>
                </Link>

                {/* Members: their member pass. Everyone else: join the club */}
                <Link
                  href={isClubMember || isParent ? `/${club.slug}/member` : `/${club.slug}/member?join=1`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1rem' }}
                >
                  {isClubMember ? <CreditCard size={16} /> : isParent ? <Users size={16} /> : <UserPlus size={16} />}
                  <span>{isClubMember ? 'Digital Member Pass' : isParent ? 'My family' : 'Join the Club'}</span>
                </Link>
              </div>

              {/* Section links, grouped */}
              {menuGroups.filter(g => g.links.length).map(group => (
                <div key={group.title} style={{ marginBottom: '1rem' }}>
                  <div className="club-menu-heading">{group.title}</div>
                  {group.links.map(({ path, label, icon: Icon }) => (
                    <Link key={path} href={`/${club.slug}${path === '/' ? '' : path}`} onClick={() => setMobileMenuOpen(false)}
                      className="club-menu-link" aria-current={isHere(path) ? 'page' : undefined}>
                      <Icon size={16} />
                      <span>{label}</span>
                    </Link>
                  ))}
                </div>
              ))}

              {isAdmin && (
                <Link
                  href={`/${club.slug}/admin`}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    color: 'var(--club-ink)',
                    background: 'rgba(var(--club-primary-rgb), 0.1)',
                    border: '1px solid rgba(var(--club-primary-rgb), 0.3)',
                    fontWeight: 700,
                  }}
                >
                  <Settings size={16} />
                  <span>Club Admin</span>
                </Link>
              )}
            </div>

            {/* Mobile Auth Button */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {isAuthenticated && user ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="row">
                    {user.avatar_url ? (
                      <img loading="lazy" decoding="async" width={32} height={32} src={user.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--club-primary)', color: 'var(--club-primary-contrast, #090D16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                        {user.full_name.substring(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                        {user.full_name}
                      </div>
                      <div className="text-meta">
                        {userRole || 'Not a member yet'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--c-red)', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href={`/${club.slug}/member`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <User size={16} />
                  <span>Sign in to the Club</span>
                </Link>
              )}
            </div>
          </div>
        </div>,
        // Inside the club's theme wrapper, so the menu gets the club's colours (--club-primary)
        document.querySelector('.club-theme-root') || document.body
      )}

      <style jsx>{`
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
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
            display: flex !important;
          }
          /* Some links gave way for room: they're in the menu, so show its button too */
          header[data-nav-drop] .mobile-trigger {
            display: flex !important;
          }
          .desktop-nav > :global([hidden]) {
            display: none !important;
          }
        }
        .desktop-nav > :global(.club-nav-link) {
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.9rem;
          padding: 0.35rem 0;
          border-bottom: 2px solid transparent;
        }
        .desktop-nav > :global(.club-nav-link:hover) {
          color: var(--text-primary);
        }
        .desktop-nav > :global(.club-nav-link[aria-current='page']) {
          color: var(--text-primary);
          border-bottom-color: var(--club-primary);
        }
        :global(.club-menu-heading) {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 0 0.85rem 0.35rem;
        }
        :global(.club-menu-link) {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.85rem;
          min-height: 44px;
          border-radius: 8px;
          color: var(--text-secondary);
          font-weight: 600;
        }
        :global(.club-menu-link[aria-current='page']) {
          color: var(--text-primary);
          background: rgba(var(--tint-rgb), 0.06);
        }
        :global(.club-menu-link[aria-current='page'] svg) {
          color: var(--club-primary);
        }
        @media (max-width: 480px) {
          .hide-on-mobile-xs {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}

