'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarCheck, CalendarDays, Check, Clock, Handshake, Hourglass, MapPin, Shield, Users } from 'lucide-react';
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
  // The date they picked from the club's suggestions gets the main button, else the first free date
  const picked = details.picked;
  const best = picked ? -1 : checks.findIndex(c => c.kind === 'free');
  const first = item.sender_name.trim().split(/\s+/)[0] || item.sender_name;
  const acceptButton = (d: FriendlyDate, primary: boolean) => canAccept && (
    <button type="button" className={`btn btn-sm ${primary ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onAccept(d)}>
      Accept<span className="sr-only"> {dateLabel(d)}</span>
    </button>
  );

  return (
    <div className="fr">
      <div className="fr-pills">
        <span className="admin-pill is-ok"><Handshake size={12} aria-hidden="true" /> Friendly invitation</span>
        {item.visitor_club_id && <span className="admin-pill" title="Sent by one of their club's admins, so the game can go on both clubs' sites">On itsfootball.club</span>}
      </div>
      <div className="fr-head">
        {details.crest || details.crest_url
          ? <img className="fr-crest" src={details.crest || details.crest_url} alt="" width={40} height={40} />
          : <span className="fr-crest is-empty" aria-hidden="true">{details.their_club.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
        <p className="fr-who">{details.their_club}, {details.their_team}</p>
      </div>
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
          {picked ? (
            <div className="fr-picked">
              <CalendarCheck size={15} aria-hidden="true" />
              <span className="fr-picked-txt">
                <span><b>{first} picked {dateLabel(picked)}</b> from the dates you suggested.</span>
                <DayCheckLine check={checkDay(calendar, teamId, picked.date, teamName)} />
              </span>
              {acceptButton(picked, true)}
            </div>
          ) : details.suggested?.length ? (
            <p className="fr-waiting">
              <Hourglass size={14} aria-hidden="true" />
              <span>You suggested {details.suggested.map(dateLabel).join(', or ')}. Waiting for {first} to pick one.</span>
            </p>
          ) : null}
          <p className="fr-opts-h">Dates they offered, checked against {teamName}&apos;s calendar</p>
          <ul className="fr-opts">
            {details.dates.map((d, i) => (
              <li key={`${d.date}-${d.time}`} className="fr-opt">
                <span className="fr-when">{dateLabel(d)}</span>
                <DayCheckLine check={checks[i]} />
                {acceptButton(d, i === best)}
              </li>
            ))}
          </ul>
        </>
      )}

      {note && <p className="fr-note">{note}</p>}
    </div>
  );
}
