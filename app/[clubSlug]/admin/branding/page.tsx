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
  Save,
  Shield,
  AlertCircle,
  ExternalLink,
  Mail,
  BookOpen,
} from 'lucide-react';

/** The form's values as the club has them saved: what the page loads, and what Discard puts back.
 *  The home ground isn't here: it's edited in its ground guide (HomeGroundPanel), which fills the club's ground fields. */
function formFromClub(club: Club | undefined) {
  const slides = club?.slider_images || [];
  return {
    name: club?.name || '',
    slug: club?.slug || '',
    short_name: club?.short_name || '',
    motto: club?.motto || '',
    // Empty until the club gives one: never a made-up year
    founded_year: (club?.founded_year || '') as number | '',
    primary_color: club?.primary_color || '#10B981',
    secondary_color: club?.secondary_color || '#0F172A',
    accent_color: club?.accent_color || '#F59E0B',
    logo_url: club?.logo_url || '',
    banner_url: club?.banner_url || '',
    // The home page reads two slide photos by position: the matchday slide, then the home ground slide
    slide_matchday: slides[0] || '',
    slide_ground: slides[1] || '',
    contact_email: club?.contact_email || '',
    contact_phone: club?.contact_phone || '',
  };
}
type BrandingForm = ReturnType<typeof formFromClub>;

/** The page's sections and the fields each one saves, so the save bar can name what changed */
const FORM_SECTIONS: [string, (keyof BrandingForm)[]][] = [
  ['Name, crest and photos', ['name', 'slug', 'short_name', 'founded_year', 'motto', 'logo_url', 'banner_url', 'slide_matchday', 'slide_ground']],
  ['Club colours', ['primary_color', 'secondary_color', 'accent_color']],
  ['Contact details', ['contact_email', 'contact_phone']],
];
/** A field still as saved. Colours compare without case (a preset writes #10B981, the picker #10b981);
 *  everything else exactly, so renaming "Ancc" to "ANCC" still counts as a change */
const sameValue = (key: keyof BrandingForm, a: unknown, b: unknown) => key.endsWith('_color')
  ? String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()
  : String(a ?? '') === String(b ?? '');

const COLOUR_FIELDS = [
  { name: 'primary_color', label: 'Primary colour' },
  { name: 'secondary_color', label: 'Secondary colour' },
  { name: 'accent_color', label: 'Accent colour' },
] as const;

