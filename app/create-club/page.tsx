'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { useClub, validateClubSlug, isClubSlugAvailable } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import KitDesignerPreview from '@/components/KitDesignerPreview';
import ImageUploadZone from '@/components/ImageUploadZone';
import { FOOTBALL_COLOR_PALETTES, evaluateColorContrast } from '@/lib/theme-utils';
import {
  Shield,
  Sparkles,
  MapPin,
  Globe,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Shirt,
  Palette,
  Eye,
  Check
} from 'lucide-react';

export default function CreateClubPage() {
  const router = useRouter();
  const { clubs, createClub } = useClub();
  const { user, isAuthenticated, isLoading: authLoading, assignClubRole } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Require sign-in/sign-up before the wizard is usable at all, rather than only
  // catching it at the final "Finish" step after the user has filled everything in.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setAuthModalOpen(true);
    }
  }, [authLoading, isAuthenticated]);

  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    slug: '',
    motto: '',
    founded_year: 2025,
    primary_color: '#059669', // Emerald
    secondary_color: '#090D16', // Obsidian
    accent_color: '#F59E0B', // Gold
    logo_url: '',
    banner_url: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&auto=format&fit=crop&q=80',
    stadium_name: '',
    stadium_address: '',
    stadium_capacity: 7500,
    stadium_pitch_type: 'Hybrid Grass (FIFA Pro Quality)',
    stadium_parking_info: '',
    contact_email: '',
    contact_phone: '',
    custom_domain: '',
  });

  // Real-time slug validation
  const slugValidation = useMemo(() => {
    return validateClubSlug(formData.slug, clubs);
  }, [formData.slug, clubs]);

  // WCAG Contrast calculation for current primary color
  const contrastInfo = useMemo(() => {
    return evaluateColorContrast(formData.primary_color);
  }, [formData.primary_color]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setStepError(null);

    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-generate slug when name changes if user hasn't manually edited slug separately
      if (name === 'name') {
        const generatedSlug = value
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/--+/g, '-');
        updated.slug = generatedSlug;
      }
      return updated;
    });
  };

  const handleApplyPalette = (p: typeof FOOTBALL_COLOR_PALETTES[0]) => {
    setFormData(prev => ({
      ...prev,
      primary_color: p.primary,
      secondary_color: p.secondary,
      accent_color: p.accent,
    }));
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setStepError('Please enter a club name.');
      return false;
    }
    if (!formData.short_name.trim()) {
      setStepError('Please enter a short name or club acronym (e.g. VFC).');
      return false;
    }
    if (!slugValidation.valid) {
      setStepError(slugValidation.error || 'Please enter a valid unique URL slug.');
      return false;
    }
    setStepError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!formData.primary_color || !formData.secondary_color) {
      setStepError('Please configure your club primary and secondary colors.');
      return false;
    }
    setStepError(null);
    return true;
  };

  const validateStep3 = () => {
    if (!formData.stadium_name.trim()) {
      setStepError('Please provide your home ground name.');
      return false;
    }
    setStepError(null);
    return true;
  };

  const handleNext = (currentStep: number) => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    setStep(currentStep + 1);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    // A club belongs to an account; without one it would only exist in this browser
    if (!user) {
      setStepError(authLoading ? 'Checking your sign-in, please try again in a moment.' : 'Please sign in or register to launch your club.');
      if (!authLoading) setAuthModalOpen(true);
      return;
    }
    // The local check only knows the clubs this browser has loaded
    if (!(await isClubSlugAvailable(slugValidation.cleanSlug))) {
      setStepError(`The URL /${slugValidation.cleanSlug} is already taken. Please choose another.`);
      setStep(1);
      return;
    }
    setStepError(null);
    const newClub = createClub({
      ...formData,
      owner_id: user.id,
    });
    assignClubRole(newClub.id, 'owner');
    router.push('/my-clubs');
  };

  // 1. Still resolving the current session: avoid flashing the sign-in checkpoint
  // before we actually know whether the visitor is authenticated.
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PlatformNavbar />
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: '3px solid rgba(16, 185, 129, 0.2)',
            borderTopColor: '#10B981',
            animation: 'spin 0.8s linear infinite',
          }} />
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Unauthenticated: a club belongs to an account, so sign-in/sign-up is required
  // before the wizard is usable at all - not just checked at the final "Finish" step.
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PlatformNavbar />

        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '2.5rem',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid #10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
            }}>
              <Shield size={32} color="#10B981" />
            </div>

            <span className="badge badge-primary" style={{ marginBottom: '0.6rem' }}>
              ACCOUNT REQUIRED
            </span>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
              Sign In to Launch Your Club
            </h1>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
              A club belongs to your account, so we need you signed in first. Create an account or sign in, then you&apos;ll land right back here to configure your club.
            </p>

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Sparkles size={18} />
              <span>Sign Up or Sign In</span>
            </button>
          </div>
        </main>

        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} redirectTo="" />

        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1.5rem', flex: 1, maxWidth: '960px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.6rem' }}>
            <Sparkles size={14} /> CLUB ONBOARDING WIZARD • REAL-WORLD READY
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, marginBottom: '0.5rem', color: '#FFFFFF' }}>
            Launch & Configure Your Football Club
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
            Set up your club identity, drag-and-drop official crest and banner assets, apply WCAG-compliant colors, and link to your custom domain.
          </p>
        </div>

        {/* Mobile Step Counter Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--club-primary)', letterSpacing: '0.05em' }}>
            STEP {step} OF 4
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFFFFF' }}>
            {step === 1 ? 'Identity & Slug' : step === 2 ? 'Branding & Assets' : step === 3 ? 'Home Ground' : 'Domain & Launch'}
          </span>
        </div>

        {/* Multi-step progress bar */}
        <div className="scroll-pill-strip" style={{
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '2rem',
          position: 'relative',
          paddingBottom: '4px',
          flexWrap: 'wrap',
        }}>
          {[
            { num: 1, label: 'Identity & Slug' },
            { num: 2, label: 'Branding & Assets' },
            { num: 3, label: 'Home Ground' },
            { num: 4, label: 'Domain & Launch' },
          ].map(s => (
            <div
              key={s.num}
              className="scroll-pill-item touch-target"
              onClick={() => {
                if (s.num < step || (s.num === 2 && validateStep1()) || (s.num === 3 && validateStep1() && validateStep2())) {
                  setStep(s.num);
                  setStepError(null);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: s.num <= step ? 'pointer' : 'default',
                opacity: step === s.num ? 1 : step > s.num ? 0.85 : 0.4,
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step === s.num ? 'var(--club-primary)' : step > s.num ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
                color: step === s.num ? 'var(--club-primary-contrast, #FFFFFF)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                {step > s.num ? <CheckCircle2 size={16} /> : s.num}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: step === s.num ? '#FFFFFF' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step error banner if validation fails */}
        {stepError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #EF4444',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{stepError}</span>
          </div>
        )}

        {/* Wizard Form Body */}
        <div className="glass-panel" style={{ padding: 'clamp(1.25rem, 4vw, 2.5rem)', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <form onSubmit={handleFinish}>
            {/* STEP 1: IDENTITY */}
            {step === 1 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#FFFFFF' }}>
                  1. Club Identity & Official Registry
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                  Define your official football club name, registered short acronym, and inspiring club motto.
                </p>

                <div className="form-row-2-1">
                  <div className="form-group">
                    <label htmlFor="create-club-full-club-name" className="form-label">Full Club Name *</label>
                    <input id="create-club-full-club-name"
                      type="text"
                      name="name"
                      required
                      className="form-input"
                      placeholder="e.g. Riverside FC"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-club-short-name-code" className="form-label">Short Name / Code *</label>
                    <input id="create-club-short-name-code"
                      type="text"
                      name="short_name"
                      required
                      maxLength={6}
                      className="form-input"
                      placeholder="e.g. VFC"
                      value={formData.short_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-row-2-1">
                  <div className="form-group">
                    <label className="form-label">Public URL Slug *</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.7rem 0.8rem',
                        border: '1px solid var(--border-subtle)',
                        borderRight: 'none',
                        borderTopLeftRadius: '8px',
                        borderBottomLeftRadius: '8px',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                      }}>
                        itsfootball.club/
                      </span>
                      <input
                        type="text"
                        name="slug"
                        required
                        className="form-input"
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        placeholder="riverside-fc"
                        value={formData.slug}
                        onChange={handleChange}
                      />
                    </div>

                    {/* Real-time inline slug feedback */}
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {slugValidation.valid ? (
                        <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                          <CheckCircle2 size={13} />
                          URL is available: itsfootball.club/{slugValidation.cleanSlug}
                        </span>
                      ) : (
                        <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                          <AlertCircle size={13} />
                          {slugValidation.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-club-year-founded" className="form-label">Year Founded</label>
                    <input id="create-club-year-founded"
                      type="number"
                      name="founded_year"
                      className="form-input"
                      value={formData.founded_year}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="create-club-club-motto-slogan" className="form-label">Club Motto / Slogan</label>
                  <input id="create-club-club-motto-slogan"
                    type="text"
                    name="motto"
                    className="form-input"
                    placeholder="e.g. Victory Through Precision"
                    value={formData.motto}
                    onChange={handleChange}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button
                    type="button"
                    onClick={() => handleNext(1)}
                    className="btn btn-primary"
                    disabled={!slugValidation.valid}
                  >
                    <span>Continue to Branding</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: BRANDING & ASSETS */}
            {step === 2 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#FFFFFF' }}>
                  2. Dynamic Visual Branding & Official Kit Design
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Upload official club crest and home ground hero banner, select WCAG-tested team colors, and customize the matchday kit.
                </p>

                {/* Color Preset Quick Pickers */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Palette size={14} color="var(--club-primary)" />
                    <span>Quick Football Palettes</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {FOOTBALL_COLOR_PALETTES.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPalette(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '8px',
                          border: formData.primary_color === p.primary ? '2px solid #FFFFFF' : '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
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

                {/* Side-by-Side: Palette Inputs & Uploads (Left) + Interactive Jersey Swatch Canvas (Right) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                  gap: '2rem',
                  alignItems: 'flex-start',
                  marginBottom: '2rem',
                }}>
                  {/* Left Column: Color Pickers & Media Uploaders */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Primary Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="color"
                            name="primary_color"
                            value={formData.primary_color}
                            onChange={handleChange}
                            style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                          />
                          <input
                            type="text"
                            name="primary_color"
                            className="form-input"
                            value={formData.primary_color}
                            onChange={handleChange}
                            style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Secondary</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="color"
                            name="secondary_color"
                            value={formData.secondary_color}
                            onChange={handleChange}
                            style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                          />
                          <input
                            type="text"
                            name="secondary_color"
                            className="form-input"
                            value={formData.secondary_color}
                            onChange={handleChange}
                            style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Accent / Gold</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            type="color"
                            name="accent_color"
                            value={formData.accent_color}
                            onChange={handleChange}
                            style={{ width: '38px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                          />
                          <input
                            type="text"
                            name="accent_color"
                            className="form-input"
                            value={formData.accent_color}
                            onChange={handleChange}
                            style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* WCAG Contrast Scorecard */}
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: formData.primary_color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Contrast: <strong>{contrastInfo.ratioFormatted}</strong>
                        </span>
                      </div>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          background: contrastInfo.isWcagAA ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: contrastInfo.isWcagAA ? '#10B981' : '#F59E0B',
                        }}
                      >
                        {contrastInfo.isWcagAA ? 'WCAG 2.2 AA PASSED' : 'LARGE TEXT ONLY'}
                      </span>
                    </div>

                    {/* Drag-and-Drop Image Upload Zones */}
                    <ImageUploadZone
                      label="Official Club Crest / Logo"
                      recommendedText="Square 500x500px PNG or SVG (transparent background recommended)"
                      currentImageUrl={formData.logo_url}
                      onUploadComplete={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
                      folder="crests"
                      aspectRatio="1:1"
                    />

                    <ImageUploadZone
                      label="Hero Home Ground Banner"
                      recommendedText="Wide 1920x1080px (16:9) home ground or arena photography"
                      currentImageUrl={formData.banner_url}
                      onUploadComplete={(url) => setFormData(prev => ({ ...prev, banner_url: url }))}
                      folder="banners"
                      aspectRatio="16:9"
                    />
                  </div>

                  {/* Right Column: Interactive 2D Vector Jersey Morphing Canvas */}
                  <div>
                    <KitDesignerPreview
                      clubName={formData.name || "Your Club"}
                      shortName={formData.short_name || 'VFC'}
                      primaryColor={formData.primary_color}
                      secondaryColor={formData.secondary_color}
                      accentColor={formData.accent_color}
                      onColorsChange={({ primary, secondary, accent }) => {
                        setFormData(prev => ({
                          ...prev,
                          primary_color: primary,
                          secondary_color: secondary,
                          accent_color: accent,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={() => handleNext(2)} className="btn btn-primary">
                    <span>Continue to Ground Details</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: HOME GROUND */}
            {step === 3 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#FFFFFF' }}>
                  3. Home Ground & Matchday Venue
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                  Provide fans and visiting teams with venue directions and surface specs.
                </p>

                <div className="form-group">
                  <label htmlFor="create-club-home-ground-name" className="form-label">Home Ground Name *</label>
                  <input id="create-club-home-ground-name"
                    type="text"
                    name="stadium_name"
                    required
                    className="form-input"
                    placeholder="e.g. Riverside Park"
                    value={formData.stadium_name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-club-physical-address" className="form-label">Physical Address</label>
                  <input id="create-club-physical-address"
                    type="text"
                    name="stadium_address"
                    className="form-input"
                    placeholder="e.g. 88 Olympic Boulevard, Metro City"
                    value={formData.stadium_address}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="create-club-pitch-surface" className="form-label">Pitch Surface</label>
                    <select id="create-club-pitch-surface"
                      name="stadium_pitch_type"
                      className="form-select"
                      value={formData.stadium_pitch_type}
                      onChange={handleChange}
                    >
                      <option value="Natural Grass">Natural Grass</option>
                      <option value="Hybrid Grass (FIFA Pro Quality)">Hybrid Grass (FIFA Pro Quality)</option>
                      <option value="3G / 4G All-Weather Turf">3G / 4G All-Weather Synthetic Turf</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-club-parking-transit-notes" className="form-label">Parking & Transit Notes</label>
                    <input id="create-club-parking-transit-notes"
                      type="text"
                      name="stadium_parking_info"
                      className="form-input"
                      placeholder="e.g. Matchday parking on site at Gate 2"
                      value={formData.stadium_parking_info}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                  <button type="button" onClick={() => setStep(2)} className="btn btn-secondary">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button type="button" onClick={() => handleNext(3)} className="btn btn-primary">
                    <span>Continue to Domain & Launch</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: DOMAIN & LAUNCH */}
            {step === 4 && (
              <div className="animate-fade-in">
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#FFFFFF' }}>
                  4. Custom Domain & Launch Setup
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.75rem' }}>
                  Link your own custom domain (e.g. yourclub.com) or use our managed subpath.
                </p>

                <div className="form-group">
                  <label className="form-label">Custom Domain (Optional)</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', padding: '0.7rem 0.8rem', border: '1px solid var(--border-subtle)', borderRight: 'none', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px', color: 'var(--text-muted)' }}>
                      <Globe size={16} />
                    </span>
                    <input
                      type="text"
                      name="custom_domain"
                      className="form-input"
                      style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                      placeholder="yourclub.com"
                      value={formData.custom_domain}
                      onChange={handleChange}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Point your domain CNAME record to <code>cname.itsfootball.club</code> for automatic SSL & routing.
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="create-club-club-secretariat-email" className="form-label">Club Secretariat Email *</label>
                    <input id="create-club-club-secretariat-email"
                      type="email"
                      name="contact_email"
                      required
                      className="form-input"
                      value={formData.contact_email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-club-club-contact-phone" className="form-label">Club Contact Phone</label>
                    <input id="create-club-club-contact-phone"
                      type="tel"
                      name="contact_phone"
                      className="form-input"
                      value={formData.contact_phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem', marginTop: '1.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#10B981', fontWeight: 800, marginBottom: '0.4rem' }}>
                    <CheckCircle2 size={18} /> Ready to Initialize Tenant
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    Your dedicated club portal, match center, virtual passes, and admin portal will be immediately activated at <strong>/{formData.slug}</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                  <button type="button" onClick={() => setStep(3)} className="btn btn-secondary">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button type="submit" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} />
                    <span>Launch & Enter Club</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} redirectTo="" />

      <Footer />
    </div>
  );
}
