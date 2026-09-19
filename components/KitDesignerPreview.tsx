'use client';

import React, { useState, useMemo } from 'react';
import { Shield, Sparkles, Shirt, RotateCw, Check, Palette } from 'lucide-react';

export type KitType = 'home' | 'away' | 'third';
export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves' | 'gradient';

interface KitDesignerPreviewProps {
  clubName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  onColorsChange?: (colors: { primary: string; secondary: string; accent: string }) => void;
  interactive?: boolean;
}

interface PalettePreset {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

const KIT_PALETTE_PRESETS: PalettePreset[] = [
  {
    name: 'Emerald Apex',
    primary: '#059669',
    secondary: '#0F172A',
    accent: '#F59E0B',
    description: 'Vibrant pitch emerald with obsidian and champion gold',
  },
  {
    name: 'Cobalt Royale',
    primary: '#2563EB',
    secondary: '#090D16',
    accent: '#EF4444',
    description: 'Electric cobalt blue with midnight black and crimson fire',
  },
  {
    name: 'Crimson Dynamo',
    primary: '#DC2626',
    secondary: '#18181B',
    accent: '#FBBF24',
    description: 'Aggressive racing red with charcoal and amber gold',
  },
  {
    name: 'Neon Ultra',
    primary: '#7C3AED',
    secondary: '#0B0F19',
    accent: '#06B6D4',
    description: 'Future city violet with deep space black and electric cyan',
  },
  {
    name: 'Vibrant Amber',
    primary: '#D97706',
    secondary: '#111827',
    accent: '#FFFFFF',
    description: 'Stadium floodlight amber with raven black and optic white',
  },
  {
    name: 'Blanco Galáctico',
    primary: '#F8FAFC',
    secondary: '#0284C7',
    accent: '#EAB308',
    description: 'Pristine optic white with royal cyan and gold badge trim',
  },
  {
    name: 'Obsidian Shadow',
    primary: '#0F172A',
    secondary: '#1E293B',
    accent: '#10B981',
    description: 'Stealth night black with slate contrast and neon pitch green',
  },
];

// Relative luminance for contrast calculation
function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return parseFloat(((brightest + 0.05) / (darkest + 0.05)).toFixed(1));
}

