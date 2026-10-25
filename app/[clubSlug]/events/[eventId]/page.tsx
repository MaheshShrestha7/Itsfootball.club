'use client';

import React, { useState, use } from 'react';
import LocalTime from '@/components/LocalTime';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import ContactModal from '@/components/ContactModal';
import { DATE_LOCALE, SITE_TIME_ZONE } from '@/lib/dates';
import EventTickets from '@/components/EventTickets';
import SponsorTrackedLink from '@/components/SponsorTrackedLink';
import SponsorLogo from '@/components/SponsorLogo';
import { sortSponsorsByTier, sponsorLabel } from '@/lib/sponsors';
import { useAuth } from '@/lib/auth-context';
import { downloadEventIcs, directionsUrl } from '@/lib/match-ics';
import KickoffCountdown from '@/components/KickoffCountdown';
import {
  Shield,
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  ExternalLink,
  Award,
  CalendarPlus,
  MessageCircle,
} from 'lucide-react';

// How long an event with no end time is treated as running
const DEFAULT_LENGTH = 3 * 3600000;

const CATEGORY_COLOR: Record<string, string> = {
  training: '#10B981',
  social: '#F59E0B',
  agm: '#3B82F6',
  trial: '#EC4899',
  tournament: '#8B5CF6',
  match: '#EF4444',
};

