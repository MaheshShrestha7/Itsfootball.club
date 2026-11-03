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
import { confirmAction } from '@/components/ConfirmDialog';
import type { Club } from '@/lib/supabase/types';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast, clubInkVars } from '@/lib/theme-utils';
import {
  AlertTriangle,
  Palette,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Save,
  Shield,
  MapPin,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Shirt,
  Calendar,
  BookOpen,
  Image as ImageIcon
} from 'lucide-react';

/** The form's values as the club has them saved: what the page loads, and what Discard puts back */
function formFromClub(club: Club | undefined) {
  return {
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
  };
}
type BrandingForm = ReturnType<typeof formFromClub>;

/** The page's sections and the fields each one saves, so the save bar can name what changed */
const FORM_SECTIONS: [string, (keyof BrandingForm)[]][] = [
  ['Club colours', ['primary_color', 'secondary_color', 'accent_color']],
  ['Name, crest and photos', ['name', 'slug', 'short_name', 'founded_year', 'motto', 'logo_url', 'banner_url', 'slider_images_text']],
  ['Home ground', ['stadium_name', 'stadium_pitch_type', 'stadium_address', 'stadium_parking_info', 'stadium_capacity']],
  ['Contact details', ['contact_email', 'contact_phone']],
];
/** A field still as saved. Colours compare without case (a preset writes #10B981, the picker #10b981);
 *  everything else exactly, so renaming "Ancc" to "ANCC" still counts as a change */
const sameValue = (key: keyof BrandingForm, a: unknown, b: unknown) => key.endsWith('_color')
  ? String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
  : String(a ?? '') === String(b ?? '');

