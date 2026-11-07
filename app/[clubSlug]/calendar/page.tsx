'use client';

import React, { use, useMemo } from 'react';
import { useClub } from '@/lib/club-context';
import { clubTeamsOf } from '@/lib/teams';
import { matchPath } from '@/lib/slugs';
import { CALENDAR_KINDS, publicCalendarItems, type CalendarItem } from '@/lib/admin-calendar';
import ClubCalendar, { type CalendarLink } from '@/components/ClubCalendar';
import ClubSubPage, { ListSkeleton } from '@/components/ClubSubPage';

const KIND_CHIPS = CALENDAR_KINDS.filter(k => k.key !== 'season');

/** /club/calendar: fixtures, events and tournaments on one calendar, as fans may see them */
export default function ClubCalendarPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, tournaments, clubTeams, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id), [clubTeams, club.id]);
  const items = useMemo(
    () => publicCalendarItems({ clubId: club.id, matches, events, tournaments, clubTeams }),
    [club.id, matches, events, tournaments, clubTeams]
  );

  const itemLinks = (item: CalendarItem): CalendarLink[] => {
    if (item.source === 'matches') {
      const match = matches.find(m => m.id === item.id);
      return match ? [{ href: matchPath(club.slug, match), text: 'Match details', primary: true }] : [];
    }
    if (item.source === 'tournaments') {
      return [
        { href: `/${club.slug}/tournaments/${item.id}`, text: 'Tournament details', primary: true },
        ...(item.eventId ? [{ href: `/${club.slug}/events/${item.eventId}`, text: 'Event details' }] : []),
      ];
    }
    return [{ href: `/${club.slug}/events/${item.id}`, text: 'Event details', primary: true }];
  };

  return (
    <ClubSubPage club={club} title="Club calendar" intro={`${club.name}'s fixtures, events and tournaments in one place.`}>
      {!isHydrated ? (
        <ListSkeleton label="Loading the calendar" />
      ) : (
        <ClubCalendar items={items} kindChips={KIND_CHIPS} teams={teams} storageKey="itsfootball_club_calendar" itemLinks={itemLinks} />
      )}
    </ClubSubPage>
  );
}
