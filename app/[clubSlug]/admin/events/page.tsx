'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { ClubEvent, EventCategory } from '@/lib/supabase/types';
import { getDefaultHeroPinnedItems } from '@/lib/hero-slider-utils';
import QRScannerModal from '@/components/QRScannerModal';
import DoorCheckinQrModal from '@/components/DoorCheckinQrModal';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  QrCode,
  MapPin,
  X,
  Sparkles,
} from 'lucide-react';
import { defaultSeasonLabel } from '@/lib/season';
import { useDoorCheckinUrl } from '@/lib/door-code';

export default function AdminEventsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, events, matches, news, addEvent, deleteEvent, updateEvent, updateClubBranding, seasons, getActiveSeason } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubEvents = events.filter(e => e.club_id === club.id);
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const activeSeason = getActiveSeason ? getActiveSeason(club.id) : null;

  const [scannerEvent, setScannerEvent] = useState<ClubEvent | null>(null);
  const [qrModalEvent, setQrModalEvent] = useState<ClubEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');

  const doorCheckinUrl = useDoorCheckinUrl(qrModalEvent ? `/${club.slug}/events/${qrModalEvent.id}/checkin` : null, qrModalEvent?.id);

  const filteredEvents = clubEvents.filter(e => {
    if (seasonFilter === 'ALL') return true;
    return (e.season || activeSeason?.name) === seasonFilter;
  });

  const handleTogglePinEvent = (evt: ClubEvent) => {
    // Preserve default slides if no custom pins exist yet
    const existing = (club.hero_pinned_items && club.hero_pinned_items.length > 0)
      ? club.hero_pinned_items
      : getDefaultHeroPinnedItems(club, matches, news, events);

    const isPinned = existing.some(p => p.type === 'event' && p.target_id === evt.id);
    let updated;
    if (isPinned) {
      updated = existing.filter(p => !(p.type === 'event' && p.target_id === evt.id));
      setToastMessage(`Unpinned "${evt.title}" from Hero Slider`);
    } else {
      updated = [
        ...existing,
        {
          id: `pin-event-${evt.id}-${Date.now()}`,
          type: 'event' as const,
          target_id: evt.id,
          title: evt.title,
          subtitle: evt.description,
          badge: `PINNED EVENT • ${evt.category.toUpperCase()}`,
          image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
          cta_label: 'RSVP / Event Details',
          cta_link: `/${club.slug}#events`,
          is_active: true,
          order: existing.length + 1,
        }
      ];
      setToastMessage(`✓ Live: Pinned "${evt.title}" to Hero Slider!`);
    }
    updated.forEach((item, idx) => (item.order = idx + 1));
    updateClubBranding(club.id, { hero_pinned_items: updated });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'training' as EventCategory,
    season: activeSeason?.name || defaultSeasonLabel(),
    start_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 16),
    location: club.stadium_name,
    max_capacity: 150,
    is_public: true,
    door_qr_checkin_enabled: true,
  });

  const handleOpenAdd = () => {
    setEditingEventId(null);
    setForm({
      title: '',
      description: '',
      category: 'training',
      season: activeSeason?.name || defaultSeasonLabel(),
      start_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      location: club.stadium_name,
      max_capacity: 150,
      is_public: true,
      door_qr_checkin_enabled: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (evt: ClubEvent) => {
    setEditingEventId(evt.id);
    setForm({
      title: evt.title,
      description: evt.description,
      category: evt.category,
      season: evt.season || activeSeason?.name || defaultSeasonLabel(),
      start_time: new Date(evt.start_time).toISOString().slice(0, 16),
      location: evt.location,
      max_capacity: evt.max_capacity,
      is_public: evt.is_public,
      door_qr_checkin_enabled: evt.door_qr_checkin_enabled ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;

    if (editingEventId) {
      updateEvent(editingEventId, {
        ...form,
        start_time: new Date(form.start_time).toISOString(),
      });
    } else {
      addEvent({
        club_id: club.id,
        title: form.title,
        description: form.description,
        category: form.category,
        season: form.season,
        start_time: new Date(form.start_time).toISOString(),
        location: form.location,
        max_capacity: Number(form.max_capacity),
        rsvp_count: 0,
        is_public: form.is_public,
        door_qr_checkin_enabled: form.door_qr_checkin_enabled,
      });
    }

    setModalOpen(false);
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CLUB OPERATIONS & EVENTS</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Club Events & Trainings Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Schedule fixtures, training sessions, AGM meetings, trials, and operate QR check-in gates.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Season Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setSeasonFilter('ALL')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                border: 'none',
                background: seasonFilter === 'ALL' ? 'var(--club-primary)' : 'transparent',
                color: seasonFilter === 'ALL' ? '#FFFFFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              All Seasons
            </button>
            {clubSeasons.map(s => (
              <button
                key={s.id}
                onClick={() => setSeasonFilter(s.name)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: seasonFilter === s.name ? 'var(--club-primary)' : 'transparent',
                  color: seasonFilter === s.name ? '#FFFFFF' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {s.name} {s.is_current ? '★' : ''}
              </button>
            ))}
          </div>

          <button onClick={handleOpenAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} />
            <span>Add New Event</span>
          </button>
        </div>
      </div>

      {/* Events Table / Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              No events found for season &quot;{seasonFilter}&quot;.
            </p>
          </div>
        ) : (
          filteredEvents.map(evt => (
            <div
              key={evt.id}
              className="glass-panel"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
              }}
            >
              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="badge" style={{
                    backgroundColor: evt.category === 'training' ? 'rgba(16, 185, 129, 0.2)' : evt.category === 'social' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: evt.category === 'training' ? '#10B981' : evt.category === 'social' ? '#F59E0B' : '#3B82F6',
                  }}>
                    {evt.category.toUpperCase()}
                  </span>
                  <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', fontSize: '0.7rem' }}>
                    {evt.season || activeSeason?.name || defaultSeasonLabel()} Season
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Capacity: {evt.rsvp_count} / {evt.max_capacity} RSVPs
                  </span>
                </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                {evt.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                {evt.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} color="var(--club-primary)" />
                  {new Date(evt.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} color="var(--club-primary)" />
                  {evt.location}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {(() => {
                const isPinned = club.hero_pinned_items?.some(p => p.type === 'event' && p.target_id === evt.id);
                return (
                  <button
                    onClick={() => handleTogglePinEvent(evt)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      borderColor: isPinned ? '#10B981' : undefined,
                      color: isPinned ? '#10B981' : 'var(--text-secondary)',
                      background: isPinned ? 'rgba(16, 185, 129, 0.1)' : undefined
                    }}
                    title={isPinned ? 'Pinned to Hero Slider (Click to unpin)' : 'Pin to Hero Slider'}
                  >
                    <Sparkles size={14} color={isPinned ? '#10B981' : 'var(--text-muted)'} />
                    <span>{isPinned ? 'Hero Pinned' : 'Pin to Hero'}</span>
                  </button>
                );
              })()}

              <button
                onClick={() => setQrModalEvent(evt)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  borderColor: evt.door_qr_checkin_enabled ? '#3B82F6' : undefined,
                  color: evt.door_qr_checkin_enabled ? '#3B82F6' : 'var(--text-secondary)',
                }}
                title="Self Check-In QR Code"
              >
                <QrCode size={14} />
                <span>Self Check-In QR</span>
              </button>

              <button
                onClick={() => setScannerEvent(evt)}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <CheckCircle2 size={14} />
                <span>Manual Check-In</span>
              </button>

              <button
                onClick={() => handleOpenEdit(evt)}
                title={`Edit ${evt.title}`}
                aria-label={`Edit ${evt.title}`}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: '40px', minHeight: '40px' }}
              >
                <Edit2 size={14} />
              </button>

              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete event "${evt.title}"? This cannot be undone.`)) {
                    deleteEvent(evt.id);
                  }
                }}
                title={`Delete ${evt.title}`}
                aria-label={`Delete ${evt.title}`}
                className="btn btn-danger btn-sm"
                style={{ minWidth: '40px', minHeight: '40px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )))}
      </div>

      {/* Add / Edit Event Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '560px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                {editingEventId ? 'Edit Club Event' : 'Add New Club Event'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Senior Open Training Session"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Associated Season</label>
                <select
                  className="form-select"
                  value={form.season}
                  onChange={e => setForm({ ...form, season: e.target.value })}
                >
                  {clubSeasons.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} {s.is_current ? '(Current Active Season)' : ''}
                    </option>
                  ))}
                  {!clubSeasons.some(s => s.name === form.season) && (
                    <option value={form.season}>{form.season}</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value as EventCategory })}
                  >
                    <option value="training">Training Session</option>
                    <option value="match">Official Match</option>
                    <option value="social">Social & Gala</option>
                    <option value="trial">Player Trials</option>
                    <option value="agm">Club AGM</option>
                    <option value="tournament">Tournament</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Attendees / Capacity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.max_capacity}
                    onChange={e => setForm({ ...form, max_capacity: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location / Pitch</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description & Instructions</label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.door_qr_checkin_enabled}
                  onChange={e => setForm({ ...form, door_qr_checkin_enabled: e.target.checked })}
                />
                Allow attendees to self check-in via door QR code
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Self Check-In QR Code Modal */}
      {qrModalEvent && (
        <DoorCheckinQrModal
          badgeLabel="SELF CHECK-IN STATION"
          title={qrModalEvent.title}
          subtitle={`${qrModalEvent.location} • ${new Date(qrModalEvent.start_time).toLocaleDateString()} at ${new Date(qrModalEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          checkinUrl={doorCheckinUrl}
          disabledNotice={!qrModalEvent.door_qr_checkin_enabled ? 'Self check-in is turned off for this event. Enable it in Edit Event to let this QR code work.' : undefined}
          onClose={() => setQrModalEvent(null)}
        />
      )}

      {/* QR Scanner Check-in Reticle Modal */}
      {scannerEvent && (
        <QRScannerModal
          isOpen={Boolean(scannerEvent)}
          onClose={() => setScannerEvent(null)}
          targetEvent={scannerEvent}
          mode="event_checkin"
        />
      )}

      {/* Floating Live Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.4rem',
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1.5px solid #10B981',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 24px rgba(16, 185, 129, 0.4)',
          color: '#FFFFFF',
          fontSize: '0.9rem',
          fontWeight: 700,
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <Sparkles size={18} color="#10B981" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
