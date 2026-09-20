'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier } from '@/lib/supabase/types';
import { DollarSign, Plus, Trash2, Edit2, ExternalLink, X } from 'lucide-react';

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

  const [form, setForm] = useState({
    name: '',
    logo_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80',
    website_url: 'https://example.com',
    tier: 'gold' as SponsorTier,
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

      {/* Sponsors List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {clubSponsors.map(sponsor => (
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <img
                src={sponsor.logo_url}
                alt={sponsor.name}
                style={{ width: '60px', height: '40px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '6px' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#FFFFFF' }}>{sponsor.name}</span>
                  <span className="badge" style={{
                    backgroundColor: sponsor.tier === 'platinum' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: sponsor.tier === 'platinum' ? '#F59E0B' : 'var(--text-secondary)',
                  }}>
                    {sponsor.tier.toUpperCase()}
                  </span>
                </div>
                {sponsor.website_url && (
                  <a
                    href={sponsor.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}
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
        ))}
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
            maxWidth: '520px',
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
