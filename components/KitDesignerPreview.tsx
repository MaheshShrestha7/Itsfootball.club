'use client';

import React, { useState, useMemo } from 'react';
import { RotateCw } from 'lucide-react';

export type KitType = 'home' | 'away' | 'third';
export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves' | 'gradient';

interface KitDesignerPreviewProps {
  clubName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  interactive?: boolean;
}

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
  clubName = 'Your Club',
  shortName = 'YCF',
  primaryColor = '#059669',
  secondaryColor = '#0F172A',
  accentColor = '#F59E0B',
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

  const kitLabel = { home: 'Home', away: 'Away', third: 'Third' }[kitType];
  const contrastOk = contrastRatio >= 4.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', width: '100%' }}>
      {/* Which kit, and which side of it */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
        <div className="admin-chips" role="group" aria-label="Kit">
          {(['home', 'away', 'third'] as KitType[]).map(t => (
            <button key={t} type="button" className="admin-chip" aria-pressed={kitType === t} onClick={() => setKitType(t)}>
              {{ home: 'Home', away: 'Away', third: 'Third' }[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setViewSide(v => (v === 'front' ? 'back' : 'front'))}
          className="btn btn-secondary btn-sm row"
        >
          <RotateCw size={14} aria-hidden="true" />
          <span>Show the {viewSide === 'front' ? 'back' : 'front'}</span>
        </button>
      </div>

      {/* The shirt on a plain stage, edged in its own colour */}
      <figure className="kit-jersey-card" style={{ margin: 0, borderColor: kitColors.base }}>
        <span
          className={contrastOk ? 'admin-pill is-ok' : 'admin-pill is-warn'}
          title="How readable the shirt number is on the shirt colour. 4.5:1 or more reads well from the stands."
          style={{ position: 'absolute', top: 'var(--space-sm)', right: 'var(--space-sm)', zIndex: 6 }}
        >
          Number contrast {contrastRatio}:1
        </span>
        {/* 2D Vector Jersey SVG */}
        <div style={{ width: '220px', height: '240px', position: 'relative', marginTop: '0.75rem' }}>
          <svg
            viewBox="0 0 320 340"
            className="kit-jersey-svg"
            role="img"
            aria-label={`${kitLabel} kit in the club colours, ${viewSide} view`}
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
                stroke="rgba(var(--tint-rgb), 0.15)"
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
                stroke="rgba(var(--tint-rgb), 0.15)"
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
                stroke="rgba(var(--tint-rgb), 0.2)"
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
                    stroke="rgba(var(--tint-rgb), 0.1)"
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
                    {(clubName.length > 12 && shortName ? shortName : clubName).toUpperCase().slice(0, 12)}
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

        <figcaption style={{ textAlign: 'center', marginTop: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {kitLabel} kit, {viewSide}
        </figcaption>
      </figure>

      {/* Pattern */}
      {interactive && (
        <div role="group" aria-labelledby="kit-pattern-label">
          <span id="kit-pattern-label" className="form-label">Pattern</span>
          <div className="admin-chips" style={{ flexWrap: 'wrap' }}>
            {[
              { id: 'stripes', label: 'Stripes' },
              { id: 'hoops', label: 'Hoops' },
              { id: 'sash', label: 'Sash' },
              { id: 'halves', label: 'Halves' },
              { id: 'gradient', label: 'Fade' },
              { id: 'solid', label: 'Plain' },
            ].map(p => (
              <button key={p.id} type="button" className="admin-chip" aria-pressed={pattern === p.id} onClick={() => setPattern(p.id as KitPattern)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
