'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { hasMultipleTeams } from '@/lib/teams';
import { useClubSections } from '@/lib/use-club-sections';
import { useShopOpen } from '@/lib/use-shop-open';
import { Skeleton } from '@/components/Skeleton';

/**
 * The frame every public club sub-page shares (fixtures, events, teams, news, ...): a breadcrumb back to
 * the club, the heading and intro, optional actions, then a row of section tabs that sticks under the
 * navbar so visitors can hop between sections without the menu. `width` matches the page's content.
 */
export default function ClubSubPage({
  club, title, intro, icon, trail = [], actions, width = 1080, children,
}: {
  club: Club;
  title: React.ReactNode;
  intro?: React.ReactNode;
  icon?: React.ReactNode;
  /** Crumbs between the club and this page, e.g. Teams on a team's page */
  trail?: { href: string; label: string }[];
  actions?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="club-sub">
      <header className="club-sub-head">
        <div className="container" style={{ maxWidth: width }}>
          <nav aria-label="Breadcrumb">
            <ol className="club-crumbs">
              <li><Link href={`/${club.slug}`}>{club.short_name || club.name}</Link></li>
              {trail.map(c => <li key={c.href}><Link href={c.href}>{c.label}</Link></li>)}
              <li aria-current="page">{title}</li>
            </ol>
          </nav>
          <h1 className="club-sub-title">{icon}{title}</h1>
          {intro && <p className="club-sub-intro">{intro}</p>}
          {actions && <div className="club-sub-actions">{actions}</div>}
        </div>
      </header>
      <ClubSectionTabs club={club} />
      <div className="container club-sub-body" style={{ maxWidth: width }}>{children}</div>
    </div>
  );
}

/** The club's public sections as tabs, the same set (and conditions) as the navbar menu */
function ClubSectionTabs({ club }: { club: Club }) {
  const { clubTeams } = useClub();
  const { tournaments, gallery, leadership } = useClubSections(club.id);
  const shop = useShopOpen(club.id);
  const pathname = usePathname() || '';
  const here = pathname.startsWith(`/${club.slug}`) ? pathname.slice(club.slug.length + 1) : pathname;
  const multiTeam = hasMultipleTeams(clubTeams, club.id);
  const tabs = [
    { path: '/fixtures', label: 'Fixtures' },
    ...(tournaments ? [{ path: '/tournaments', label: 'Tournaments' }] : []),
    { path: '/events', label: 'Events' },
    multiTeam ? { path: '/teams', label: 'Teams' } : { path: '/squad', label: 'Squad' },
    { path: '/news', label: 'News' },
    ...(gallery ? [{ path: '/gallery', label: 'Gallery' }] : []),
    ...(leadership ? [{ path: '/leadership', label: 'Leadership' }] : []),
    { path: '/about', label: 'About' },
    ...(shop ? [{ path: '/shop', label: 'Shop' }] : []),
    { path: '/sponsor', label: 'Sponsor' },
  ];
  // Squad and player pages belong to Teams when the club has several (Squad isn't its own tab then)
  const active = (path: string) => here === path || here.startsWith(`${path}/`) || (path === '/teams' && here.startsWith('/squad'));
  return (
    <nav className="club-subnav" aria-label="Club sections">
      <div className="container club-subnav-row">
        {tabs.map(t => (
          <Link key={t.path} href={`/${club.slug}${t.path}`} className="club-subnav-link" aria-current={active(t.path) ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Upcoming | Past switch for the list pages, with counts */
export function UpcomingPastTabs({ view, onView, upcoming, past, labels = ['Upcoming', 'Past'] }: {
  view: 'upcoming' | 'past';
  onView: (v: 'upcoming' | 'past') => void;
  upcoming: number;
  past: number;
  labels?: [string, string];
}) {
  return (
    <div className="club-seg" role="tablist" aria-label="Show">
      {(['upcoming', 'past'] as const).map((v, i) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => onView(v)}>
          {labels[i]} <span className="club-seg-count">{v === 'upcoming' ? upcoming : past}</span>
        </button>
      ))}
    </div>
  );
}

/** A month heading over its rows ("November 2026") */
export function MonthGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="club-month" aria-label={label}>
      <h3 className="club-month-label">{label}</h3>
      <div className="stack stack-sm">{children}</div>
    </section>
  );
}

/** Row-shaped placeholders while the club's data loads */
export function ListSkeleton({ rows = 4, height = 72, label = 'Loading' }: { rows?: number; height?: number; label?: string }) {
  return (
    <div role="status" className="stack stack-sm">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} style={{ height, borderRadius: 'var(--radius-lg)' }} />)}
    </div>
  );
}

/** An empty list that says why and, when there is one, where to go next */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="glass-panel club-empty">
      <p className="club-empty-title">{title}</p>
      {children && <p className="text-note" style={{ margin: 0 }}>{children}</p>}
      {action && <div style={{ marginTop: '0.85rem' }}>{action}</div>}
    </div>
  );
}
