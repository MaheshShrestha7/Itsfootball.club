'use client';

import React, { useState, use } from 'react';
import CoverImage from "@/components/CoverImage";
import { useClub } from '@/lib/club-context';
import { NewsArticle } from '@/lib/supabase/types';
import { getDefaultHeroPinnedItems } from '@/lib/hero-slider-utils';
import RichTextEditor from '@/components/RichTextEditor';
import ImageUploadZone from '@/components/ImageUploadZone';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { isArticleEmpty } from '@/lib/article-text';
import { FileText, Plus, Trash2, Edit2, Play, Image as ImageIcon, X, Pin, CheckCircle2 } from 'lucide-react';
import { DATE_LOCALE, formatShortDay } from '@/lib/dates';

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
          badge: article.tags[0] ? `LATEST NEWS • ${article.tags[0]}` : 'LATEST NEWS',
          image_url: article.cover_image_url || '',
          cta_label: 'Read Full Story',
          cta_link: `/${club.slug}#news`,
          is_active: true,
          order: existing.length + 1,
        }
      ];
      setToastMessage(`Pinned "${article.title}" to the home page`);
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
    cover_image_url: '',
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
      cover_image_url: '',
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
    if (isArticleEmpty(form.content)) {
      notify('The article is empty', 'Write the story, or add a picture or video, before publishing.');
      return;
    }

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
      <div className="admin-head">
        <div>
          <h1>News and video</h1>
          <p>Club news, match reports, highlights and video embeds.</p>
        </div>

        <div className="admin-head-actions">
          <button type="button" onClick={handleOpenAdd} className="btn btn-primary row">
            <Plus size={16} aria-hidden="true" />
            <span>Write a story</span>
          </button>
        </div>
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
            <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minWidth: 'min(300px, 100%)' }}>
              <CoverImage
                width={120} height={80}
                src={article.cover_image_url}
                alt={article.title}
                crestUrl={club?.logo_url}
                style={{ width: '120px', height: '80px', borderRadius: '10px' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  {article.is_featured && <span className="admin-pill is-ok">Featured</span>}
                  {article.video_embed_url && (
                    <span className="admin-pill">
                      <Play size={10} aria-hidden="true" /> Video
                    </span>
                  )}
                  <span className="text-meta">
                    {formatShortDay(article.published_at)}, {article.author_name}
                  </span>
                </div>

                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem', overflowWrap: 'anywhere' }}>
                  {article.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {article.summary}
                </p>
              </div>
            </div>

            <div className="row">
              {(() => {
                const isPinned = club.hero_pinned_items?.some(p => p.type === 'news' && p.target_id === article.id);
                return (
                  <button
                    type="button"
                    onClick={() => handleTogglePinNews(article)}
                    className="btn btn-secondary btn-sm"
                    aria-pressed={!!isPinned}
                    title={isPinned ? 'On the home page slider. Select to take it off' : 'Show it in the home page slider'}
                  >
                    <Pin size={14} aria-hidden="true" />
                    <span>{isPinned ? 'On the home page' : 'Pin to the home page'}</span>
                  </button>
                );
              })()}

              <button type="button" onClick={() => handleOpenEdit(article)} className="btn btn-secondary btn-sm" aria-label={`Edit ${article.title}`}>
                <Edit2 size={14} aria-hidden="true" />
              </button>
              <button type="button" data-needs-full onClick={async () => {
                if (await confirmAction({ title: `Delete "${article.title}"?`, message: 'The article will be removed from your club site. This cannot be undone.', confirmLabel: 'Delete article', danger: true })) {
                  deleteNewsArticle(article.id);
                }
              }} className="btn btn-danger btn-sm" aria-label={`Delete ${article.title}`}>
                <Trash2 size={14} aria-hidden="true" />
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
          background: 'var(--color-scrim)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div className="section-head">
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingId ? 'Edit story' : 'Write a story'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="admin-icon-btn" aria-label="Close">
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="content-headline-title" className="form-label">Headline *</label>
                <input id="content-headline-title"
                  type="text"
                  required
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="content-brief-summary-lead" className="form-label">Summary</label>
                <input id="content-brief-summary-lead"
                  type="text"
                  className="form-input"
                  value={form.summary}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="content-full-article-content" className="form-label">Story *</label>
                <RichTextEditor
                  key={editingId || 'new'}
                  id="content-full-article-content"
                  value={form.content}
                  onChange={content => setForm(f => ({ ...f, content }))}
                  clubId={club.id}
                />
                <span className="text-note">Add pictures and YouTube videos anywhere in the story from the toolbar. You can also paste or drop pictures straight in.</span>
              </div>

              <div className="form-row-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <ImageUploadZone
                    label="Cover Image"
                    recommendedText="Shown on the news card and at the top of the article. 16:9 works best."
                    currentImageUrl={form.cover_image_url}
                    onUploadComplete={url => setForm(f => ({ ...f, cover_image_url: url }))}
                    folder="news"
                    clubId={club.id}
                    aspectRatio="16:9"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="content-video-link-youtube-or-mp4" className="form-label">Video (YouTube or .mp4)</label>
                  <input id="content-video-link-youtube-or-mp4"
                    type="text"
                    className="form-input"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={form.video_embed_url}
                    onChange={e => setForm({ ...form, video_embed_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="content-author-name" className="form-label">Author</label>
                  <input id="content-author-name"
                    type="text"
                    className="form-input"
                    value={form.author_name}
                    onChange={e => setForm({ ...form, author_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="content-tags-comma-separated" className="form-label">Tags (comma separated)</label>
                  <input id="content-tags-comma-separated"
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
                <label htmlFor="is_featured" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
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
        <div role="status" className="admin-save-toast">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
