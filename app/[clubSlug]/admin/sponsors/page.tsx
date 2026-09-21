'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier, SponsorSizeScale } from '@/lib/supabase/types';
import { DollarSign, Plus, Trash2, Edit2, ExternalLink, X, Sparkles, LayoutGrid, Eye, Maximize2 } from 'lucide-react';

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
  const { clubs, selectClubBySlug, sponsors, addSponsor, updateSponsor, deleteSponsor } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubSponsors = sponsors.filter(s => s.club_id === club.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const [form, setForm] = useState({
    name: '',
    logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://example.com',
    tier: 'gold' as SponsorTier,
    size_scale: 'auto' as SponsorSizeScale,
    display_order: clubSponsors.length + 1,
    is_active: true,
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
      website_url: 'https://example.com',
      tier: 'gold',
      size_scale: 'auto',
      display_order: clubSponsors.length + 1,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      logo_url: s.logo_url,
      website_url: s.website_url || '',
      tier: s.tier,
      size_scale: s.size_scale || 'auto',
      display_order: s.display_order,
      is_active: s.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.logo_url) return;

    if (editingId) {
      updateSponsor(editingId, form);
    } else {
      addSponsor({
        club_id: club.id,
        ...form,
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
            Manage commercial kit partners, stadium naming rights, and grassroots sponsors.
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

      {/* Live Public Scaling Preview */}
      {showLivePreview && clubSponsors.length > 0 && (
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
            {clubSponsors.map(sponsor => {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {clubSponsors.map(sponsor => {
          const scale = getSponsorEffectiveScale(sponsor);
          const isCustomScale = sponsor.size_scale && sponsor.size_scale !== 'auto';
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
                  </div>
                  {sponsor.website_url && (
                    <a
                      href={sponsor.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '3px' }}
                    >
                      <span>{sponsor.website_url}</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button onClick={() => handleOpenEdit(sponsor)} className="btn btn-secondary btn-sm">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteSponsor(sponsor.id)} className="btn btn-danger btn-sm">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
                <label className="form-label">Logo Image URL *</label>
                <input
                  type="url"
                  required
                  className="form-input"
                  value={form.logo_url}
                  onChange={e => setForm({ ...form, logo_url: e.target.value })}
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
