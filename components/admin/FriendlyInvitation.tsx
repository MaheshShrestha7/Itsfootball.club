'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, Check, Clock, Handshake, MapPin, Shield, Users } from 'lucide-react';
import type { Club, ContactInquiry, Match } from '@/lib/supabase/types';
import type { CalendarItem } from '@/lib/admin-calendar';
import {
  FORMAT_LABEL, checkDay, dateLabel, friendlyNote, halfLabel, hostLabel, type DayCheck, type FriendlyDate, type FriendlyDetails,
} from '@/lib/friendlies';
import { formatShortDay } from '@/lib/dates';

export function DayCheckLine({ check }: { check: DayCheck }) {
  const Icon = check.kind === 'free' ? Check : check.kind === 'clash' ? AlertTriangle : CalendarDays;
  return (
    <span className={`fr-check is-${check.kind}`}>
      <Icon size={13} aria-hidden="true" /> {check.text}
    </span>
  );
}

/**
 * A friendly invitation in the Inbox: who it's from, the game they want, and each date they offered
 * checked against the team's calendar, with an Accept button that opens the filled-in fixture form.
 */
export default function FriendlyInvitation({ club, item, details, teamName, teamId, calendar, fixture, canAccept, onAccept }: {
  club: Club;
  item: ContactInquiry;
  details: FriendlyDetails;
  teamName: string;
  teamId: string | null;
  calendar: CalendarItem[];
  /** The fixture already made from it */
  fixture?: Match;
  canAccept: boolean;
  onAccept: (date: FriendlyDate) => void;
}) {
  const note = friendlyNote(item.message);
  const checks = details.dates.map(d => checkDay(calendar, teamId, d.date, teamName));
  // The first free date gets the main button
  const best = checks.findIndex(c => c.kind === 'free');

  return (
    <div className="fr">
      <div className="fr-pills">
        <span className="admin-pill is-ok"><Handshake size={12} aria-hidden="true" /> Friendly invitation</span>
      </div>
      <p className="fr-who">{details.their_club}, {details.their_team}</p>
      <div className="fr-facts">
        <span><Shield size={13} aria-hidden="true" /> For <b>{teamName}</b></span>
        <span><Users size={13} aria-hidden="true" /> {FORMAT_LABEL[details.format]}</span>
        <span><Clock size={13} aria-hidden="true" /> {halfLabel(details.half_minutes, details.format)}</span>
        <span><MapPin size={13} aria-hidden="true" /> {hostLabel(details.host, 'ours')}{details.their_ground ? `: ${details.their_ground}` : ''}</span>
      </div>

      {fixture ? (
        <div className="fr-made">
          <Check size={15} aria-hidden="true" />
          <span>
            Fixture made for {formatShortDay(fixture.match_date)}.{' '}
            <Link href={`/${club.slug}/admin/matches?open=${fixture.id}`}>Open it</Link>
          </span>
        </div>
      ) : (
        <>
          <p className="fr-opts-h">Dates they offered, checked against {teamName}&apos;s calendar</p>
          <ul className="fr-opts">
            {details.dates.map((d, i) => (
              <li key={`${d.date}-${d.time}`} className="fr-opt">
                <span className="fr-when">{dateLabel(d)}</span>
                <DayCheckLine check={checks[i]} />
                {canAccept && (
                  <button type="button" className={`btn btn-sm ${i === best ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onAccept(d)}>
                    Accept<span className="sr-only"> {dateLabel(d)}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {note && <p className="fr-note">{note}</p>}
    </div>
  );
}
