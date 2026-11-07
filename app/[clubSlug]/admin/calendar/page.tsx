'use client';

import React, { use, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { clubTeamsOf } from '@/lib/teams';
import { buildCalendarItems, CALENDAR_KINDS, newItemHref, openItemHref, type CalendarItem } from '@/lib/admin-calendar';
import ClubCalendar, { type CalendarLink } from '@/components/ClubCalendar';

// Everything dated in one place: fixtures, events and training, tournaments and season dates.
// Read-only: each item links to the page where it's edited.
export default function AdminCalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, tournaments, seasons, clubTeams } = useClub();
  const { can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id), [clubTeams, club.id]);

  // Only the rows this person's roles let them see (season dates are for everyone here)
  const allowed = useMemo(
    () => ({
      matches: can(club.id, 'matches'),
      events: can(club.id, 'events'),
      tournaments: can(club.id, 'tournaments'),
    }),
    [can, club.id]
  );
  const items = useMemo(
    () => buildCalendarItems({
      clubId: club.id,
      matches: allowed.matches ? matches : [],
      events: allowed.events ? events : [],
      tournaments: allowed.tournaments ? tournaments : [],
      seasons,
      clubTeams,
    }),
    [club.id, allowed, matches, events, tournaments, seasons, clubTeams]
  );
  const kindChips = CALENDAR_KINDS.filter(k =>
    k.key === 'season' ? true
      : k.key === 'match' ? allowed.matches || allowed.events
        : k.key === 'tournament' ? allowed.tournaments || allowed.events
          : allowed.events
  );

  const base = `/${club.slug}/admin`;
  const itemLinks = (item: CalendarItem) => {
    const links: CalendarLink[] = [];
    if (item.source === 'matches') {
      if (can(club.id, 'match-center')) links.push({ href: `${base}/match-center?match=${encodeURIComponent(item.id)}`, text: 'Open Match Centre', primary: true });
      if (can(club.id, 'matches')) links.push({ href: openItemHref(`${base}/matches`, item.id), text: 'Open fixture', primary: !links.length });
    } else if (item.source === 'events') {
      links.push({ href: openItemHref(`${base}/events`, item.id), text: 'Open event', primary: true });
    } else if (item.source === 'tournaments') {
      links.push({ href: `${base}/tournaments/${encodeURIComponent(item.id)}`, text: 'Open tournament', primary: true });
      if (item.eventId && can(club.id, 'events')) links.push({ href: openItemHref(`${base}/events`, item.eventId), text: 'Open event' });
    } else if (can(club.id, 'seasons')) {
      links.push({ href: `${base}/seasons`, text: 'Seasons', primary: true });
    }
    return links;
  };

  // Adding from a day or time slot opens the existing add forms, prefilled; only for people who can add
  const canAddMatch = can(club.id, 'matches', 'edit');
  const canAddEvent = can(club.id, 'events', 'edit');
  const addLinks = (day: Date, time: string | undefined, team: string | undefined): CalendarLink[] => [
    ...(canAddMatch ? [{ href: newItemHref(`${base}/matches`, day, time, team), text: 'Add match' }] : []),
    ...(canAddEvent ? [{ href: newItemHref(`${base}/events`, day, time), text: 'Add event or training' }] : []),
  ];

  return (
    <ClubCalendar
      items={items}
      kindChips={kindChips}
      teams={teams}
      storageKey="itsfootball_admin_calendar"
      itemLinks={itemLinks}
      addLinks={canAddMatch || canAddEvent ? addLinks : undefined}
      head={onAdd => (
        <div className="admin-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>Calendar</h1>
            <p>Matches, training, events and tournaments in one place, past and upcoming.</p>
          </div>
          {onAdd && (
            <button type="button" className="btn btn-primary btn-sm row" onClick={onAdd}>
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          )}
        </div>
      )}
    />
  );
}