const panelPad = { padding: 'clamp(var(--space-md), 4vw, var(--space-xl))' };
const headingStyle: React.CSSProperties = { fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' };
const hintStyle: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' };

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

  // Whether white or dark text reads on the primary colour (buttons, tags, the scoreboard)
  const contrastInfo = useMemo(() => evaluateColorContrast(formData.primary_color), [formData.primary_color]);

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

  const edit = (patch: Partial<BrandingForm>) => {
    setHasUserEdited(true);
    setSaveError(null);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'founded_year') {
      // Cleared stays cleared (the field is required, so the form asks for it), never a stand-in year
      const parsed = parseInt(value, 10);
      edit({ founded_year: isNaN(parsed) ? '' : parsed });
    } else if (name === 'name' && autoSyncSlug) {
      edit({ name: value, slug: slugify(value) });
    } else {
      edit({ [name]: value } as Partial<BrandingForm>);
    }
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

    // The two slide photos keep their positions (an empty first one falls back to the banner); any
    // further photos saved before this page had slots are kept after them
    const slides = [formData.slide_matchday, formData.slide_ground, ...(club.slider_images || []).slice(2)];
    while (slides.length && !slides[slides.length - 1]) slides.pop();

    const { name, short_name, motto, founded_year, primary_color, secondary_color, accent_color, logo_url, banner_url, contact_email, contact_phone } = formData;
    // Only sent when it changed, so saving the rest of the branding never depends on the story column
    const cleanStory = isArticleEmpty(story) ? '' : story;
    const storyChanged = cleanStory !== (club.about_story || '');

    updateClubBranding(club.id, {
      name, short_name, motto, primary_color, secondary_color, accent_color, logo_url, banner_url, contact_email, contact_phone,
      ...(founded_year ? { founded_year } : {}),
      slider_images: slides,
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
          <p>Your club&apos;s name, crest, colours, story, contact details and home ground, as they show on your public site and member passes.</p>
        </div>
        <div className="admin-head-actions">
          <a href={siteHref} target="_blank" rel="noopener noreferrer" className="btn btn-secondary row">
            <span>View your site</span>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Name, web address, crest and photos */}
        <section className="glass-panel" style={panelPad} aria-labelledby="branding-identity">
          <h2 id="branding-identity" style={{ ...headingStyle, marginBottom: '1.5rem' }}>
            <Shield size={20} aria-hidden="true" /> Name, crest and photos
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div className="form-group">
              <label htmlFor="branding-name" className="form-label">Club name *</label>
              <input id="branding-name" type="text" name="name" required className="form-input" value={formData.name} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label htmlFor="branding-short-name" className="form-label">Short name *</label>
              <input id="branding-short-name" type="text" name="short_name" required maxLength={6} className="form-input"
                aria-describedby="branding-short-name-hint" value={formData.short_name} onChange={handleChange} />
              <div id="branding-short-name-hint" style={hintStyle}>Up to 6 characters, for places the full name doesn&apos;t fit.</div>
            </div>

            <div className="form-group">
              <label htmlFor="branding-founded" className="form-label">Year founded *</label>
              <input id="branding-founded" type="number" name="founded_year" required min={1800} max={new Date().getFullYear() + 1}
                className="form-input" value={formData.founded_year} onChange={handleChange} />
            </div>

            {/* Club web address */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <label htmlFor="branding-slug" className="form-label" style={{ marginBottom: 0 }}>Web address *</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoSyncSlug}
                    onChange={e => {
                      const checked = e.target.checked;
                      setAutoSyncSlug(checked);
                      if (checked) setFormData(prev => ({ ...prev, slug: slugify(prev.name) }));
                    }}
                    style={{ accentColor: 'var(--club-primary)', cursor: 'pointer' }}
                  />
                  <span>Follow the club name</span>
                </label>
              </div>

              <div className="row">
                <span aria-hidden="true" style={{
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
                <input id="branding-slug"
                  type="text"
                  name="slug"
                  required
                  className="form-input"
                  aria-describedby="branding-slug-status"
                  aria-invalid={!slugValidation.valid}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    borderColor: slugValidation.valid ? 'var(--color-field-edge)' : 'var(--color-danger)',
                  }}
                  value={formData.slug}
                  onChange={e => {
                    setAutoSyncSlug(false);
                    edit({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                  }}
                  placeholder="club-slug"
                />
              </div>

              <div id="branding-slug-status" style={{ marginTop: '0.45rem', fontSize: '0.78rem' }}>
                {slugValidation.valid ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--c-green)' }}>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>Your address: <strong>/{slugValidation.cleanSlug}</strong></span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--c-red)' }}>
                    <AlertCircle size={13} aria-hidden="true" />
                    <span>{slugValidation.error}</span>
                  </div>
                )}
              </div>

              {club?.slug !== slugValidation.cleanSlug && slugValidation.valid && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: 'var(--color-warn-wash)',
                  border: '1px solid var(--color-warn-line)',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}>
                  When you save, your address changes from <code>/{club.slug}</code> to <code>/{slugValidation.cleanSlug}</code>. Old links keep working.
                </div>
              )}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="branding-motto" className="form-label">Motto</label>
              <input id="branding-motto" type="text" name="motto" className="form-input" value={formData.motto} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
            <ImageUploadZone
              clubId={club.id}
              label="Crest"
              recommendedText="Square, 500 x 500px, PNG or SVG with a transparent background"
              currentImageUrl={formData.logo_url}
              onUploadComplete={url => edit({ logo_url: url })}
              folder="crests"
              aspectRatio="1:1"
            />
            <ImageUploadZone
              clubId={club.id}
              label="Home page banner"
              recommendedText="Wide, 1920 x 1080px: a photo of your home ground"
              currentImageUrl={formData.banner_url}
              onUploadComplete={url => edit({ banner_url: url })}
              folder="banners"
              aspectRatio="16:9"
            />
          </div>

          {/* The home page slides' own photos, by slide */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Home page slide photos</h3>
              <Link href={`/${club.slug}/admin/hero-slider`} style={{ color: 'var(--club-ink)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                Choose what the slides show
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.5rem' }}>
              <ImageUploadZone
                clubId={club.id}
                label="Matchday slide (optional)"
                recommendedText="Wide, 1920 x 1080px. Without one, the banner is used."
                currentImageUrl={formData.slide_matchday}
                onUploadComplete={url => edit({ slide_matchday: url })}
                folder="banners"
                aspectRatio="16:9"
              />
              <ImageUploadZone
                clubId={club.id}
                label="Home ground slide (optional)"
                recommendedText="Wide, 1920 x 1080px. Without one, a gallery photo is used."
                currentImageUrl={formData.slide_ground}
                onUploadComplete={url => edit({ slide_ground: url })}
                folder="banners"
                aspectRatio="16:9"
              />
            </div>
          </div>
        </section>

        {/* Club colours */}
        <section className="glass-panel" style={panelPad} aria-labelledby="branding-colours">
          <h2 id="branding-colours" style={{ ...headingStyle, marginBottom: '0.5rem' }}>
            <Palette size={20} aria-hidden="true" /> Club colours
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Used across your public site, match scoreboard, member passes and buttons.
          </p>

          <div role="group" aria-labelledby="branding-ready-colours" style={{ marginBottom: 'var(--space-lg)' }}>
            <span id="branding-ready-colours" className="form-label">Ready-made colours</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2xs)' }}>
              {FOOTBALL_COLOR_PALETTES.map(p => (
                <button
                  key={p.name}
                  type="button"
                  className="admin-chip"
                  aria-pressed={[p.primary, p.secondary, p.accent].join().toLowerCase() === [formData.primary_color, formData.secondary_color, formData.accent_color].join().toLowerCase()}
                  onClick={() => edit({ primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent })}
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
            {COLOUR_FIELDS.map(f => (
              <div key={f.name} className="form-group">
                <label htmlFor={`branding-${f.name}`} className="form-label">{f.label}</label>
                <div className="row">
                  <input aria-label={`${f.label} picker`} type="color" name={f.name} value={formData[f.name]} onChange={handleChange}
                    style={{ width: '44px', height: '42px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }} />
                  <input id={`branding-${f.name}`} type="text" name={f.name} className="form-input" value={formData[f.name]} onChange={handleChange} />
                </div>
              </div>
            ))}
          </div>

          {/* Only when it's a problem: a mid-tone where neither white nor dark text reads well */}
          {!contrastInfo.isWcagAA && (
            <p className="admin-notice" role="status" style={{ marginTop: 'var(--space-md)', marginBottom: 0 }}>
              <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-warn)' }} />
              <span>Small text is hard to read on this primary colour: neither white nor dark text stands out enough. A darker or lighter shade works better for buttons.</span>
            </p>
          )}

          <div style={{ marginTop: 'var(--space-lg)' }}>
            <KitDesignerPreview
              shortName={formData.short_name}
              primaryColor={formData.primary_color}
              secondaryColor={formData.secondary_color}
              accentColor={formData.accent_color}
            />
          </div>
        </section>

        {/* Club story (the About page) */}
        <section className="glass-panel" style={panelPad} aria-labelledby="branding-story-heading">
          <h2 id="branding-story-heading" style={{ ...headingStyle, marginBottom: '0.5rem' }}>
            <BookOpen size={20} aria-hidden="true" /> Club story
          </h2>
          <p className="text-note" style={{ marginBottom: '1.25rem' }}>
            Shown on your <Link href={`/${club?.slug || resolvedParams.clubSlug}/about`} style={{ color: 'var(--club-ink)', fontWeight: 600 }}>About page</Link>. Add pictures and YouTube videos from the toolbar.
          </p>
          <div className="form-group">
            <label htmlFor="branding-club-story" className="sr-only">Club story</label>
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
        </section>

        {/* Public contact details */}
        <section className="glass-panel" style={panelPad} aria-labelledby="branding-contact">
          <h2 id="branding-contact" style={{ ...headingStyle, marginBottom: '0.5rem' }}>
            <Mail size={20} aria-hidden="true" /> Contact details
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Shown in your club site&apos;s footer and in replies to people who contact the club.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="branding-email" className="form-label">Email</label>
              <input id="branding-email" type="email" name="contact_email" className="form-input" placeholder="office@footballclub.org"
                value={formData.contact_email} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="branding-phone" className="form-label">Phone</label>
              <input id="branding-phone" type="tel" name="contact_phone" className="form-input" placeholder="e.g. 0400 000 000"
                value={formData.contact_phone} onChange={handleChange} />
            </div>
          </div>
        </section>

        {/* The save bar: sticks to the bottom of the screen while there are unsaved changes, and
            settles at the end of the form when scrolled there */}
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

      {/* These save on their own (their own buttons), so they sit after the form and its save bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '2rem' }}>
        {club && <HomeGroundPanel club={club} />}
        {club && <CustomDomainPanel club={club} />}
      </div>
    </div>
  );
}
