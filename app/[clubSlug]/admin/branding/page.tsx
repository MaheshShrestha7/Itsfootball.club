'use client';

import React, { useState, useEffect, use, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub, validateClubSlug, isClubSlugAvailable } from '@/lib/club-context';
import ImageUploadZone from '@/components/ImageUploadZone';
import KitDesignerPreview from '@/components/KitDesignerPreview';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import {
  AlertTriangle,
  Palette,
  CheckCircle2,
  Save,
  Globe,
  Shield,
  MapPin,
  Sparkles,
  AlertCircle,
  Eye,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Shirt,
  Calendar,
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
    stadium_pitch_type: club?.stadium_pitch_type || 'Natural Hybrid Turf',
    stadium_parking_info: club?.stadium_parking_info || '',
    custom_domain: club?.custom_domain || '',
    contact_email: club?.contact_email || '',
    contact_phone: club?.contact_phone || '',
  });

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
        stadium_pitch_type: club.stadium_pitch_type || 'Natural Hybrid Turf',
        stadium_parking_info: club.stadium_parking_info || '',
        custom_domain: club.custom_domain || '',
        contact_email: club.contact_email || '',
        contact_phone: club.contact_phone || '',
      });
    }
  }, [club?.id, club?.updated_at, club?.slug, isHydrated]);

  // Live-sync CSS variables on the root wrapper during editing for immediate visual feedback
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const rootDiv = document.querySelector('[style*="--club-primary"]') as HTMLElement | null;
      if (rootDiv) {
        rootDiv.style.setProperty('--club-primary', formData.primary_color);
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

    updateClubBranding(club.id, {
      ...restData,
      slider_images: sliderImages,
      slug: newSlug,
      custom_domain: formData.custom_domain?.trim() || undefined,
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
      <div style={{ marginBottom: '2rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CLUB CONFIGURATION & BRANDING</span>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#FFFFFF' }}>
          Club Configuration & Visual Interface
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Configure your club identity, establishment year, home ground specs, color tokens, and custom domain. Changes apply live to your public portal and matchday passes.
        </p>
      </div>

      {/* Save feedback: a fixed toast, because the Save button sits at the bottom of this long form
          and an inline banner at the top was scrolled out of view when it appeared */}
      {(savedMessage || saveError) && (
        <div
          role="status"
          aria-live="polite"
          className="admin-save-toast"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            maxWidth: 'min(420px, calc(100vw - 2rem))',
            background: 'var(--bg-surface-elevated, #121a26)',
            border: `1px solid ${saveError ? '#EF4444' : redirectNotice ? '#F59E0B' : '#10B981'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '0.9rem 1.2rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {saveError
            ? <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
            : redirectNotice
            ? <Sparkles size={20} color="#F59E0B" style={{ flexShrink: 0 }} />
            : <CheckCircle2 size={20} color="#10B981" style={{ flexShrink: 0 }} />}
          <div>
            <div style={{ fontWeight: 800, color: saveError ? '#F87171' : redirectNotice ? '#F59E0B' : '#10B981', fontSize: '0.9rem' }}>
              {saveError || redirectNotice || 'Branding saved'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              {saveError
                ? 'Fix the highlighted Club URL field, then save again.'
                : redirectNotice
                ? 'Moving you to the new club address...'
                : 'Your changes are live on the public club site.'}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SECTION 1: DYNAMIC COLORS & WCAG ENGINE */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={20} color={formData.primary_color} /> Dynamic Color Tokens & WCAG 2.2 AA Contrast
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                background: contrastInfo.isWcagAA ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: contrastInfo.isWcagAA ? '#10B981' : '#F59E0B',
                border: `1px solid ${contrastInfo.isWcagAA ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}
            >
              {contrastInfo.isWcagAA ? `WCAG AA PASS (${contrastInfo.ratioFormatted})` : `LARGE TEXT ONLY (${contrastInfo.ratioFormatted})`}
            </span>
          </div>

          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            These colors dynamically theme your public club portal, match scoreboard, virtual member pass cards, and buttons. Text contrast is automatically adjusted to ensure accessible readability.
          </p>

          {/* Quick Football Color Palettes */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Football Palette Presets</label>
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
                    border: formData.primary_color === p.primary ? '2px solid #FFFFFF' : '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    color: '#FFFFFF',
                    transition: 'all 0.15s ease',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            background: 'rgba(0, 0, 0, 0.45)',
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
                <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '1rem' }}>{formData.name}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({formData.short_name})</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Est. {formData.founded_year}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  color: formData.primary_color,
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
              <Shirt size={18} color="var(--club-primary)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
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
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="var(--club-primary)" /> Club Identity & Media Assets
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
              <label htmlFor="branding-club-establishment-year" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={15} color="var(--club-primary)" />
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
                  <Link2 size={15} color="var(--club-primary)" />
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  padding: '0.7rem 0.85rem',
                  background: 'rgba(255, 255, 255, 0.05)',
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
                    borderColor: slugValidation.valid ? 'rgba(16, 185, 129, 0.5)' : '#EF4444',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10B981' }}>
                    <CheckCircle2 size={13} />
                    <span>Live Portal Path: <strong>/{slugValidation.cleanSlug}</strong></span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#EF4444' }}>
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
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.8rem',
                  color: '#F59E0B',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  lineHeight: 1.5,
                }}>
                  <Sparkles size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>URL Slug Migration:</strong> When you save, your club URL will change from <code>/{club.slug}</code> to <code>/{slugValidation.cleanSlug}</code>. The admin room and public portal will automatically route to the new URL, and previous links will redirect seamlessly.
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
                <ImageIcon size={15} color="var(--club-primary)" />
                <span>Multi-Slide Hero Images (Optional, one image URL per line)</span>
              </label>
              <Link
                href={`/${club.slug}/admin/hero-slider`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                <Sparkles size={13} />
                <span>⭐ Open Hero Slider Pins Manager</span>
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

        {/* SECTION 3: HOME GROUND & VENUE SPECS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} color="var(--club-primary)" /> Home Ground & Matchday Venue
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
                <option value="Natural Grass">Natural Grass</option>
                <option value="Natural Hybrid Turf">Natural Hybrid Turf</option>
                <option value="Hybrid Grass (FIFA Pro Quality)">Hybrid Grass (FIFA Pro Quality)</option>
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

        {/* SECTION 4: SECRETARIAT & OPERATIONS CONTACT DETAILS */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={20} color="var(--club-primary)" /> Secretariat & Public Contact Details
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            These official contact details are published on your public club footer and displayed in inquiry confirmations.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="branding-official-secretariat-email" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={14} color="var(--club-primary)" />
                <span>Official Secretariat Email</span>
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
              <label htmlFor="branding-secretariat-phone-matchday-hotline" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} color="var(--club-primary)" />
                <span>Secretariat Phone / Matchday Hotline</span>
              </label>
              <input id="branding-secretariat-phone-matchday-hotline"
                type="tel"
                name="contact_phone"
                className="form-input"
                placeholder="+1 (555) 019-2831"
                value={formData.contact_phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: CUSTOM DOMAIN & WEB INTEGRATION */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={20} color="var(--club-primary)" /> Custom Domain Linking & DNS Guide
          </h3>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Link your own top-level domain (e.g. <code>yourclub.com</code>) or keep your default <code>itsfootball.club/{club?.slug}</code> subpath.
          </p>

          <div className="form-group">
            <label className="form-label">Custom Domain</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '0.7rem 0.8rem',
                border: '1px solid var(--border-subtle)',
                borderRight: 'none',
                borderTopLeftRadius: '8px',
                borderBottomLeftRadius: '8px',
                color: 'var(--text-muted)',
              }}>
                <Globe size={16} />
              </span>
              <input aria-label="Custom domain"
                type="text"
                name="custom_domain"
                className="form-input"
                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                placeholder="e.g. yourclub.com"
                value={formData.custom_domain}
                onChange={handleChange}
              />
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginTop: '0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}>
              <strong>DNS Setup Instructions:</strong> At your domain registrar (GoDaddy, Namecheap, Cloudflare), create a <code>CNAME</code> record pointing to <code>cname.itsfootball.club</code> with TTL Automatic. Edge SSL certificates will be provisioned automatically.
            </div>
          </div>
        </div>

        {/* SAVE SUBMIT BAR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          <a
            href={`/${slugValidation.valid && formData.slug ? slugValidation.cleanSlug : club?.slug || 'clubs'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>Preview Public Portal</span>
            <ExternalLink size={14} />
          </a>
          <button type="submit" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} />
            <span>Save Branding Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
