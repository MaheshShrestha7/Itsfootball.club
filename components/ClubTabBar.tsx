'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Radio, LayoutGrid, CreditCard, UserPlus, Shield } from 'lucide-react';
import type { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';

/**
 * Phone tab bar for the club site (shown under 769px by globals.css), so the site works like an
 * app. Members get their pass, staff get the admin area; the admin area has its own menu, so it's
 * hidden there.
 */
export default function ClubTabBar({ club }: { club: Club }) {
  const pathname = usePathname() || '';
  const { matches, members } = useClub();
  const { user, hasClubAdminAccess } = useAuth();
  if (pathname.includes('/admin')) return null;

  const base = `/${club.slug}`;
  const live = matches.find(m => m.club_id === club.id && (m.status === 'live' || m.status === 'halftime'));
  const member = !!user && members.some(m => m.club_id === club.id && m.user_id === user.id);

  const tabs = [
    { label: 'Home', href: base, icon: Home },
    live
      ? { label: 'Live', href: `${base}/match/${live.id}`, icon: Radio }
      : { label: 'Fixtures', href: `${base}#fixtures`, icon: CalendarDays },
    { label: 'My Club', href: `${base}/app`, icon: LayoutGrid },
    member ? { label: 'Pass', href: `${base}/member`, icon: CreditCard } : { label: 'Join', href: `${base}/member`, icon: UserPlus },
    ...(user && hasClubAdminAccess(club.id) ? [{ label: 'Admin', href: `${base}/admin`, icon: Shield }] : []),
  ];

  return (
    <>
      <div className="club-tabbar-spacer" aria-hidden="true" />
      <nav className="club-tabbar" aria-label="App">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} aria-current={pathname === t.href ? 'page' : undefined}>
              <Icon size={20} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
