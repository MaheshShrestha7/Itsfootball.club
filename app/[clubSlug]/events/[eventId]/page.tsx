'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import ContactModal from '@/components/ContactModal';
import SponsorTrackedLink from '@/components/SponsorTrackedLink';
import { sortSponsorsByTier } from '@/lib/sponsors';
import {
  Shield,
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  ExternalLink,
  Award,
} from 'lucide-react';

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

  if (!club) return null;

  if (!event) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 1.5rem', textAlign: 'center' }}>
        <Shield size={48} style={{ opacity: 0.3, marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', color: '#FFFFFF' }}>Event Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
          This event does not exist or may have been removed from the calendar.
        </p>
        <Link href={`/${club.slug}#events`} className="btn btn-primary">
          Back to Club Calendar
        </Link>
      </div>
    );
  }

  // Sponsors scoped to this specific event - separate from the club's general
  // sponsor showcase, which only shows club-wide (non-event) sponsors.
  const eventSponsors = sortSponsorsByTier(sponsors.filter(s => s.event_id === event.id && s.is_active));

  const categoryColor = CATEGORY_COLOR[event.category] || 'var(--club-primary)';
  const rsvpPct = event.max_capacity > 0 ? Math.min(100, Math.round((event.rsvp_count / event.max_capacity) * 100)) : 0;

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="container" style={{ padding: '2.5rem 1.5rem 4rem 1.5rem', maxWidth: '860px' }}>
        <Link
          href={`/${club.slug}#events`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={14} />
          <span>Back to {club.name} Calendar</span>
        </Link>

        {/* Event Header */}
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', borderTop: `4px solid ${categoryColor}` }}>
          <span className="badge" style={{
            backgroundColor: `${categoryColor}25`,
            color: categoryColor,
            marginBottom: '0.85rem',
          }}>
            {event.category.toUpperCase()}
          </span>

          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.4rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.75rem' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Calendar size={18} color={categoryColor} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Date</div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                  {new Date(event.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Clock size={18} color={categoryColor} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Time</div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                  {new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <MapPin size={18} color={categoryColor} />
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Location</div>
                <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem' }}>
                  {event.location || club.stadium_name}
                </div>
              </div>
            </div>
          </div>

          {event.max_capacity > 0 && (
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Users size={13} /> RSVP Capacity
                </span>
                <strong style={{ color: '#FFFFFF' }}>{event.rsvp_count} / {event.max_capacity} Attending</strong>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${rsvpPct}%`, height: '100%', background: categoryColor, borderRadius: '3px' }} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>RSVP / Inquire for Event</span>
          </button>
        </div>

        {/* Event Sponsors */}
        {eventSponsors.length > 0 && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    <img loading="lazy" decoding="async"
                      src={sponsor.logo_url}
                      alt={`${sponsor.name} logo`}
                      draggable={false}
                      style={{
                        height: isPlatinum ? '96px' : isGold ? '76px' : '60px',
                        maxWidth: '100%',
                        objectFit: 'contain',
                      }}
                    />
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {sponsor.name}
                    </div>
                    <span className="badge" style={{
                      fontSize: '0.6rem',
                      backgroundColor: isPlatinum ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      color: isPlatinum ? '#F59E0B' : 'var(--text-muted)',
                      textTransform: 'capitalize',
                    }}>
                      {sponsor.tier}
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
      />
    </div>
  );
}
