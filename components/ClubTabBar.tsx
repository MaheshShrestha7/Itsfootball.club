'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Radio, LayoutGrid, CreditCard, UserPlus, Shield } from 'lucide-react';
import type { Club } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';

/**
 * Phone tab bar for the club site (shown under 769px, and at any width in the installed app, by
 * globals.css), so the site works like an app. Members get their pass, staff get the admin area.
 * It stays on admin pages too: the My Club tiles open admin tools, and the bar is the way back.
 */
export default function ClubTabBar({ club }: { club: Club }) {
  const pathname = usePathname() || '';
  const { matches, members } = useClub();
  const { user, hasClubAdminAccess } = useAuth();
  const base = `/${club.slug}`;
  const onHome = pathname === base;
  const fixturesInView = useSectionInView(onHome ? 'fixtures' : null);
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

  // A tab stays lit on the pages under it (Admin on every admin tool). Fixtures is a section of the
  // home page (its link carries #fixtures, which the pathname never does), so on the home page it's
  // lit while that section is in view, and Home the rest of the time.
  const isActive = (href: string) => {
    if (href === `${base}#fixtures`) return onHome && fixturesInView;
    if (href === base) return onHome && !fixturesInView;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <div className="club-tabbar-spacer" aria-hidden="true" />
      <nav className="club-tabbar" aria-label="App">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <Link key={t.label} href={t.href} aria-current={isActive(t.href) ? 'page' : undefined}>
              <Icon size={20} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Whether the element with this id crosses a band a third of the way down the screen, where a section
 *  lands after a jump to it (under the top bar). The section can render after this mounts (club data
 *  loads in the browser), so it waits for the element to appear. */
function useSectionInView(id: string | null) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    setInView(false);
    if (!id) return;
    let io: IntersectionObserver | null = null;
    const watch = (el: Element) => {
      io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '-30% 0px -60% 0px' });
      io.observe(el);
    };
    const found = document.getElementById(id);
    if (found) {
      watch(found);
      return () => io?.disconnect();
    }
    const mo = new MutationObserver(() => {
      const el = document.getElementById(id);
      if (el) {
        mo.disconnect();
        watch(el);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io?.disconnect();
    };
  }, [id]);

  return inView;
}
