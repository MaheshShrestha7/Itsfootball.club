'use client';

import React, { useMemo, useState, use } from 'react';
import CoverImage from "@/components/CoverImage";
import { useClub } from '@/lib/club-context';
import { NewsArticle } from '@/lib/supabase/types';
import { getDefaultHeroPinnedItems } from '@/lib/hero-slider-utils';
import RichTextEditor from '@/components/RichTextEditor';
import ImageUploadZone from '@/components/ImageUploadZone';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { isArticleEmpty } from '@/lib/article-text';
import { FileText, Plus, Trash2, Edit2, Play, Image as ImageIcon, X, Sparkles, Link2, Send, Clock, PenLine } from 'lucide-react';
import { useNewsDraftsReady } from '@/lib/use-news-drafts';
import { matchReportSlug, newestFirst, newsPreviewPath, newsState } from '@/lib/news';
import { publicScoreHidden } from '@/lib/teams';
import { newId } from '@/lib/ids';
import { DATE_LOCALE } from '@/lib/dates';

export default function AdminContentPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, news, matches, events, clubTeams, addNewsArticle, updateNewsArticle, deleteNewsArticle, updateClubBranding, draftMatchReport } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const draftsReady = useNewsDraftsReady();

  // Drafts and scheduled posts first (they still need something), then the newest
  const clubNews = useMemo(() => {
    const own = newestFirst(news.filter(n => n.club_id === club.id));
    return [...own.filter(n => newsState(n) !== 'published'), ...own.filter(n => newsState(n) === 'published')];
  }, [news, club.id]);
  // Recent results with no report yet, to start one from what was logged
  const reportable = useMemo(() => {
    const slugs = new Set(clubNews.map(n => n.slug));
    return matches
      .filter(m => m.club_id === club.id && m.status === 'completed' && !m.tournament_id && m.match_type !== 'internal'
        && Date.now() - new Date(m.match_date).getTime() < 21 * 86400000
        && !publicScoreHidden(m, clubTeams) && !slugs.has(matchReportSlug(m)))
      .sort((a, b) => b.match_date.localeCompare(a.match_date))
      .slice(0, 5);
  }, [matches, club.id, clubTeams, clubNews]);
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
      setToastMessage(`✓ Live: Pinned "${article.title}" to Hero Slider!`);
    }
    updated.forEach((item, idx) => (item.order = idx + 1));
    updateClubBranding(club.id, { hero_pinned_items: updated });
    setTimeout(() => setToastMessage(null), 3500);
  };

  type PublishMode = 'publish' | 'draft' | 'schedule';
  const blankForm = {
    title: '',
    slug: '',
    summary: '',
    content: '',
    cover_image_url: '',
    video_embed_url: '',
    author_name: 'Club Media Team',
    tags: 'Match Report, First Team',
    is_featured: false,
    publishMode: 'publish' as PublishMode,
    /** datetime-local value for a scheduled post */
    scheduleAt: '',
  };
  const [form, setForm] = useState(blankForm);

  // <input type="datetime-local"> works in local time, without a zone
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const tomorrowMorning = () => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d.toISOString());
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...blankForm, scheduleAt: tomorrowMorning() });
    setModalOpen(true);
  };

  const handleOpenEdit = (article: NewsArticle) => {
    const state = newsState(article);
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
      publishMode: state === 'draft' ? 'draft' : state === 'scheduled' ? 'schedule' : 'publish',
      scheduleAt: state === 'scheduled' ? toLocalInput(article.published_at) : tomorrowMorning(),
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    if (isArticleEmpty(form.content)) {
      notify('The article is empty', 'Write the story, or add a picture or video, before saving.');
      return;
    }
    let scheduledIso = '';
    if (form.publishMode === 'schedule') {
      const at = new Date(form.scheduleAt);
      if (!form.scheduleAt || Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        notify('Pick a time in the future', 'Scheduled posts go live by themselves at the time you choose.');
        return;
      }
      scheduledIso = at.toISOString();
    }

    const slug = form.slug || form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const tagsArray = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    // The publish choice isn't an article field
    const { publishMode, scheduleAt, ...fields } = form;
    void scheduleAt;
    const editing = editingId ? clubNews.find(n => n.id === editingId) : undefined;
    // Publishing: now, or keep the date of a post that is already live. Drafts and schedules only once the database has the columns.
    const timing = !draftsReady
      ? {}
      : publishMode === 'draft'
        ? { is_draft: true }
        : publishMode === 'schedule'
          ? { is_draft: false, published_at: scheduledIso }
          : { is_draft: false, ...(editing && newsState(editing) === 'published' ? {} : { published_at: new Date().toISOString() }) };

    if (editingId) {
      updateNewsArticle(editingId, { ...fields, slug, tags: tagsArray, ...timing });
    } else {
      addNewsArticle({
        club_id: club.id,
        ...fields,
        slug,
        tags: tagsArray,
        ...timing,
        ...(draftsReady ? { preview_token: newId() } : {}),
      });
    }
    setModalOpen(false);
    setToastMessage(publishMode === 'draft' && draftsReady ? 'Saved as a draft' : publishMode === 'schedule' && draftsReady
      ? `Scheduled for ${new Date(scheduledIso).toLocaleString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
      : 'Published');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const publishNow = (article: NewsArticle) => {
    updateNewsArticle(article.id, { is_draft: false, published_at: new Date().toISOString() });
    setToastMessage(`Published "${article.title}"`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const copyPreview = async (article: NewsArticle) => {
    const url = `${window.location.origin}${newsPreviewPath(club.slug, article)}`;
    if (!article.preview_token) return notify('The preview link isn\u2019t ready yet', 'Reload the page in a moment and try again.');
    try {
      await navigator.clipboard.writeText(url);
      setToastMessage('Preview link copied. Anyone with it can read this post before it goes live.');
    } catch {
      await notify('Copy this preview link', url);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const startReport = (matchId: string) => {
    const report = draftMatchReport(matchId);
    if (!report) return notify('Nothing to write yet', 'Log the goals (or enter the score) for this match first.');
    handleOpenEdit(report);
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
          <h1 className="stat-value">
            Content & Media Management
          </h1>
          <p className="text-body">
            Publish club news, match reports, match highlights, and video embeds. Save a draft or schedule a post for later.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary row">
          <Plus size={16} />
          <span>New Article / Video</span>
        </button>
      </div>

      {/* Recent results without a report: start one from the logged events */}
      {draftsReady && reportable.length > 0 && (
        <section className="glass-panel" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }} aria-labelledby="reports-due">
          <h2 id="reports-due" style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <PenLine size={16} aria-hidden="true" /> Results without a report
          </h2>
          <p className="text-note" style={{ marginBottom: '0.75rem' }}>
            Start a draft from the score, scorers and Player of the Match you logged, then add your own words before publishing.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {reportable.map(m => (
              <div key={m.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {m.home_team_name} {m.home_score}–{m.away_score} {m.away_team_name}
                  <span className="text-meta" style={{ marginLeft: '0.5rem' }}>{new Date(m.match_date).toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => startReport(m.id)}>
                  <PenLine size={14} /> Write report draft
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  {newsState(article) === 'draft' && <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.1)', color: 'var(--text-secondary)' }}>DRAFT</span>}
                  {newsState(article) === 'scheduled' && (
                    <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={10} /> SCHEDULED {new Date(article.published_at).toLocaleString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                  {article.is_featured && <span className="badge badge-gold">FEATURED</span>}
                  {article.video_embed_url && (
                    <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--c-red)' }}>
                      <Play size={10} /> VIDEO
                    </span>
                  )}
                  <span className="text-meta">
                    {newsState(article) === 'published' ? `${new Date(article.published_at).toLocaleDateString(DATE_LOCALE)} • ` : ''}{article.author_name}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  {article.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {article.summary}
                </p>
              </div>
            </div>

            <div className="row row-wrap">
              {newsState(article) !== 'published' && (
                <>
                  <button type="button" onClick={() => copyPreview(article)} className="btn btn-secondary btn-sm" title="Copy a private link to this post">
                    <Link2 size={14} /> <span>Preview link</span>
                  </button>
                  <button type="button" onClick={() => publishNow(article)} className="btn btn-primary btn-sm">
                    <Send size={14} /> <span>Publish now</span>
                  </button>
                </>
              )}
              {newsState(article) === 'published' && (() => {
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
                      color: isPinned ? 'var(--c-sky)' : 'var(--text-secondary)',
                      background: isPinned ? 'rgba(59, 130, 246, 0.1)' : undefined
                    }}
                    title={isPinned ? 'Pinned to Hero Slider (Click to unpin)' : 'Pin to Hero Slider'}
                  >
                    <Sparkles size={14} color={isPinned ? '#60A5FA' : 'var(--text-muted)'} />
                    <span>{isPinned ? 'Hero Pinned' : 'Pin to Hero'}</span>
                  </button>
                );
              })()}

              <button type="button" onClick={() => handleOpenEdit(article)} className="btn btn-secondary btn-sm" aria-label={`Edit ${article.title}`}>
                <Edit2 size={14} />
              </button>
              <button type="button" data-needs-full onClick={async () => {
                if (await confirmAction({ title: `Delete "${article.title}"?`, message: 'The article will be removed from your club site. This cannot be undone.', confirmLabel: 'Delete article', danger: true })) {
                  deleteNewsArticle(article.id);
                }
              }} className="btn btn-danger btn-sm" aria-label={`Delete ${article.title}`}>
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
            maxWidth: '820px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div className="section-head">
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {editingId ? 'Edit Article' : 'New Story'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label htmlFor="content-headline-title" className="form-label">Headline Title *</label>
                <input id="content-headline-title"
                  type="text"
                  required
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="content-brief-summary-lead" className="form-label">Brief Summary / Lead</label>
                <input id="content-brief-summary-lead"
                  type="text"
                  className="form-input"
                  value={form.summary}
                  onChange={e => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="content-full-article-content" className="form-label">Full Article Content *</label>
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
                  <label htmlFor="content-video-link-youtube-or-mp4" className="form-label">Featured Video (YouTube or .mp4)</label>
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
                  <label htmlFor="content-author-name" className="form-label">Author Name</label>
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

              {draftsReady && (
                <fieldset className="form-group" style={{ border: 0, padding: 0 }}>
                  <legend className="form-label" style={{ marginBottom: '0.4rem' }}>When should it go live?</legend>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {([
                      ['publish', editingId && clubNews.find(n => n.id === editingId && newsState(n) === 'published') ? 'Published' : 'Publish now'],
                      ['draft', 'Save as draft'],
                      ['schedule', 'Schedule'],
                    ] as const).map(([mode, label]) => (
                      <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="radio" name="publish-mode" checked={form.publishMode === mode} onChange={() => setForm(f => ({ ...f, publishMode: mode }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                  {form.publishMode === 'schedule' && (
                    <div style={{ marginTop: '0.75rem', maxWidth: '280px' }}>
                      <label htmlFor="content-schedule-at" className="form-label">Goes live at</label>
                      <input id="content-schedule-at" type="datetime-local" className="form-input" value={form.scheduleAt}
                        onChange={e => setForm(f => ({ ...f, scheduleAt: e.target.value }))} />
                    </div>
                  )}
                  <span className="text-note" style={{ display: 'block', marginTop: '0.4rem' }}>
                    {form.publishMode === 'draft' ? 'Only club staff can see a draft. Share its preview link with the committee to check it.'
                      : form.publishMode === 'schedule' ? 'It appears on your site by itself at that time. Until then only staff and the preview link can see it.'
                        : 'It appears on your club site straight away.'}
                  </span>
                </fieldset>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {!draftsReady || form.publishMode === 'publish' ? (editingId && clubNews.find(n => n.id === editingId && newsState(n) === 'published') ? 'Save Changes' : 'Publish Story')
                    : form.publishMode === 'draft' ? 'Save Draft' : 'Schedule Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Live Toast Notification */}
      {toastMessage && (
        <div role="status" className="admin-save-toast" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.4rem',
          background: 'rgba(var(--dk-15-23-42), 0.96)',
          border: '1.5px solid #10B981',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 24px rgba(16, 185, 129, 0.4)',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          fontWeight: 700,
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <Sparkles size={18} color="var(--c-green)" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
