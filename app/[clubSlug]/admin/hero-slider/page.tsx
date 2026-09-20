'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { HeroSliderPinnedItem, HeroPinType, ClubEvent, Match, NewsArticle } from '@/lib/supabase/types';
import { getDefaultHeroPinnedItems } from '@/lib/hero-slider-utils';
import {
  Sparkles,
  Calendar,
  Radio,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  Save,
  RotateCcw,
  Sliders,
  ExternalLink,
  Info,
  Clock,
  MapPin,
  Trophy,
  Tag,
  Link2,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function AdminHeroSliderPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    updateClubBranding,
    events,
    matches,
    news,
    isHydrated
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubEvents = useMemo(() => events.filter(e => e.club_id === club?.id), [events, club?.id]);
  const clubMatches = useMemo(() => matches.filter(m => m.club_id === club?.id), [matches, club?.id]);
  const clubNews = useMemo(() => news.filter(n => n.club_id === club?.id), [news, club?.id]);

  // Local state for pinned items
  const [pinnedItems, setPinnedItems] = useState<HeroSliderPinnedItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pickerTab, setPickerTab] = useState<HeroPinType>('event');

  // Preview active index
  const [previewIndex, setPreviewIndex] = useState(0);

  // Custom Image Banner Form
  const [customImageForm, setCustomImageForm] = useState({
    image_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
    title: 'Official Season Pass 2026/27',
    subtitle: 'Secure guaranteed entry to all home fixtures, VIP member lounge access, and exclusive kit discount.',
    badge: 'MEMBERSHIP SPOTLIGHT',
    cta_label: 'Get Season Pass',
    cta_link: `/${club?.slug || 'apex-city-fc'}#membership`,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Central persistence handler that updates state AND publishes to club context immediately
  const persistPinnedItems = (next: HeroSliderPinnedItem[], msg?: string) => {
    setPinnedItems(next);
    setHasUnsavedChanges(false);
    updateClubBranding(club.id, { hero_pinned_items: next });
    setSavedSuccess(true);
    if (msg) {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3500);
    }
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  // Sync pinnedItems from club once hydrated or loaded
  useEffect(() => {
    if (club && isHydrated && !hasUnsavedChanges) {
      if (club.hero_pinned_items && club.hero_pinned_items.length > 0) {
        setPinnedItems(club.hero_pinned_items);
      } else {
        const defaults = getDefaultHeroPinnedItems(club, matches, news, events);
        setPinnedItems(defaults);
      }
    }
  }, [club?.id, club?.hero_pinned_items, isHydrated, matches, news, events]);

  if (!club) return null;

  // Move up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...pinnedItems];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    next.forEach((item, idx) => (item.order = idx + 1));
    persistPinnedItems(next, `Moved "${next[index - 1].title || 'Slide'}" up`);
  };

  // Move down
  const handleMoveDown = (index: number) => {
    if (index === pinnedItems.length - 1) return;
    const next = [...pinnedItems];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    next.forEach((item, idx) => (item.order = idx + 1));
    persistPinnedItems(next, `Moved "${next[index + 1].title || 'Slide'}" down`);
  };

  // Toggle active
  const handleToggleActive = (index: number) => {
    const next = [...pinnedItems];
    next[index].is_active = !next[index].is_active;
    const status = next[index].is_active ? 'Activated' : 'Disabled';
    persistPinnedItems(next, `${status} slide "${next[index].title || 'Slide'}"`);
  };

  // Remove pin
  const handleRemove = (id: string) => {
    const target = pinnedItems.find(p => p.id === id);
    const next = pinnedItems.filter(p => p.id !== id);
    next.forEach((item, idx) => (item.order = idx + 1));
    if (previewIndex >= next.length) {
      setPreviewIndex(Math.max(0, next.length - 1));
    }
    persistPinnedItems(next, `Unpinned "${target?.title || 'Slide'}" from Hero Slider`);
  };

  // Pin an event
  const handlePinEvent = (evt: ClubEvent) => {
    if (pinnedItems.some(p => p.type === 'event' && p.target_id === evt.id)) {
      handleRemove(pinnedItems.find(p => p.type === 'event' && p.target_id === evt.id)!.id);
      return;
    }
    const newPin: HeroSliderPinnedItem = {
      id: `pin-event-${evt.id}-${Date.now()}`,
      type: 'event',
      target_id: evt.id,
      title: evt.title,
      subtitle: evt.description,
      badge: `PINNED EVENT • ${evt.category.toUpperCase()}`,
      image_url: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1600&auto=format&fit=crop&q=80',
      cta_label: 'RSVP / Event Details',
      cta_link: `/${club.slug}#events`,
      is_active: true,
      order: pinnedItems.length + 1,
    };
    persistPinnedItems([...pinnedItems, newPin], `✓ Live: Pinned event "${evt.title}" to Hero Slider!`);
  };

  // Pin a fixture/match
  const handlePinFixture = (m: Match) => {
    if (pinnedItems.some(p => p.type === 'fixture' && p.target_id === m.id)) {
      handleRemove(pinnedItems.find(p => p.type === 'fixture' && p.target_id === m.id)!.id);
      return;
    }
    const isLive = m.status === 'live';
    const newPin: HeroSliderPinnedItem = {
      id: `pin-fixture-${m.id}-${Date.now()}`,
      type: 'fixture',
      target_id: m.id,
      title: `${m.home_team_name} vs ${m.away_team_name}`,
      subtitle: `${m.competition} • ${m.venue}`,
      badge: isLive ? `MATCHDAY LIVE • ${m.current_minute}'` : `FIXTURE • ${m.competition.toUpperCase()}`,
      image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&auto=format&fit=crop&q=80',
      cta_label: isLive ? 'Enter Match Center Live' : 'Match Preview & Lineups',
      cta_link: `/${club.slug}/match/${m.id}`,
      is_active: true,
      order: pinnedItems.length + 1,
    };
    persistPinnedItems([...pinnedItems, newPin], `✓ Live: Pinned fixture "${m.home_team_name} vs ${m.away_team_name}" to Hero Slider!`);
  };

  // Pin a news article
  const handlePinNews = (article: NewsArticle) => {
    if (pinnedItems.some(p => p.type === 'news' && p.target_id === article.id)) {
      handleRemove(pinnedItems.find(p => p.type === 'news' && p.target_id === article.id)!.id);
      return;
    }
    const newPin: HeroSliderPinnedItem = {
      id: `pin-news-${article.id}-${Date.now()}`,
      type: 'news',
      target_id: article.id,
      title: article.title,
      subtitle: article.summary,
      badge: `BREAKING NEWS • ${article.tags[0] || 'FIRST TEAM'}`,
      image_url: article.cover_image_url || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1600&auto=format&fit=crop&q=80',
      cta_label: 'Read Full Story',
      cta_link: `/${club.slug}#news`,
      is_active: true,
      order: pinnedItems.length + 1,
    };
    persistPinnedItems([...pinnedItems, newPin], `✓ Live: Pinned story "${article.title}" to Hero Slider!`);
  };

  // Add custom image banner
  const handleAddCustomImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customImageForm.image_url || !customImageForm.title) return;
    const newPin: HeroSliderPinnedItem = {
      id: `pin-image-${Date.now()}`,
      type: 'image',
      image_url: customImageForm.image_url,
      title: customImageForm.title,
      subtitle: customImageForm.subtitle,
      badge: customImageForm.badge || 'SPECIAL FEATURE',
      cta_label: customImageForm.cta_label || 'Learn More',
      cta_link: customImageForm.cta_link || `/${club.slug}`,
      is_active: true,
      order: pinnedItems.length + 1,
    };
    persistPinnedItems([...pinnedItems, newPin], `✓ Live: Added custom banner "${newPin.title}"!`);
  };

  // Save changes to ClubContext explicitly
  const handleSave = () => {
    persistPinnedItems(pinnedItems, '✓ All pins successfully published and synced to public portal!');
  };

  // Active items for live preview
  const activePinned = pinnedItems.filter(p => p.is_active);
  const currentPreview = activePinned[previewIndex] || activePinned[0];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '4rem' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={12} />
              <span>HERO SLIDER SPOTLIGHT</span>
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {pinnedItems.length} items pinned ({activePinned.length} active)
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF' }}>
            Hero Slider & Pinned Content Manager
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '650px' }}>
            Pin multiple events, live or upcoming fixtures, news articles, and promotional image banners to rotate on your club's public home page hero carousel.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/${club.slug}`}
            target="_blank"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Eye size={16} />
            <span>Preview Public Portal</span>
            <ExternalLink size={14} />
          </Link>

          <button
            onClick={handleSave}
            className={`btn ${savedSuccess ? 'btn-success' : hasUnsavedChanges ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.4rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {savedSuccess ? <CheckCircle2 size={16} color="#FFFFFF" /> : <Save size={16} />}
            <span>{savedSuccess ? 'Pins Live & Synced' : hasUnsavedChanges ? 'Save & Publish Pins' : 'All Pins Live & Synced'}</span>
          </button>
        </div>
      </div>

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

      {/* Saved Success Notification */}
      {savedSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '2rem',
          color: '#34D399',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <CheckCircle2 size={20} />
          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Hero slider pinned configuration successfully saved! All pinned events, fixtures, news, and banners are now live on your club homepage.
          </div>
        </div>
      )}

      {/* Live Interactive Hero Slider Preview */}
      <div style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2.5rem',
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} color="var(--club-primary)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF' }}>
              Live Carousel Simulator
            </h2>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
              Slide {activePinned.length > 0 ? previewIndex + 1 : 0} of {activePinned.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setPreviewIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, activePinned.length - 1)))}
              className="btn btn-secondary btn-sm"
              disabled={activePinned.length <= 1}
              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPreviewIndex(prev => (prev + 1) % Math.max(1, activePinned.length))}
              className="btn btn-secondary btn-sm"
              disabled={activePinned.length <= 1}
              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Simulator Screen */}
        <div style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: '260px',
          background: '#0a0e17',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '2rem'
        }}>
          {currentPreview ? (
            <>
              {/* Background Image with Dark Gradient Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${currentPreview.image_url || club.banner_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.35,
                filter: 'brightness(0.75)'
              }} />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, #0A0E17 15%, rgba(10,14,23,0.7) 60%, transparent 100%)'
              }} />

              {/* Slide Content */}
              <div style={{ position: 'relative', zIndex: 2, maxWidth: '720px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span className="badge" style={{
                    background: currentPreview.type === 'fixture' ? 'rgba(239, 68, 68, 0.2)' :
                                currentPreview.type === 'event' ? 'rgba(16, 185, 129, 0.2)' :
                                currentPreview.type === 'news' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: currentPreview.type === 'fixture' ? '#EF4444' :
                           currentPreview.type === 'event' ? '#10B981' :
                           currentPreview.type === 'news' ? '#60A5FA' : '#F59E0B',
                    border: '1px solid currentColor',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em'
                  }}>
                    {currentPreview.badge || currentPreview.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                    PINNED {currentPreview.type.toUpperCase()}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.4rem', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                  {currentPreview.title}
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', marginBottom: '1.25rem', lineHeight: 1.5, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  {currentPreview.subtitle}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="btn btn-primary btn-sm" style={{ pointerEvents: 'none', fontWeight: 700 }}>
                    {currentPreview.cta_label || 'Explore Action'}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Links to: {currentPreview.cta_link || `/${club.slug}`}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', position: 'relative', zIndex: 2 }}>
              <Info size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>No active pinned slides.</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select items from the library below to pin them to the carousel.</p>
            </div>
          )}
        </div>

        {/* Simulator Tabs Indicator */}
        {activePinned.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            {activePinned.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setPreviewIndex(idx)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: previewIndex === idx ? 'var(--club-primary)' : 'rgba(255,255,255,0.06)',
                  color: previewIndex === idx ? '#FFFFFF' : 'var(--text-secondary)',
                  border: previewIndex === idx ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                #{idx + 1} {(item.title || 'Slide').length > 25 ? `${(item.title || 'Slide').substring(0, 25)}...` : (item.title || 'Slide')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Left Column = Pinned Items Manager, Right Column = Pin Library & Custom Banner Builder */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Currently Pinned Items (Order & Settings) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Pinned Slides Order</span>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                {pinnedItems.length} Total
              </span>
            </h2>

            <button
              onClick={() => {
                const defaults = getDefaultHeroPinnedItems(club, matches, news, events);
                persistPinnedItems(defaults, '✓ Reset to recommended starter hero slides');
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
            >
              <RotateCcw size={12} />
              <span>Reset Recommendations</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pinnedItems.length === 0 ? (
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                <Info size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  No Items Pinned Yet
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Use the library on the right to pin multiple events, fixtures, news stories, or custom banner images.
                </div>
              </div>
            ) : (
              pinnedItems.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === pinnedItems.length - 1;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: item.is_active ? 'var(--bg-surface)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid',
                      borderColor: item.is_active ? 'var(--border-subtle)' : 'rgba(255,255,255,0.05)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      opacity: item.is_active ? 1 : 0.6,
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#FFFFFF'
                        }}>
                          {index + 1}
                        </span>

                        <span className="badge" style={{
                          background: item.type === 'fixture' ? 'rgba(239, 68, 68, 0.15)' :
                                      item.type === 'event' ? 'rgba(16, 185, 129, 0.15)' :
                                      item.type === 'news' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: item.type === 'fixture' ? '#EF4444' :
                                 item.type === 'event' ? '#10B981' :
                                 item.type === 'news' ? '#60A5FA' : '#F59E0B',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                        }}>
                          {item.type.toUpperCase()}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {item.badge}
                        </span>
                      </div>

                      {/* Reorder and Delete Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleToggleActive(index)}
                          title={item.is_active ? 'Click to deactivate slide' : 'Click to activate slide'}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: item.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)',
                            background: item.is_active ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            color: item.is_active ? '#34D399' : 'var(--text-muted)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {item.is_active ? 'Active' : 'Disabled'}
                        </button>

                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={isFirst}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, opacity: isFirst ? 0.3 : 1 }}
                        >
                          <ArrowUp size={14} />
                        </button>

                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={isLast}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0, opacity: isLast ? 0.3 : 1 }}
                        >
                          <ArrowDown size={14} />
                        </button>

                        <button
                          onClick={() => handleRemove(item.id)}
                          className="btn btn-danger btn-sm"
                          style={{ width: '28px', height: '28px', padding: 0 }}
                          title="Unpin this slide"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF', marginBottom: '0.2rem' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {item.subtitle}
                      </div>
                    </div>

                    {/* Quick Inline Customization: Badge Tag & CTA */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '0.75rem'
                    }}>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                          Tag Badge
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                          value={item.badge || ''}
                          onChange={e => {
                            const next = [...pinnedItems];
                            next[index].badge = e.target.value;
                            setPinnedItems(next);
                            setHasUnsavedChanges(true);
                          }}
                          onBlur={() => {
                            if (hasUnsavedChanges) {
                              persistPinnedItems(pinnedItems, '✓ Live: Slide tag badge updated');
                            }
                          }}
                          placeholder="e.g. SPECIAL EVENT"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                          Button CTA Text
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                          value={item.cta_label || ''}
                          onChange={e => {
                            const next = [...pinnedItems];
                            next[index].cta_label = e.target.value;
                            setPinnedItems(next);
                            setHasUnsavedChanges(true);
                          }}
                          onBlur={() => {
                            if (hasUnsavedChanges) {
                              persistPinnedItems(pinnedItems, '✓ Live: Slide CTA button updated');
                            }
                          }}
                          placeholder="e.g. RSVP Now"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Library of Events, Fixtures, News & Custom Image Builder */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem' }}>
            Pin Content Library
          </h2>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.35rem',
            background: 'var(--bg-surface)',
            padding: '0.35rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem'
          }}>
            {[
              { type: 'event' as const, label: 'Events', icon: Calendar, count: clubEvents.length },
              { type: 'fixture' as const, label: 'Fixtures', icon: Radio, count: clubMatches.length },
              { type: 'news' as const, label: 'News', icon: FileText, count: clubNews.length },
              { type: 'image' as const, label: 'Custom Banner', icon: ImageIcon, count: null },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = pickerTab === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => setPickerTab(tab.type)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: isActive ? 'var(--club-primary)' : 'transparent',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '9999px',
                      background: isActive ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.08)'
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Events Library */}
          {pickerTab === 'event' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clubEvents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No events found for this club.</p>
              ) : (
                clubEvents.map(evt => {
                  const isPinned = pinnedItems.some(p => p.type === 'event' && p.target_id === evt.id);
                  return (
                    <div
                      key={evt.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid',
                        borderColor: isPinned ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                            {evt.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {evt.title}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {evt.location} • {evt.rsvp_count}/{evt.max_capacity} RSVPs
                        </p>
                      </div>

                      <button
                        onClick={() => handlePinEvent(evt)}
                        className={`btn btn-sm ${isPinned ? 'btn-secondary' : 'btn-primary'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          borderColor: isPinned ? '#10B981' : undefined,
                          color: isPinned ? '#10B981' : undefined
                        }}
                      >
                        {isPinned ? <Check size={14} /> : <Plus size={14} />}
                        <span>{isPinned ? 'Pinned' : 'Pin to Hero'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Fixtures Library */}
          {pickerTab === 'fixture' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clubMatches.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No fixtures found for this club.</p>
              ) : (
                clubMatches.map(m => {
                  const isPinned = pinnedItems.some(p => p.type === 'fixture' && p.target_id === m.id);
                  const isLive = m.status === 'live';
                  return (
                    <div
                      key={m.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid',
                        borderColor: isPinned ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span className={`badge ${isLive ? 'badge-live' : 'badge-gold'}`} style={{ fontSize: '0.65rem' }}>
                            {isLive ? `LIVE ${m.current_minute}'` : m.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {m.competition}
                          </span>
                        </div>
                        <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {m.home_team_name} vs {m.away_team_name}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {m.venue} • {new Date(m.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <button
                        onClick={() => handlePinFixture(m)}
                        className={`btn btn-sm ${isPinned ? 'btn-secondary' : 'btn-primary'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          borderColor: isPinned ? '#EF4444' : undefined,
                          color: isPinned ? '#EF4444' : undefined
                        }}
                      >
                        {isPinned ? <Check size={14} /> : <Plus size={14} />}
                        <span>{isPinned ? 'Pinned' : 'Pin to Hero'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: News Library */}
          {pickerTab === 'news' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clubNews.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No news articles found for this club.</p>
              ) : (
                clubNews.map(n => {
                  const isPinned = pinnedItems.some(p => p.type === 'news' && p.target_id === n.id);
                  return (
                    <div
                      key={n.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid',
                        borderColor: isPinned ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', fontSize: '0.65rem' }}>
                            {n.tags[0] || 'DISPATCH'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            By {n.author_name}
                          </span>
                        </div>
                        <h4 style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '0.2rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {n.title}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {n.summary}
                        </p>
                      </div>

                      <button
                        onClick={() => handlePinNews(n)}
                        className={`btn btn-sm ${isPinned ? 'btn-secondary' : 'btn-primary'}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          borderColor: isPinned ? '#60A5FA' : undefined,
                          color: isPinned ? '#60A5FA' : undefined
                        }}
                      >
                        {isPinned ? <Check size={14} /> : <Plus size={14} />}
                        <span>{isPinned ? 'Pinned' : 'Pin to Hero'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 4: Custom Image / Promotional Banner Builder */}
          {pickerTab === 'image' && (
            <form onSubmit={handleAddCustomImage} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem'
            }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Background Image URL *</label>
                <input
                  type="url"
                  required
                  className="form-input"
                  placeholder="https://images.unsplash.com/..."
                  value={customImageForm.image_url}
                  onChange={e => setCustomImageForm({ ...customImageForm, image_url: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Banner Heading / Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. 2026/27 Season Ticket Passes"
                  value={customImageForm.title}
                  onChange={e => setCustomImageForm({ ...customImageForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Subtitle / Caption</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Brief descriptive statement for fans..."
                  value={customImageForm.subtitle}
                  onChange={e => setCustomImageForm({ ...customImageForm, subtitle: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Tag Badge</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. SPECIAL PROMO"
                    value={customImageForm.badge}
                    onChange={e => setCustomImageForm({ ...customImageForm, badge: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>CTA Button Label</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Get Tickets"
                    value={customImageForm.cta_label}
                    onChange={e => setCustomImageForm({ ...customImageForm, cta_label: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>CTA Link Destination</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={`/${club.slug}#membership`}
                  value={customImageForm.cta_link}
                  onChange={e => setCustomImageForm({ ...customImageForm, cta_link: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.5rem' }}
              >
                <Plus size={16} />
                <span>Add Pinned Image Slide</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