export default function KitDesignerPreview({
  clubName = 'Apex City FC',
  shortName = 'ACFC',
  primaryColor = '#059669',
  secondaryColor = '#0F172A',
  accentColor = '#F59E0B',
  onColorsChange,
  interactive = true,
}: KitDesignerPreviewProps) {
  const [kitType, setKitType] = useState<KitType>('home');
  const [pattern, setPattern] = useState<KitPattern>('stripes');
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');

  // Compute color assignments based on kit edition
  const kitColors = useMemo(() => {
    if (kitType === 'away') {
      return {
        base: secondaryColor,
        secondary: '#FFFFFF',
        accent: primaryColor,
        text: '#FFFFFF',
      };
    }
    if (kitType === 'third') {
      return {
        base: accentColor,
        secondary: secondaryColor,
        accent: primaryColor,
        text: getLuminance(accentColor) > 0.5 ? '#040609' : '#FFFFFF',
      };
    }
    // Home Kit
    return {
      base: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      text: getLuminance(primaryColor) > 0.45 ? '#040609' : '#FFFFFF',
    };
  }, [kitType, primaryColor, secondaryColor, accentColor]);

  // Compute contrast ratio for player number/sponsor visibility
  const contrastRatio = useMemo(() => {
    return getContrastRatio(kitColors.base, kitColors.text);
  }, [kitColors.base, kitColors.text]);

  const handleApplyPreset = (preset: PalettePreset) => {
    if (onColorsChange) {
      onColorsChange({
        primary: preset.primary,
        secondary: preset.secondary,
        accent: preset.accent,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Kit Selector Bar (Home, Away, Third) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        {/* Kit Edition Tabs */}
        <div style={{
          display: 'inline-flex',
          padding: '4px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          {(['home', 'away', 'third'] as KitType[]).map(t => {
            const isSelected = kitType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setKitType(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'var(--club-primary, #10B981)' : 'transparent',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  transition: 'all 0.2s ease',
                }}
              >
                {t} Kit
              </button>
            );
          })}
        </div>

        {/* Rotate View Front / Back */}
        <button
          type="button"
          onClick={() => setViewSide(v => (v === 'front' ? 'back' : 'front'))}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
        >
          <RotateCw size={14} />
          <span>Flip to {viewSide === 'front' ? 'Back' : 'Front'}</span>
        </button>
      </div>

      {/* Main Kit Showcase Stage */}
      <div
        className="kit-jersey-card"
        style={{
          border: `1.5px solid ${kitColors.base}`,
          boxShadow: `inset 0 0 45px rgba(0, 0, 0, 0.9), 0 12px 35px rgba(0,0,0,0.6), 0 0 25px ${kitColors.base}33`,
        }}
      >
        {/* Stadium Floodlight Gloss Sweep across jersey */}
        <div className="kit-gloss-sweep" />

        {/* Official Matchwear Tag Pill */}
        <div style={{
          position: 'absolute',
          top: '14px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          padding: '3px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '0.65rem',
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          zIndex: 6,
        }}>
          <Shirt size={11} color={kitColors.accent} />
          <span>{kitType} Matchday Edition</span>
        </div>

        {/* Contrast Legibility Indicator */}
        <div style={{
          position: 'absolute',
          top: '14px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          padding: '3px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: contrastRatio >= 4.5 ? '#10B981' : '#F59E0B',
          zIndex: 6,
        }}>
          <span>{contrastRatio}:1 Contrast</span>
        </div>

        {/* 2D Vector Jersey SVG */}
        <div style={{ width: '220px', height: '240px', position: 'relative', marginTop: '0.75rem' }}>
          <svg
            viewBox="0 0 320 340"
            className="kit-jersey-svg"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* Pattern 1: Vertical Stripes */}
              <pattern id="kit-stripes" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="20" height="40" fill={kitColors.base} />
                <rect x="20" width="20" height="40" fill={kitColors.secondary} />
              </pattern>

              {/* Pattern 2: Horizontal Hoops */}
              <pattern id="kit-hoops" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="20" fill={kitColors.base} />
                <rect y="20" width="40" height="20" fill={kitColors.secondary} />
              </pattern>

              {/* Pattern 3: Diagonal Sash */}
              <linearGradient id="kit-sash" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={kitColors.base} />
                <stop offset="42%" stopColor={kitColors.base} />
                <stop offset="42%" stopColor={kitColors.secondary} />
                <stop offset="58%" stopColor={kitColors.secondary} />
                <stop offset="58%" stopColor={kitColors.base} />
                <stop offset="100%" stopColor={kitColors.base} />
              </linearGradient>

              {/* Pattern 4: Halves */}
              <linearGradient id="kit-halves" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={kitColors.base} />
                <stop offset="50%" stopColor={kitColors.base} />
                <stop offset="50%" stopColor={kitColors.secondary} />
                <stop offset="100%" stopColor={kitColors.secondary} />
              </linearGradient>

              {/* Pattern 5: Gradient Fade */}
              <linearGradient id="kit-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor={kitColors.secondary} />
                <stop offset="65%" stopColor={kitColors.base} />
                <stop offset="100%" stopColor={kitColors.base} />
              </linearGradient>

              {/* Subtle Mesh Weave Texture */}
              <pattern id="mesh-weave" width="6" height="6" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="0.75" fill="rgba(0,0,0,0.15)" />
              </pattern>
            </defs>

            {/* Jersey Torso & Sleeves Main Silhouette */}
            <g>
              {/* Left Sleeve */}
              <path
                d="M 95 62 L 32 110 L 58 152 L 105 116 Z"
                fill={pattern === 'halves' ? kitColors.base : kitColors.secondary}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
              />
              {/* Left Sleeve Cuff Trim */}
              <path
                d="M 32 110 L 22 118 L 48 160 L 58 152 Z"
                fill={kitColors.accent}
              />

              {/* Right Sleeve */}
              <path
                d="M 225 62 L 288 110 L 262 152 L 215 116 Z"
                fill={kitColors.secondary}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1.5"
              />
              {/* Right Sleeve Cuff Trim */}
              <path
                d="M 288 110 L 298 118 L 272 160 L 262 152 Z"
                fill={kitColors.accent}
              />

              {/* Main Torso Body */}
              <path
                d="M 95 62 L 132 50 Q 160 85 188 50 L 225 62 L 215 285 L 105 285 Z"
                fill={
                  pattern === 'stripes'
                    ? 'url(#kit-stripes)'
                    : pattern === 'hoops'
                    ? 'url(#kit-hoops)'
                    : pattern === 'sash'
                    ? 'url(#kit-sash)'
                    : pattern === 'halves'
                    ? 'url(#kit-halves)'
                    : pattern === 'gradient'
                    ? 'url(#kit-gradient)'
                    : kitColors.base
                }
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />

              {/* Torso Fabric Mesh Weave Overlay */}
              <path
                d="M 95 62 L 132 50 Q 160 85 188 50 L 225 62 L 215 285 L 105 285 Z"
                fill="url(#mesh-weave)"
                pointerEvents="none"
              />

              {/* Side Ventilation Panels */}
              <path
                d="M 105 130 L 115 140 L 115 285 L 105 285 Z"
                fill={kitColors.accent}
                opacity="0.8"
              />
              <path
                d="M 215 130 L 205 140 L 205 285 L 215 285 Z"
                fill={kitColors.accent}
                opacity="0.8"
              />

              {/* V-Neck Collar Trim */}
              <path
                d="M 132 50 Q 160 92 188 50 Q 160 80 132 50 Z"
                fill={kitColors.accent}
                stroke="rgba(0,0,0,0.3)"
                strokeWidth="1"
              />
              <path
                d="M 142 50 Q 160 76 178 50 Q 160 70 142 50 Z"
                fill={kitColors.secondary}
              />
            </g>

            {/* FRONT VIEW DETAILS (Crest, Sponsor, Insignia) */}
            {viewSide === 'front' ? (
              <g>
                {/* Left Chest Club Crest Shield */}
                <g transform="translate(122, 102)">
                  <path
                    d="M 0 -10 L 12 -10 L 12 4 Q 12 14 0 20 Q -12 14 -12 4 L -12 -10 Z"
                    fill={kitColors.secondary}
                    stroke={kitColors.accent}
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="6"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="7"
                    fontWeight="900"
                    fontFamily="var(--font-heading)"
                  >
                    {shortName.slice(0, 4)}
                  </text>
                  {/* Star above crest */}
                  <polygon
                    points="0,-16 2.5,-12 7,-12 3.5,-9 5,-4 0,-7 -5,-4 -3.5,-9 -7,-12 -2.5,-12"
                    fill={kitColors.accent}
                  />
                </g>

                {/* Right Chest Manufacturer Insignia */}
                <g transform="translate(196, 104)">
                  <circle cx="0" cy="0" r="7" fill={kitColors.accent} opacity="0.9" />
                  <path
                    d="M -4 2 L 0 -4 L 4 2 Z"
                    fill={kitColors.base}
                  />
                </g>

                {/* Center Shirt Sponsor / Club Name Typography */}
                <g transform="translate(160, 168)">
                  <rect
                    x="-42"
                    y="-14"
                    width="84"
                    height="28"
                    rx="4"
                    fill="rgba(0,0,0,0.35)"
                    stroke="rgba(255,255,255,0.1)"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={kitColors.text}
                    fontSize="10"
                    fontWeight="900"
                    letterSpacing="1.5"
                    fontFamily="var(--font-heading)"
                  >
                    {clubName.toUpperCase().slice(0, 12)}
                  </text>
                </g>

                {/* Lower Hem Authentic Matchwear Hologram Tag */}
                <g transform="translate(120, 270)">
                  <rect
                    x="0"
                    y="0"
                    width="22"
                    height="10"
                    rx="2"
                    fill={kitColors.accent}
                    stroke="#FFFFFF"
                    strokeWidth="0.5"
                  />
                  <text
                    x="11"
                    y="7"
                    textAnchor="middle"
                    fill="#040609"
                    fontSize="4"
                    fontWeight="900"
                  >
                    2026
                  </text>
                </g>
              </g>
            ) : (
              /* BACK VIEW DETAILS (Player Name & Squad Number) */
              <g>
                {/* Back Collar Monogram */}
                <g transform="translate(160, 68)">
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill={kitColors.accent}
                    fontSize="7"
                    fontWeight="800"
                    letterSpacing="1"
                  >
                    {shortName}
                  </text>
                </g>

                {/* Player Surname */}
                <g transform="translate(160, 110)">
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill={kitColors.text}
                    fontSize="13"
                    fontWeight="900"
                    letterSpacing="2"
                    fontFamily="var(--font-heading)"
                  >
                    MORENO
                  </text>
                </g>

                {/* Bold Jersey Number */}
                <g transform="translate(160, 190)">
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill={kitColors.text}
                    fontSize="72"
                    fontWeight="900"
                    fontFamily="var(--font-heading)"
                    stroke={kitColors.accent}
                    strokeWidth="2.5"
                    paintOrder="stroke fill"
                  >
                    10
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Current Kit Active Summary */}
        <div style={{ textAlign: 'center', marginTop: '0.85rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#FFFFFF' }}>
            {clubName} • {kitType.toUpperCase()} KIT
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {pattern.toUpperCase()} PATTERN • {viewSide.toUpperCase()} VIEW
          </div>
        </div>
      </div>

      {/* Pattern Selector Bar */}
      {interactive && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Kit Silhouette Pattern:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {[
              { id: 'stripes', label: 'Vertical Stripes' },
              { id: 'hoops', label: 'Horizontal Hoops' },
              { id: 'sash', label: 'Diagonal Sash' },
              { id: 'halves', label: 'Half & Half' },
              { id: 'gradient', label: 'Fade Gradient' },
              { id: 'solid', label: 'Clean Monochrome' },
            ].map(p => {
              const isActive = pattern === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPattern(p.id as KitPattern)}
                  className="kit-pattern-pill"
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: `1px solid ${isActive ? primaryColor : 'rgba(255, 255, 255, 0.1)'}`,
                    background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 800 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Curated Kit Color Preset Swatches */}
      {interactive && onColorsChange && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
            <Palette size={14} color="#F59E0B" />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              One-Click Kit Theme Swatches:
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem' }}>
            {KIT_PALETTE_PRESETS.map(preset => {
              const isSelected =
                primaryColor.toLowerCase() === preset.primary.toLowerCase() &&
                secondaryColor.toLowerCase() === preset.secondary.toLowerCase();

              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="kit-swatch-bubble"
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${isSelected ? '#F59E0B' : 'rgba(255, 255, 255, 0.08)'}`,
                    background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  title={preset.description}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                    {/* 3 Color Dots */}
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.primary, border: '1px solid rgba(255,255,255,0.4)' }} />
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.secondary, border: '1px solid rgba(255,255,255,0.4)' }} />
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.accent, border: '1px solid rgba(255,255,255,0.4)' }} />
                    {isSelected && (
                      <Check size={12} color="#F59E0B" style={{ marginLeft: 'auto' }} />
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
