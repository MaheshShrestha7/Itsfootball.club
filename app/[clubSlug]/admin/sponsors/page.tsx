'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier, SponsorSizeScale, SponsorPackageStatus } from '@/lib/supabase/types';
import { defaultSeasonLabel } from '@/lib/season';
import ImageUploadZone from '@/components/ImageUploadZone';
import { DollarSign, Plus, Trash2, Edit2, ExternalLink, X, Sparkles, LayoutGrid, Eye, Maximize2, Calendar, Shield, Mail, Phone, User } from 'lucide-react';

const PACKAGE_STATUS_LABEL: Record<SponsorPackageStatus, string> = {
  prospect: 'Prospect (In Talks)',
  confirmed: 'Confirmed',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function getSponsorEffectiveScale(s: Sponsor): 'xl' | 'lg' | 'md' | 'sm' {
  if (s.size_scale && s.size_scale !== 'auto') {
    return s.size_scale;
  }
  switch (s.tier) {
    case 'platinum':
      return 'xl';
    case 'gold':
      return 'lg';
    case 'silver':
      return 'md';
    case 'bronze':
    case 'grassroots':
    default:
      return 'sm';
  }
}

export default function AdminSponsorsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, sponsors, events, addSponsor, updateSponsor, deleteSponsor } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubSponsors = sponsors.filter(s => s.club_id === club.id);
  const clubWideSponsors = clubSponsors.filter(s => !s.event_id);
  const clubEvents = events.filter(e => e.club_id === club.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const blankForm = {
    scope: 'club' as 'club' | 'event',
    event_id: '',
    name: '',
    logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://example.com',
    tier: 'gold' as SponsorTier,
    size_scale: 'auto' as SponsorSizeScale,
    display_order: clubWideSponsors.length + 1,
    is_active: true,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    package_value: '' as number | '',
    package_status: 'confirmed' as SponsorPackageStatus,
    season: defaultSeasonLabel(),
  };

  const [form, setForm] = useState(blankForm);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...blankForm, display_order: clubWideSponsors.length + 1 });
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setForm({
      scope: s.event_id ? 'event' : 'club',
      event_id: s.event_id || '',
      name: s.name,
      logo_url: s.logo_url,
      website_url: s.website_url || '',
      tier: s.tier,
      size_scale: s.size_scale || 'auto',
      display_order: s.display_order,
      is_active: s.is_active,
      contact_name: s.contact_name || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      package_value: s.package_value ?? '',
      package_status: s.package_status || 'confirmed',
      season: s.season || defaultSeasonLabel(),
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.logo_url) return;
    if (form.scope === 'event' && !form.event_id) return;

    const { scope, ...rest } = form;
    const payload = {
      ...rest,
      event_id: scope === 'event' ? form.event_id : undefined,
      package_value: form.package_value === '' ? undefined : Number(form.package_value),
    };

    if (editingId) {
      updateSponsor(editingId, payload);
    } else {
      addSponsor({
        club_id: club.id,
        ...payload,
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
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CLUB SPONSORS & PARTNERS</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Club Sponsors & Commercial Partners
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage commercial kit partners, home ground naming rights, and grassroots sponsors.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} />
          <span>Add New Sponsor</span>
        </button>
      </div>

      {/* Top Banner & Live Preview Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.25rem',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Sparkles size={16} color="#F59E0B" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
            Sponsor Space Scaling Active:
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Platinum sponsors receive premier width &amp; larger logos, cascading down to Gold, Silver, and Grassroots.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowLivePreview(!showLivePreview)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
        >
          <Eye size={13} />
          <span>{showLivePreview ? 'Hide Live Preview' : 'Show Public Preview'}</span>
        </button>
      </div>

      {/* Live Public Scaling Preview (club-wide sponsors only - event sponsors show on their event's page) */}
      {showLivePreview && clubWideSponsors.length > 0 && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LayoutGrid size={14} /> Club Public Page Scaled Layout Preview
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Proportional space as displayed to fans
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'flex-start' }}>
            {clubWideSponsors.map(sponsor => {
              const scale = getSponsorEffectiveScale(sponsor);
              const isXL = scale === 'xl';
              const isLG = scale === 'lg';
              const isMD = scale === 'md';
              return (
                <div
                  key={`prev-${sponsor.id}`}
                  style={{
                    padding: isXL ? '1rem 1.5rem' : isLG ? '0.85rem 1.25rem' : isMD ? '0.7rem 1rem' : '0.5rem 0.8rem',
                    background: isXL
                      ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.15), rgba(30, 41, 59, 0.7))'
                      : isLG
                      ? 'rgba(245, 158, 11, 0.06)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isXL
                      ? '1px solid rgba(245, 158, 11, 0.5)'
                      : isLG
                      ? '1px solid rgba(245, 158, 11, 0.25)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isXL ? '1rem' : isLG ? '0.75rem' : '0.5rem',
                    minWidth: isXL ? '280px' : isLG ? '220px' : isMD ? '170px' : '130px',
                    flex: isXL ? '2 1 280px' : isLG ? '1.5 1 220px' : '1 1 160px',
                    boxShadow: isXL ? '0 6px 24px rgba(245, 158, 11, 0.12)' : 'none',
                  }}
                >
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    style={{
                      height: isXL ? '48px' : isLG ? '36px' : isMD ? '28px' : '22px',
                      maxWidth: isXL ? '130px' : isLG ? '100px' : isMD ? '80px' : '65px',
                      objectFit: 'contain',
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: isXL ? '1rem' : isLG ? '0.88rem' : '0.78rem', color: '#FFFFFF' }}>
                      {sponsor.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                      <span className="badge" style={{
                        fontSize: '0.6rem',
                        backgroundColor: sponsor.tier === 'platinum' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                        color: sponsor.tier === 'platinum' ? '#F59E0B' : 'var(--text-muted)',
                      }}>
                        {sponsor.tier.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: isXL ? '#F59E0B' : 'var(--text-muted)', fontWeight: 600 }}>
                        {scale.toUpperCase()} Space
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sponsors List */}
      {(() => {
        const renderSponsorRow = (sponsor: Sponsor) => {
          const scale = getSponsorEffectiveScale(sponsor);
          const isCustomScale = sponsor.size_scale && sponsor.size_scale !== 'auto';
          const linkedEvent = sponsor.event_id ? clubEvents.find(e => e.id === sponsor.event_id) : undefined;
          return (
            <div
              key={sponsor.id}
              className="glass-panel"
              style={{
                padding: '1.25rem 1.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                borderLeft: scale === 'xl' ? '4px solid #F59E0B' : scale === 'lg' ? '4px solid #EAB308' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  style={{
                    width: scale === 'xl' ? '70px' : '55px',
                    height: scale === 'xl' ? '46px' : '38px',
                    objectFit: 'contain',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FFFFFF' }}>{sponsor.name}</span>
                    <span className="badge" style={{
                      backgroundColor: sponsor.tier === 'platinum' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      color: sponsor.tier === 'platinum' ? '#F59E0B' : 'var(--text-secondary)',
                    }}>
                      {sponsor.tier.toUpperCase()}
                    </span>
                    <span className="badge" style={{
                      backgroundColor: scale === 'xl' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: scale === 'xl' ? '#F59E0B' : 'var(--text-muted)',
                      fontSize: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}>
                      <Maximize2 size={10} />
                      {scale.toUpperCase()} Space Allocation
                      {isCustomScale && ' (Custom)'}
                    </span>
                    {sponsor.package_status && (
                      <span className="badge" style={{
                        backgroundColor: sponsor.package_status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : sponsor.package_status === 'prospect' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: sponsor.package_status === 'paid' ? '#10B981' : sponsor.package_status === 'prospect' ? '#3B82F6' : 'var(--text-muted)',
                        fontSize: '0.65rem',
                      }}>
                        {PACKAGE_STATUS_LABEL[sponsor.package_status]}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem', marginTop: '4px' }}>
                    {sponsor.website_url && (
                      <a
                        href={sponsor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <span>{sponsor.website_url}</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                    {sponsor.package_value != null && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <DollarSign size={11} />
                        {sponsor.package_value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                        {sponsor.season ? ` • ${sponsor.season}` : ''}
                      </span>
                    )}
                    {sponsor.contact_name && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={11} />
                        {sponsor.contact_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {linkedEvent && (
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={11} /> {linkedEvent.title}
                  </span>
                )}
                <button onClick={() => handleOpenEdit(sponsor)} className="btn btn-secondary btn-sm">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteSponsor(sponsor.id)} className="btn btn-danger btn-sm">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        };

        // Group event-scoped sponsors under the event they belong to; sponsors whose
        // event was since deleted still show under a "Former Event" fallback group.
        const eventGroups = clubEvents
          .map(evt => ({ event: evt, list: clubSponsors.filter(s => s.event_id === evt.id) }))
          .filter(g => g.list.length > 0);
        const orphanedEventSponsors = clubSponsors.filter(
          s => s.event_id && !clubEvents.some(e => e.id === s.event_id)
        );

        if (clubSponsors.length === 0) {
          return (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No sponsors yet. Click &ldquo;Add New Sponsor&rdquo; to add your first club or event partner.
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {clubWideSponsors.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Shield size={14} /> Club-Wide Sponsors
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {clubWideSponsors.map(renderSponsorRow)}
                </div>
              </div>
            )}

            {eventGroups.map(({ event, list }) => (
              <div key={event.id}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={14} /> Event Sponsors • {event.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {list.map(renderSponsorRow)}
                </div>
              </div>
            ))}

            {orphanedEventSponsors.length > 0 && (
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                  Former Event Sponsors
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {orphanedEventSponsors.map(renderSponsorRow)}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Add / Edit Sponsor Modal */}
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
            maxWidth: '540px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                {editingId ? 'Edit Sponsor' : 'Add Club Sponsor'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Sponsor Scope</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope: 'club', event_id: '' })}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: form.scope === 'club' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                      border: form.scope === 'club' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                      color: form.scope === 'club' ? '#10B981' : 'var(--text-secondary)',
                    }}
                  >
                    <Shield size={14} /> Club Sponsor
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope: 'event' })}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: form.scope === 'event' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                      border: form.scope === 'event' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                      color: form.scope === 'event' ? '#10B981' : 'var(--text-secondary)',
                    }}
                  >
                    <Calendar size={14} /> Event Sponsor
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {form.scope === 'club'
                    ? 'Shown on the club\'s public sponsor showcase.'
                    : 'Shown only on the selected event\'s detail page.'}
                </p>
              </div>

              {form.scope === 'event' && (
                <div className="form-group">
                  <label className="form-label">Event *</label>
                  <select
                    className="form-select"
                    required={form.scope === 'event'}
                    value={form.event_id}
                    onChange={e => setForm({ ...form, event_id: e.target.value })}
                  >
                    <option value="">Select an event…</option>
                    {clubEvents.map(evt => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({new Date(evt.start_time).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {clubEvents.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.35rem' }}>
                      No events yet - add one under Events first.
                    </p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Sponsor / Partner Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Aura Hydration"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Sponsorship Tier</label>
                  <select
                    className="form-select"
                    value={form.tier}
                    onChange={e => setForm({ ...form, tier: e.target.value as SponsorTier })}
                  >
                    <option value="platinum">Platinum (Main Kit Sponsor)</option>
                    <option value="gold">Gold (Training Kit Partner)</option>
                    <option value="silver">Silver (Official Supplier)</option>
                    <option value="bronze">Bronze Partner</option>
                    <option value="grassroots">Grassroots Community Supporter</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.display_order}
                    onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Display Size / Space Scale</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Public Page Footprint</span>
                </label>
                <select
                  className="form-select"
                  value={form.size_scale}
                  onChange={e => setForm({ ...form, size_scale: e.target.value as SponsorSizeScale })}
                >
                  <option value="auto">Auto (By Tier: Platinum=Premier XL, Gold=Large, Silver=Medium, Bronze=Compact)</option>
                  <option value="xl">Extra Large (Premier Partner Space &amp; Hero Presence)</option>
                  <option value="lg">Large (Substantial Partner Space)</option>
                  <option value="md">Medium (Standard Supplier Space)</option>
                  <option value="sm">Compact (Community Supporter Space)</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Determines how much visual real estate and logo size this sponsor commands on the public club page.
                </p>
              </div>

              <div className="form-group">
                <ImageUploadZone
                  label="Sponsor Logo *"
                  recommendedText="Transparent PNG or square logo, up to 5MB"
                  currentImageUrl={form.logo_url}
                  onUploadComplete={url => setForm({ ...form, logo_url: url })}
                  folder="sponsors"
                  aspectRatio="1:1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Website Link</label>
                <input
                  type="url"
                  className="form-input"
                  value={form.website_url}
                  onChange={e => setForm({ ...form, website_url: e.target.value })}
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={14} color="var(--club-primary)" /> Sponsor Contact
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Internal only - never shown on the public site.
                </p>

                <div className="form-group">
                  <label className="form-label">Contact Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sarah Whitfield"
                    value={form.contact_name}
                    onChange={e => setForm({ ...form, contact_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Mail size={12} /> Contact Email
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="sarah@sponsor.com"
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={12} /> Contact Phone
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1 (555) 000-0000"
                      value={form.contact_phone}
                      onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={14} color="var(--club-primary)" /> Sponsorship Package
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Internal only - never shown on the public site.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Package Value</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={form.package_value}
                      onChange={e => setForm({ ...form, package_value: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Package Status</label>
                    <select
                      className="form-select"
                      value={form.package_status}
                      onChange={e => setForm({ ...form, package_status: e.target.value as SponsorPackageStatus })}
                    >
                      {(Object.keys(PACKAGE_STATUS_LABEL) as SponsorPackageStatus[]).map(status => (
                        <option key={status} value={status}>{PACKAGE_STATUS_LABEL[status]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Season</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={defaultSeasonLabel()}
                    value={form.season}
                    onChange={e => setForm({ ...form, season: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Sponsor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
