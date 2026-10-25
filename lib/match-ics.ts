// "Add to calendar" for one fixture: the same iCalendar text as the club feed, saved as a file
import { buildCalendar } from './calendar';
import { SITE_URL } from './slugs';
import type { ClubEvent, Match } from './supabase/types';

export function downloadMatchIcs(clubName: string, clubSlug: string, match: Match): void {
  saveIcs(buildCalendar({ clubName, baseUrl: `${SITE_URL}/${clubSlug}`, matches: [match], events: [] }), match.slug || match.id);
}

/** The same for a club event (social night, AGM, trial...) */
export function downloadEventIcs(clubName: string, clubSlug: string, event: ClubEvent): void {
  saveIcs(buildCalendar({ clubName, baseUrl: `${SITE_URL}/${clubSlug}`, matches: [], events: [event] }), `event-${event.id.slice(0, 8)}`);
}

function saveIcs(body: string, name: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Google Maps search for a venue (the same link the home ground section uses) */
export const directionsUrl = (place: string) => `https://maps.google.com/?q=${encodeURIComponent(place)}`;
