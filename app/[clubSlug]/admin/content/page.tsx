'use client';

import React, { useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { NewsArticle } from '@/lib/supabase/types';
import { getDefaultHeroPinnedItems } from '@/lib/hero-slider-utils';
import { FileText, Plus, Trash2, Edit2, Play, Image as ImageIcon, X, Sparkles } from 'lucide-react';

export default function AdminContentPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, news, matches, events, addNewsArticle, updateNewsArticle, deleteNewsArticle, updateClubBranding } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubNews = news.filter(n => n.club_id === club.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleTogglePinNews = (article: NewsArticle) => {
    // Preserve default slides if no custom pins exist yet
    const existing = (club.hero_pinned_items && club.hero_pinned_items.length > 0)
      ? club.hero_pinned_items
      : getDefaultHeroPinnedItems(club, matches, news, events);

    const isPinned = existing.some(p => p.type === 'news' && p.target_id === article.id);
    let updated;
    if (isPinned) {
      updated = existing.filter(p => !(p.type === 'news' && p.target_id === article.id));
      setToastMessage(`Unpinned "${article.title}" from Hero Slider`);
    } else {
      updated = [
        ...existing,
        {
          id: `pin-news-${article.id}-${Date.now()}`,
          type: 'news' as const,
          target_id: article.id,
          title: article.title,
          subtitle: article.summary,
          badge: `BREAKING NEWS • ${article.tags[0] || 'FIRST TEAM'}`,
          image_url: article.cover_image_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
          cta_label: 'Read Full Story',
          cta_link: `/${club.slug}#news`,
          is_active: true,
          order: existing.length + 1,
        }
      ];
      setToastMessage(`✓ Live: Pinned "${article.title}" to Hero Slider!`);
    }
    updated.forEach((item, idx) => (item.order = idx + 1));
    updateClubBranding(club.id, { hero_pinned_items: updated });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    content: '',
    cover_image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
    video_embed_url: '',
    author_name: 'Club Media Team',
    tags: 'Match Report, First Team',
    is_featured: false,
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      title: '',
      slug: '',
      summary: '',
      content: '',
      cover_image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&auto=format&fit=crop&q=80',
      video_embed_url: '',
      author_name: 'Club Media Team',
      tags: 'Match Report, First Team',
      is_featured: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (article: NewsArticle) => {
    setEditingId(article.id);
    setForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      cover_image_url: article.cover_image_url,
      video_embed_url: article.video_embed_url || '',
      author_name: article.author_name,
      tags: article.tags.join(', '),
      is_featured: article.is_featured,
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;

    const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tagsArray = form.tags.split(',').map(t => t.trim()).filter(Boolean);

    if (editingId) {
      updateNewsArticle(editingId, {
        ...form,
        slug,
        tags: tagsArray,
      });
    } else {
      addNewsArticle({
        club_id: club.id,
        ...form,
        slug,
        tags: tagsArray,
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
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CONTENT & MEDIA CMS</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Content & Media Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Publish club news, match reports, match highlights, and video embeds.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} />
          <span>Publish Article / Video</span>
        </button>
      </div>

      {/* News Articles List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {clubNews.map(article => (
          <div
            key={article.id}
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
            <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minWidth: '300px' }}>
              <img
                src={article.cover_image_url}
                alt={article.title}
                style={{ width: '120px', height: '80px', borderRadius: '10px', objectFit: 'cover' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  {article.is_featured && <span className="badge badge-gold">FEATURED</span>}
                  {article.video_embed_url && (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#EF4444' }}>
                      <Play size={10} /> VIDEO
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(article.published_at).toLocaleDateString()} • {article.author_name}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.3rem' }}>
                  {article.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {article.summary}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {(() => {
                const isPinned = club.hero_pinned_items?.some(p => p.type === 'news' && p.target_id === article.id);
                return (
                  <button
                    onClick={() => handleTogglePinNews(article)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderColor: isPinned ? '#60A5FA' : undefined,
                      color: isPinned ? '#60A5FA' : 'var(--text-secondary)',
                      background: isPinned ? 'rgba(59, 130, 246, 0.1)' : undefined
                    }}
                    title={isPinned ? 'Pinned to Hero Slider (Click to unpin)' : 'Pin to Hero Slider'}
                  >
                    <Sparkles size={14} color={isPinned ? '#60A5FA' : 'var(--text-muted)'} />
                    <span>{isPinned ? 'Hero Pinned' : 'Pin to Hero'}</span>
                  </button>
                );
              })()}

              <button onClick={() => handleOpenEdit(article)} className="btn btn-secondary btn-sm">
                <Edit2 size={14} />
              </button>
              <button onClick={() => deleteNewsArticle(article.id)} className="btn btn-danger btn-sm">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Article Modal */}
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
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFFFFF' }}>
                {editingId ? 'Edit Article' : 'Publish New Story'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Headline Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Brief Summary / Lead</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.summary}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Article Content *</label>
                <textarea
                  rows={5}
                  required
                  className="form-textarea"
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Cover Image URL</label>
                  <input
                    type="url"
                    className="form-input"
                    value={form.cover_image_url}
                    onChange={e => setForm({ ...form, cover_image_url: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Video Embed URL (YouTube/MP4)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://www.youtube.com/embed/..."
                    value={form.video_embed_url}
                    onChange={e => setForm({ ...form, video_embed_url: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Author Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.author_name}
                    onChange={e => setForm({ ...form, author_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tags (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.tags}
                    onChange={e => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={form.is_featured}
                  onChange={e => setForm({ ...form, is_featured: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--club-primary)' }}
                />
                <label htmlFor="is_featured" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>
                  Pin as Featured Story on Club Home Page
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Story
                </button>
              </div>
            </form>
          </div>
        </div>
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