export default function EventDetailsPage({
  params,
}: {
  params: Promise<{ clubSlug: string; eventId: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, events, sponsors } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const event = events.find(e => e.id === resolvedParams.eventId && e.club_id === club?.id);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const { hasClubAdminAccess } = useAuth();
  // Read once: whether the event is still ahead decides the countdown and calendar buttons
  const [now] = useState(() => Date.now());

  if (!club) return null;

  if (!event) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Event Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          This event does not exist or may have been removed from the calendar.
        </p>
        <Link href={`/${club.slug}/events`} className="btn btn-primary">
          See all events
        </Link>
      </div>
    );
  }

  // Sponsors scoped to this specific event - separate from the club's general
  // sponsor showcase, which only shows club-wide (non-event) sponsors.
  const eventSponsors = sortSponsorsByTier(sponsors.filter(s => s.event_id === event.id && s.is_active));

  const categoryColor = CATEGORY_COLOR[event.category] || 'var(--club-primary)';
  const rsvpPct = event.max_capacity > 0 ? Math.min(100, Math.round((event.rsvp_count / event.max_capacity) * 100)) : 0;
  const start = new Date(event.start_time).getTime();
  const end = event.end_time ? new Date(event.end_time).getTime() : start + DEFAULT_LENGTH;
  const upcoming = start > now;
  const over = end < now;
  const place = event.location || club.stadium_name;
  // "0 / 150 checked in" days out reads as nobody coming: the count shows once people arrive (admins always)
  const showCheckins = event.max_capacity > 0 && (event.rsvp_count > 0 || hasClubAdminAccess(club.id));

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="container" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem', maxWidth: '860px' }}>
        <Link
          href={`/${club.slug}/events`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={14} />
          <span>All events</span>
        </Link>

        {/* Event Header */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', borderTop: `4px solid ${categoryColor}` }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '1.75rem' }}>
          {event.flyer_url && (
            <a
              href={event.flyer_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open the ${event.title} flyer full size`}
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(var(--shade-rgb), 0.35)',
                flex: '0 1 340px',
                minWidth: 'min(260px, 100%)',
              }}
            >
              {/* The flyer blurred behind itself, so a portrait poster doesn't sit in empty bars */}
              <div aria-hidden style={{ position: 'absolute', inset: '-20px', backgroundImage: `url(${JSON.stringify(event.flyer_url)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(24px)', opacity: 0.45 }} />
              <img
                src={event.flyer_url}
                alt={`${event.title} flyer`}
                decoding="async"
                style={{ position: 'relative', display: 'block', maxWidth: '100%', maxHeight: 'min(75vh, 560px)', objectFit: 'contain' }}
              />
            </a>
          )}

          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <span className="badge" style={{
            backgroundColor: `${categoryColor}25`,
            color: categoryColor,
            marginBottom: '0.85rem',
          }}>
            {event.category.toUpperCase()}
          </span>

          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            {event.title}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            {event.description}
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}>
            <div className="row row-loose">
              <Calendar size={18} color={categoryColor} />
              <div>
                <div className="text-meta">Date</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  <LocalTime value={event.start_time} options={{ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }} />
                </div>
              </div>
            </div>
            <div className="row row-loose">
              <Clock size={18} color={categoryColor} />
              <div>
                <div className="text-meta">Time</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  <LocalTime value={event.start_time} format="time" options={{ hour: 'numeric', minute: '2-digit' }} />
                </div>
              </div>
            </div>
            <div className="row row-loose">
              <MapPin size={18} color={categoryColor} />
              <div>
                <div className="text-meta">Location</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  {place}
                </div>
              </div>
            </div>
          </div>

          {upcoming && (
            <div className="stack stack-sm" style={{ marginBottom: '1.5rem' }}>
              <div className="prematch-label">Starts in</div>
              <KickoffCountdown kickoff={start} event />
            </div>
          )}

          {showCheckins && (
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Users size={13} /> Checked In
                </span>
                <strong className="text-primary">{event.rsvp_count} / {event.max_capacity} checked in</strong>
              </div>
              <div style={{ height: '6px', background: 'rgba(var(--tint-rgb), 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${rsvpPct}%`, height: '100%', background: categoryColor, borderRadius: '3px' }} />
              </div>
            </div>
          )}

          <div className="matchday-actions">
            {!over && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadEventIcs(club.name, club.slug, event)}>
                <CalendarPlus size={14} aria-hidden="true" /> Add to calendar
              </button>
            )}
            {!over && place && (
              <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <MapPin size={14} aria-hidden="true" /> Directions
              </a>
            )}
            <button type="button" onClick={() => setContactModalOpen(true)} className="btn btn-secondary btn-sm">
              <MessageCircle size={14} aria-hidden="true" /> Ask about this event
            </button>
          </div>
          </div>
          </div>
        </div>

        <EventTickets event={event} onContact={() => setContactModalOpen(true)} />

        {/* Event Sponsors */}
        {eventSponsors.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color={categoryColor} /> Event Sponsors
            </h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
              {eventSponsors.map(sponsor => {
                const isPlatinum = sponsor.tier === 'platinum' || sponsor.size_scale === 'xl';
                const isGold = sponsor.tier === 'gold' || sponsor.size_scale === 'lg';
                return (
                  <SponsorTrackedLink
                    key={sponsor.id}
                    clubId={sponsor.club_id}
                    sponsorId={sponsor.id}
                    placement="event_page"
                    href={sponsor.website_url || '#'}
                    className="glass-panel glass-panel-interactive"
                    style={{
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '0.7rem',
                      width: isPlatinum ? 'min(100%, 320px)' : isGold ? 'min(100%, 270px)' : 'min(100%, 230px)',
                      borderTop: isPlatinum ? '3px solid #F59E0B' : `3px solid ${club.primary_color}`,
                    }}
                  >
                    <SponsorLogo
                      src={sponsor.logo_url}
                      name={sponsor.name}
                      height={isPlatinum ? 96 : isGold ? 76 : 60}
                      style={{ maxWidth: '100%' }}
                    />
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {sponsor.name}
                    </div>
                    <span className="badge" style={{
                      fontSize: '0.7rem',
                      backgroundColor: isPlatinum ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.06)',
                      color: isPlatinum ? 'var(--c-amber)' : 'var(--text-muted)',
                    }}>
                      {sponsorLabel(sponsor)}
                    </span>
                    {sponsor.website_url && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Visit <ExternalLink size={10} />
                      </span>
                    )}
                  </SponsorTrackedLink>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ContactModal
        club={club}
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        defaultType="General Inquiry"
        about={`${event.title}, ${new Date(event.start_time).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: SITE_TIME_ZONE })}`}
      />
    </div>
  );
}