export default function AdminBrandingPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, updateClubBranding, isHydrated, saveNow, syncStatus } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const [savedMessage, setSavedMessage] = useState(false);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  // New club URL to move to once it's saved: the server 404s a slug the database doesn't have yet
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [autoSyncSlug, setAutoSyncSlug] = useState(true);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState(() => formFromClub(club));
  // The club story is edited apart from formData: the editor reads its value once on mount, so it
  // is remounted (storyVersion) whenever the saved story is reloaded into the form
  const [story, setStory] = useState(club?.about_story || '');
  const [storyVersion, setStoryVersion] = useState(0);

  // Keep formData synchronized when club resolves or updates from storage
  useEffect(() => {
    if (club && !hasUserEdited) {
      setFormData(formFromClub(club));
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
    setSaveError(null);
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
      return;
    }
    setSaveError(null);

    const newSlug = slugValidation.cleanSlug;
    const isSlugChanged = newSlug !== club.slug;
    if (isSlugChanged && !(await isClubSlugAvailable(newSlug, club.id))) {
      setSavedMessage(false);
      setSaveError(`Not saved: the web address /${newSlug} is taken by another club.`);
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
      setRedirectNotice(`Your web address is now /${newSlug}`);
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

  // What differs from the saved club, by section: the save bar shows while anything does
  const savedForm = useMemo(() => formFromClub(club), [club]);
  const storyDirty = hasUserEdited && (isArticleEmpty(story) ? '' : story) !== (club?.about_story || '');
  const changedSections = hasUserEdited
    ? [
        ...FORM_SECTIONS.filter(([, keys]) => keys.some(k => !sameValue(k, formData[k], savedForm[k]))).map(([name]) => name),
        ...(storyDirty ? ['Club story'] : []),
      ]
    : [];
  const isDirty = changedSections.length > 0;

  // Puts every field back as it was last saved
  const discardChanges = () => {
    setFormData(formFromClub(club));
    setStory(club?.about_story || '');
    setStoryVersion(v => v + 1);
    setAutoSyncSlug(true);
    setSaveError(null);
    setHasUserEdited(false);
  };

  // Leaving with unsaved changes asks first: the browser's own check for a reload or a closed tab,
  // and ours for a link inside the app (a client-side move never fires beforeunload)
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const onLinkClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const to = new URL(link.href, window.location.href);
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      confirmAction({
        title: 'Leave without saving?',
        message: `Your changes to ${changedSections.join(', ')} are not saved yet.`,
        confirmLabel: 'Leave',
        cancelLabel: 'Keep editing',
        danger: true,
      }).then(leave => { if (leave) router.push(`${to.pathname}${to.search}${to.hash}`); });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, [isDirty, changedSections.join(), router]); // eslint-disable-line react-hooks/exhaustive-deps

  // The bar's state: a failed save first, then new unsaved changes (an edit right after a save
  // counts at once), then a save in progress or just done
  const savePhase = saveError ? 'error'
    : isDirty ? 'dirty'
    : savedMessage ? (syncStatus.phase === 'saving' || pendingSlug ? 'saving' : 'saved')
    : null;
  const goToSlug = () => {
    const slugInput = document.querySelector<HTMLInputElement>('input[name="slug"]');
    slugInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slugInput?.focus({ preventScroll: true });
  };
  const siteHref = `/${club?.slug || 'clubs'}`;

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Club and branding</h1>
          <p>Your club name, founding year, home ground, colours and web address. Changes show straight away on your public site and member passes.</p>
        </div>
        <div className="admin-head-actions">
          <a href={siteHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary row">
            <span>View your site</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* SECTION 1: CLUB COLORS & READABILITY */}
        <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
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
          <div role="group" aria-labelledby="branding-ready-colours" style={{ marginBottom: 'var(--space-lg)' }}>
            <span id="branding-ready-colours" className="form-label">Ready-made colours</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2xs)' }}>
              {FOOTBALL_COLOR_PALETTES.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className="admin-chip"
                  aria-pressed={[p.primary, p.secondary, p.accent].join().toLowerCase() === [formData.primary_color, formData.secondary_color, formData.accent_color].join().toLowerCase()}
                  onClick={() => handleApplyPalette(p)}
                >
                  <span aria-hidden="true" style={{ display: 'inline-flex', gap: 'var(--space-3xs)' }}>
                    {[p.primary, p.secondary, p.accent].map(c => (
                      <span key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c, boxShadow: 'inset 0 0 0 1px var(--color-rule-strong)' }} />
                    ))}
                  </span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Primary colour</label>
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
              <label className="form-label">Secondary colour</label>
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
              <label className="form-label">Accent colour</label>
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
          {/* How the colours look on the site: a sample of the club's name, a button and a tag */}
          <div aria-label="Preview" role="group" style={{
            marginTop: 'var(--space-lg)',
            background: 'var(--color-paper)',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--color-rule)',
            borderLeft: `4px solid ${formData.primary_color}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{formData.name}</span>
              <span className="text-note">({formData.short_name})</span>
              <span className="admin-pill">Est. {formData.founded_year}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span
                className="btn btn-sm"
                aria-hidden="true"
                style={{ backgroundColor: formData.primary_color, color: contrastInfo.bestTextColor, borderColor: formData.primary_color, cursor: 'default' }}
              >
                Button
              </span>
              <span
                className="admin-pill"
                style={{
                  background: `color-mix(in oklab, ${formData.primary_color} 18%, transparent)`,
                  color: 'var(--club-ink)',
                }}
              >
                Tag
              </span>
            </div>
          </div>

          {/* The kits drawn in the club's colours */}
          <div style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-lg)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-md)', fontWeight: 600, letterSpacing: 0, color: 'var(--text-primary)', margin: '0 0 var(--space-md)' }}>
              <Shirt size={18} aria-hidden="true" style={{ color: 'var(--color-muted)' }} /> Kits
            </h4>
            <KitDesignerPreview
              clubName={formData.name}
              shortName={formData.short_name}
              primaryColor={formData.primary_color}
              secondaryColor={formData.secondary_color}
              accentColor={formData.accent_color}
              interactive={true}
            />
          </div>
        </div>

        {/* SECTION 2: IDENTITY & MEDIA ASSETS */}
        <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} aria-hidden="true" /> Name, crest and photos
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div className="form-group">
              <label htmlFor="branding-official-club-name" className="form-label">Club name *</label>
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
              <label htmlFor="branding-short-acronym-code" className="form-label">Short name *</label>
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
                <span>Year founded *</span>
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
                  <span>Web address *</span>
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
                  <span>Follow the club name</span>
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
                    borderColor: slugValidation.valid ? 'var(--color-field-edge)' : 'var(--color-danger)',
                  }}
                  value={formData.slug}
                  onChange={e => {
                    setAutoSyncSlug(false);
                    setHasUserEdited(true);
                    setSaveError(null);
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
              <label htmlFor="branding-club-motto-slogan" className="form-label">Motto</label>
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
              label="Crest"
              recommendedText="Square, 500 x 500px, PNG or SVG with a transparent background"
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
              label="Home page banner"
              recommendedText="Wide, 1920 x 1080px: a photo of your home ground"
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
                <span>More home page photos (optional, one image link per line)</span>
              </label>
              <Link
                href={`/${club.slug}/admin/hero-slider`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                <Sparkles size={13} />
                <span>Pin news and fixtures</span>
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
              placeholder="https://yourclub.com.au/photos/grand-final.jpg&#10;https://yourclub.com.au/photos/presentation-night.jpg"
              value={formData.slider_images_text}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* SECTION 2B: CLUB STORY (the About page) */}
        <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
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
        <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} aria-hidden="true" /> Home ground
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="branding-home-ground-name" className="form-label">Ground name</label>
              <input id="branding-home-ground-name"
                type="text"
                name="stadium_name"
                className="form-input"
                value={formData.stadium_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branding-pitch-surface" className="form-label">Pitch surface</label>
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
              <label htmlFor="branding-physical-address" className="form-label">Address</label>
              <input id="branding-physical-address"
                type="text"
                name="stadium_address"
                className="form-input"
                value={formData.stadium_address}
                onChange={handleChange}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="branding-matchday-parking-transit-information" className="form-label">Parking and public transport</label>
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
        <div className="glass-panel" style={{ padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' }}>
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
                <span>Email</span>
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
                <span>Phone</span>
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

        {/* The save bar: sticks to the bottom of the screen while there are unsaved changes, and
            settles at the end of the form when scrolled there. The ground guide and the custom
            domain above save on their own, so they never show here. */}
        {savePhase && (
          <div role="region" aria-label="Save changes" className={`admin-savebar is-${savePhase}`}>
            <div className="admin-savebar-text" role="status" aria-live="polite">
              {savePhase === 'error' && <AlertTriangle size={18} aria-hidden="true" className="admin-savebar-icon" />}
              {savePhase === 'saved' && <CheckCircle2 size={18} aria-hidden="true" className="admin-savebar-icon" />}
              {savePhase === 'saving' && <Loader2 size={18} aria-hidden="true" className="admin-savebar-icon spin" />}
              <div style={{ minWidth: 0 }}>
                <div className="admin-savebar-title">
                  {savePhase === 'error' ? saveError
                    : savePhase === 'saving' ? (redirectNotice || 'Saving your changes')
                    : savePhase === 'saved' ? 'Saved'
                    : 'You have unsaved changes'}
                </div>
                <div className="admin-savebar-sub">
                  {savePhase === 'error' ? 'Pick another web address, then save again.'
                    : savePhase === 'saving' ? (redirectNotice ? 'Saving, then moving you to the new address.' : 'Keep this page open for a moment.')
                    : savePhase === 'saved' ? 'Your changes are live on the club site.'
                    : `${changedSections.join(', ')}. Nothing changes on your site until you save.`}
                </div>
              </div>
            </div>
            <div className="admin-savebar-actions">
              {savePhase === 'dirty' && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={discardChanges}>Discard</button>
                  <button type="submit" className="btn btn-primary row"><Save size={16} aria-hidden="true" /><span>Save changes</span></button>
                </>
              )}
              {savePhase === 'error' && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={goToSlug}>Go to web address</button>
                  <button type="submit" className="btn btn-primary row"><Save size={16} aria-hidden="true" /><span>Save changes</span></button>
                </>
              )}
              {savePhase === 'saved' && (
                <a href={siteHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary row">
                  <span>View your site</span><ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
