'use client';

import React, { useState, useEffect, use, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub, validateClubSlug, isClubSlugAvailable } from '@/lib/club-context';
import CustomDomainPanel from './CustomDomainPanel';
import HomeGroundPanel from './HomeGroundPanel';
import ImageUploadZone from '@/components/ImageUploadZone';
import KitDesignerPreview from '@/components/KitDesignerPreview';
import RichTextEditor from '@/components/RichTextEditor';
import { isArticleEmpty } from '@/lib/article-text';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast, clubInkVars } from '@/lib/theme-utils';
import {
  AlertTriangle,
  Palette,
  CheckCircle2,
  Save,
  Shield,
  MapPin,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Eye,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Shirt,
  Calendar,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react';

export default function AdminBrandingPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, updateClubBranding, isHydrated, saveNow } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const [savedMessage, setSavedMessage] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  // New club URL to move to once it's saved: the server 404s a slug the database doesn't have yet
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [autoSyncSlug, setAutoSyncSlug] = useState(true);
  const [hasUserEdited, setHasUserEdited] = useState(false);

  const [formData, setFormData] = useState({
    name: club?.name || '',
    slug: club?.slug || '',
    short_name: club?.short_name || '',
    motto: club?.motto || '',
    founded_year: club?.founded_year || 2018,
    primary_color: club?.primary_color || '#10B981',
    secondary_color: club?.secondary_color || '#0F172A',
    accent_color: club?.accent_color || '#F59E0B',
    logo_url: club?.logo_url || '',
    banner_url: club?.banner_url || '',
    slider_images_text: club?.slider_images?.join('\n') || '',
    stadium_name: club?.stadium_name || '',
    stadium_address: club?.stadium_address || '',
    stadium_capacity: club?.stadium_capacity || 5000,
    stadium_pitch_type: club?.stadium_pitch_type || '',
    stadium_parking_info: club?.stadium_parking_info || '',
    contact_email: club?.contact_email || '',
    contact_phone: club?.contact_phone || '',
  });
  // The club story is edited apart from formData: the editor reads its value once on mount, so it
  // is remounted (storyVersion) whenever the saved story is reloaded into the form
  const [story, setStory] = useState(club?.about_story || '');
  const [storyVersion, setStoryVersion] = useState(0);

  // Keep formData synchronized when club resolves or updates from storage
  useEffect(() => {
    if (club && !hasUserEdited) {
      setFormData({
        name: club.name || '',
        slug: club.slug || '',
        short_name: club.short_name || '',
        motto: club.motto || '',
        founded_year: club.founded_year || 2018,
        primary_color: club.primary_color || '#10B981',
        secondary_color: club.secondary_color || '#0F172A',
        accent_color: club.accent_color || '#F59E0B',
        logo_url: club.logo_url || '',
        banner_url: club.banner_url || '',
        slider_images_text: club.slider_images?.join('\n') || '',
        stadium_name: club.stadium_name || '',
        stadium_address: club.stadium_address || '',
        stadium_capacity: club.stadium_capacity || 5000,
        stadium_pitch_type: club.stadium_pitch_type || '',
        stadium_parking_info: club.stadium_parking_info || '',
        contact_email: club.contact_email || '',
        contact_phone: club.contact_phone || '',
      });
      setStory(club.about_story || '');
      setStoryVersion(v => v + 1);
    }
  }, [club?.id, club?.updated_at, club?.slug, isHydrated]);

  // Live-sync CSS variables on the root wrapper during editing for immediate visual feedback
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const rootDiv = document.querySelector('[style*="--club-primary"]') as HTMLElement | null;
      if (rootDiv) {
        rootDiv.style.setProperty('--club-primary', formData.primary_color);
        // The readable text shades of the colour being tried, so text in it previews correctly too
        Object.entries(clubInkVars(formData.primary_color)).forEach(([k, v]) => rootDiv.style.setProperty(k, v));
        rootDiv.style.setProperty('--club-secondary', formData.secondary_color);
        rootDiv.style.setProperty('--club-accent', formData.accent_color);
      }
    }
  }, [formData.primary_color, formData.secondary_color, formData.accent_color]);

  // WCAG Contrast calculation
  const contrastInfo = useMemo(() => {
    return evaluateColorContrast(formData.primary_color);
  }, [formData.primary_color]);

  // Real-time Slug Validation
  const slugValidation = useMemo(() => {
    return validateClubSlug(formData.slug, clubs, club?.id);
  }, [formData.slug, clubs, club?.id]);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setHasUserEdited(true);
    const { name, value } = e.target;
    if (name === 'founded_year') {
      const parsed = parseInt(value, 10);
      setFormData(prev => ({ ...prev, founded_year: isNaN(parsed) ? 1800 : parsed }));
    } else if (name === 'name' && autoSyncSlug) {
      const generatedSlug = slugify(value);
      setFormData(prev => ({ ...prev, name: value, slug: generatedSlug }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleApplyPalette = (palette: { primary: string; secondary: string; accent: string }) => {
    setHasUserEdited(true);
    setFormData(prev => ({
      ...prev,
      primary_color: palette.primary,
      secondary_color: palette.secondary,
      accent_color: palette.accent,
    }));
  };

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    if (!slugValidation.valid) {
      // Previously this returned silently, so Save looked like it did nothing
      setSavedMessage(false);
      setSaveError(`Not saved: ${slugValidation.error || 'the club URL is invalid.'}`);
      const slugInput = document.querySelector<HTMLInputElement>('input[name="slug"]');
      slugInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      slugInput?.focus({ preventScroll: true });
      savedTimerRef.current = setTimeout(() => setSaveError(null), 5000);
      return;
    }
    setSaveError(null);

    const newSlug = slugValidation.cleanSlug;
    const isSlugChanged = newSlug !== club.slug;
    if (isSlugChanged && !(await isClubSlugAvailable(newSlug, club.id))) {
      setSavedMessage(false);
      setSaveError(`Not saved: the URL /${newSlug} is already taken by another club.`);
      savedTimerRef.current = setTimeout(() => setSaveError(null), 5000);
      return;
    }

    const sliderImages = formData.slider_images_text
      ? formData.slider_images_text.split('\n').map(s => s.trim()).filter(Boolean)
      : undefined;

    const { slider_images_text, ...restData } = formData;
    // Only sent when it changed, so saving the rest of the branding never depends on the story column
    const cleanStory = isArticleEmpty(story) ? '' : story;
    const storyChanged = cleanStory !== (club.about_story || '');

    updateClubBranding(club.id, {
      ...restData,
      slider_images: sliderImages,
      slug: newSlug,
      ...(storyChanged ? { about_story: cleanStory } : {}),
    });

    setHasUserEdited(false);
    setSavedMessage(true);

    if (isSlugChanged) {
      setRedirectNotice(`Club URL updated to /${newSlug}! Saving, then redirecting...`);
      setPendingSlug(newSlug);
    }

    savedTimerRef.current = setTimeout(() => {
      setSavedMessage(false);
      setRedirectNotice(null);
    }, 4000);
  };

  // Once the renamed club is in state (so the save includes it), save and only then move to the new URL
  useEffect(() => {
    if (!pendingSlug || club?.slug !== pendingSlug) return;
    let cancelled = false;
    saveNow().then(() => {
      if (!cancelled) router.replace(`/${pendingSlug}/admin/branding`);
    });
    return () => { cancelled = true; };
  }, [pendingSlug, club?.slug, saveNow, router]);

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Club and branding</h1>
          <p>Your club name, founding year, home ground, colours and web address. Changes show straight away on your public site and member passes.</p>
        </div>
      </div>

      {/* Save feedback: a fixed toast, because the Save button sits at the bottom of this long form
          and an inline banner at the top was scrolled out of view when it appeared */}
      {(savedMessage || saveError) && (
        <div
          role="status"
          aria-live="polite"
          className={saveError ? 'admin-save-toast is-error' : 'admin-save-toast'}
          style={{ alignItems: 'flex-start' }}
        >
          {saveError
            ? <AlertTriangle size={20} aria-hidden="true" />
            : redirectNotice
            ? <ArrowRight size={20} aria-hidden="true" />
            : <CheckCircle2 size={20} aria-hidden="true" />}
          <div>
            <div>
              {saveError || redirectNotice || 'Branding saved'}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {saveError
                ? 'Fix the highlighted Club URL field, then save again.'
                : redirectNotice
                ? 'Moving you to the new club address…'
                : 'Your changes are live on the public club site.'}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SECTION 1: CLUB COLORS & READABILITY */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={20} aria-hidden="true" color={formData.primary_color} /> Club colours
            </h3>
            <span
              title={`Contrast ${contrastInfo.ratioFormatted} (WCAG 2.2 AA needs 4.5:1 for normal text)`}
              className={contrastInfo.isWcagAA ? 'admin-pill is-ok' : 'admin-pill is-warn'}
            >
              {contrastInfo.isWcagAA ? 'Text is easy to read' : 'Small text is hard to read'}
            </span>
          </div>

          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            These colours are used across your public site, match scoreboard, member passes and buttons. Text on top of them switches between light and dark so it stays easy to read.
          </p>

          {/* Quick Football Color Palettes */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Ready-made colour pairs</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {FOOTBALL_COLOR_PALETTES.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPalette(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    border: formData.primary_color === p.primary ? '2px solid var(--color-ink)' : '1px solid var(--border-subtle)',
                    background: 'color-mix(in oklab, var(--color-ink) 4%, transparent)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.primary }} />
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.secondary }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Primary Color</label>
              <div className="row">
                <input aria-label="Primary colour"
                  type="color"
                  name="primary_color"
                  value={formData.primary_color}
                  onChange={handleChange}
                  style={{ width: '44px', height: '42px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                />
                <input aria-label="Primary colour hex code"
                  type="text"
                  name="primary_color"
                  className="form-input"
                  value={formData.primary_color}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Secondary Color</label>
              <div className="row">
                <input aria-label="Secondary colour"
                  type="color"
                  name="secondary_color"
                  value={formData.secondary_color}
                  onChange={handleChange}
                  style={{ width: '44px', height: '42px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                />
                <input aria-label="Secondary colour hex code"
                  type="text"
                  name="secondary_color"
                  className="form-input"
                  value={formData.secondary_color}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Accent / Gold</label>
              <div className="row">
                <input aria-label="Accent colour"
                  type="color"
                  name="accent_color"
                  value={formData.accent_color}
                  onChange={handleChange}
                  style={{ width: '44px', height: '42px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                />
                <input aria-label="Accent colour hex code"
                  type="text"
                  name="accent_color"
                  className="form-input"
                  value={formData.accent_color}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div style={{
            marginTop: '1.75rem',
            background: 'color-mix(in oklab, var(--color-sidebar) 45%, transparent)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: `2px solid ${formData.primary_color}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: formData.primary_color }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>{formData.name}</span>
                <span className="text-note">({formData.short_name})</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: 'color-mix(in oklab, var(--color-ink) 8%, transparent)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Est. {formData.founded_year}
                </span>
              </div>
            </div>

            <div className="row row-loose">
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  backgroundColor: formData.primary_color,
                  color: contrastInfo.bestTextColor,
                  fontWeight: 700,
                  boxShadow: `0 2px 10px ${formData.primary_color}40`,
                }}
              >
                Matchday CTA Button
              </button>
              <span
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  background: `${formData.primary_color}25`,
                  color: 'var(--club-ink)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: `1px solid ${formData.primary_color}50`,
                }}
              >
                BADGE PREVIEW
              </span>
            </div>
          </div>

          {/* Interactive Kit Customizer & Vector Jersey Showcase */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Shirt size={18} color="var(--color-accent-ink)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Live Matchwear & Jersey Kit Customizer
              </h4>
            </div>
            <KitDesignerPreview
              clubName={formData.name}
              shortName={formData.short_name}
              primaryColor={formData.primary_color}
              secondaryColor={formData.secondary_color}
              accentColor={formData.accent_color}
              onColorsChange={handleApplyPalette}
              interactive={true}
            />
          </div>
        </div>

        {/* SECTION 2: IDENTITY & MEDIA ASSETS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} aria-hidden="true" /> Name, crest and photos
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div className="form-group">
              <label htmlFor="branding-official-club-name" className="form-label">Official Club Name *</label>
              <input id="branding-official-club-name"
                type="text"
                name="name"
                required
                className="form-input"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branding-short-acronym-code" className="form-label">Short Acronym / Code *</label>
              <input id="branding-short-acronym-code"
                type="text"
                name="short_name"
                required
                maxLength={6}
                className="form-input"
                value={formData.short_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branding-club-establishment-year" className="form-label row">
                <Calendar size={15} color="var(--color-accent-ink)" />
                <span>Club Establishment Year *</span>
              </label>
              <input id="branding-club-establishment-year"
                type="number"
                name="founded_year"
                required
                min={1800}
                max={new Date().getFullYear() + 1}
                className="form-input"
                value={formData.founded_year}
                onChange={handleChange}
                placeholder="e.g. 2018"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Displayed on the club header (Est. {formData.founded_year}), home ground entry, match badges, and member passes.
              </div>
            </div>

            {/* Club Web Address & URL Slug */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Link2 size={15} color="var(--color-accent-ink)" />
                  <span>Club Web Slug & Live URL *</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoSyncSlug}
                    onChange={e => {
                      const checked = e.target.checked;
                      setAutoSyncSlug(checked);
                      if (checked) {
                        const generated = slugify(formData.name);
                        setFormData(prev => ({ ...prev, slug: generated }));
                      }
                    }}
                    style={{ accentColor: 'var(--club-primary)', cursor: 'pointer' }}
                  />
                  <span>Auto-sync URL with Team Name</span>
                </label>
              </div>

              <div className="row">
                <span style={{
                  padding: '0.7rem 0.85rem',
                  background: 'color-mix(in oklab, var(--color-ink) 5%, transparent)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}>
                  itsfootball.club/
                </span>
                <input aria-label="Club URL slug"
                  type="text"
                  name="slug"
                  required
                  className="form-input"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    borderColor: slugValidation.valid ? 'var(--color-accent-line)' : 'var(--color-danger)',
                  }}
                  value={formData.slug}
                  onChange={e => {
                    setAutoSyncSlug(false);
                    setHasUserEdited(true);
                    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setFormData(prev => ({ ...prev, slug: clean }));
                  }}
                  placeholder="club-slug"
                />
              </div>

              {/* Slug Validation Feedback */}
              <div style={{ marginTop: '0.45rem', fontSize: '0.78rem' }}>
                {slugValidation.valid ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--c-green)' }}>
                    <CheckCircle2 size={13} />
                    <span>Your address: <strong>/{slugValidation.cleanSlug}</strong></span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--c-red)' }}>
                    <AlertCircle size={13} />
                    <span>{slugValidation.error}</span>
                  </div>
                )}
              </div>

              {/* Migration / Redirect Advisory Alert */}
              {club?.slug !== slugValidation.cleanSlug && slugValidation.valid && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--color-warn-wash)',
                  border: '1px solid var(--color-warn-line)',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  lineHeight: 1.5,
                }}>
                  <ArrowRight size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Your address changes:</strong> When you save, your club URL will change from <code>/{club.slug}</code> to <code>/{slugValidation.cleanSlug}</code>. The admin and the public site move to the new address, and old links still work.
                  </div>
                </div>
              )}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="branding-club-motto-slogan" className="form-label">Club Motto / Slogan</label>
              <input id="branding-club-motto-slogan"
                type="text"
                name="motto"
                className="form-input"
                value={formData.motto}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Real Drag-and-Drop & Direct URL Upload Zones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
            <ImageUploadZone
              clubId={club.id}
              label="Official Club Crest / Logo"
              recommendedText="Square 500x500px PNG or SVG (transparent background recommended)"
              currentImageUrl={formData.logo_url}
              onUploadComplete={(url) => {
                setHasUserEdited(true);
                setFormData(prev => ({ ...prev, logo_url: url }));
              }}
              folder="crests"
              aspectRatio="1:1"
            />

            <ImageUploadZone
              clubId={club.id}
              label="Hero Home Ground Banner"
              recommendedText="Wide 1920x1080px (16:9) home ground photography for public hero showcase"
              currentImageUrl={formData.banner_url}
              onUploadComplete={(url) => {
                setHasUserEdited(true);
                setFormData(prev => ({ ...prev, banner_url: url }));
              }}
              folder="banners"
              aspectRatio="16:9"
            />
          </div>

          {/* Multiple Slider Images Configuration */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
                <ImageIcon size={15} color="var(--color-accent-ink)" />
                <span>Multi-Slide Hero Images (Optional, one image URL per line)</span>
              </label>
              <Link
                href={`/${club.slug}/admin/hero-slider`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                <Sparkles size={13} />
                <span>Open Hero Slider Pins Manager</span>
              </Link>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Add additional home ground photography, match celebrations, or banner graphics to cycle through on the public home page slider, or use the pinned content manager to pin fixtures, news, and events.
            </p>
            <textarea aria-label="Hero slider image URLs, one per line"
              name="slider_images_text"
              rows={3}
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
              placeholder="https://images.unsplash.com/...&#10;https://images.unsplash.com/..."
              value={formData.slider_images_text}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* SECTION 2B: CLUB STORY (the About page) */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} aria-hidden="true" /> Club story
          </h3>
          <p className="text-note" style={{ marginBottom: '1.25rem' }}>
            Shown on your <Link href={`/${club?.slug || resolvedParams.clubSlug}/about`} style={{ color: 'var(--club-ink)', fontWeight: 600 }}>About page</Link>: how the club started, what it stands for, its proudest moments. Add pictures and YouTube videos from the toolbar.
          </p>
          <div className="form-group">
            <label htmlFor="branding-club-story" className="form-label">Our Story</label>
            {club && (
              <RichTextEditor
                key={`${club.id}-${storyVersion}`}
                id="branding-club-story"
                value={story}
                onChange={html => {
                  setHasUserEdited(true);
                  setStory(html);
                }}
                clubId={club.id}
                placeholder="Tell visitors how the club began and what it's about…"
              />
            )}
          </div>
        </div>

        {/* SECTION 3: HOME GROUND & VENUE SPECS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} aria-hidden="true" /> Home ground
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="branding-home-ground-name" className="form-label">Home Ground Name</label>
              <input id="branding-home-ground-name"
                type="text"
                name="stadium_name"
                className="form-input"
                value={formData.stadium_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branding-pitch-surface" className="form-label">Pitch Surface</label>
              <select id="branding-pitch-surface"
                name="stadium_pitch_type"
                className="form-select"
                value={formData.stadium_pitch_type}
                onChange={handleChange}
              >
                {/* Left unset, the site doesn't mention a surface at all */}
                <option value="">Not set</option>
                <option value="Natural Grass">Natural Grass</option>
                <option value="Natural Hybrid Turf">Natural Hybrid Turf</option>
                <option value="Hybrid Grass">Hybrid Grass</option>
                <option value="3G / 4G All-Weather Synthetic">3G / 4G All-Weather Synthetic</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="branding-physical-address" className="form-label">Physical Address</label>
              <input id="branding-physical-address"
                type="text"
                name="stadium_address"
                className="form-input"
                value={formData.stadium_address}
                onChange={handleChange}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="branding-matchday-parking-transit-information" className="form-label">Matchday Parking & Transit Information</label>
              <input id="branding-matchday-parking-transit-information"
                type="text"
                name="stadium_parking_info"
                className="form-input"
                value={formData.stadium_parking_info}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3b: PUBLIC GROUND GUIDE (saved on its own, see HomeGroundPanel) */}
        {club && <HomeGroundPanel club={club} />}

        {/* SECTION 4: PUBLIC CONTACT DETAILS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={20} aria-hidden="true" /> Contact details
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Shown in your club site&apos;s footer and in replies to people who contact the club.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="branding-official-secretariat-email" className="form-label row">
                <Mail size={14} color="var(--color-accent-ink)" />
                <span>Club Contact Email</span>
              </label>
              <input id="branding-official-secretariat-email"
                type="email"
                name="contact_email"
                className="form-input"
                placeholder="office@footballclub.org"
                value={formData.contact_email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branding-secretariat-phone-matchday-hotline" className="form-label row">
                <Phone size={14} color="var(--color-accent-ink)" />
                <span>Club Contact Phone</span>
              </label>
              <input id="branding-secretariat-phone-matchday-hotline"
                type="tel"
                name="contact_phone"
                className="form-input"
                placeholder="e.g. 0400 000 000"
                value={formData.contact_phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: CUSTOM DOMAIN (saved on its own, see CustomDomainPanel) */}
        {club && <CustomDomainPanel club={club} />}

        {/* SAVE SUBMIT BAR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          <a
            href={`/${slugValidation.valid && formData.slug ? slugValidation.cleanSlug : club?.slug || 'clubs'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary row"
          >
            <span>Preview Public Portal</span>
            <ExternalLink size={14} />
          </a>
          <button type="submit" className="btn btn-primary btn-lg row">
            <Save size={18} />
            <span>Save changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}
