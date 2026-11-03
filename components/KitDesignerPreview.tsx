'use client';

import React from 'react';
import { evaluateColorContrast } from '@/lib/theme-utils';

/** A shirt front in the club's colours, so the admin can see the three colours together while
 *  picking them. A preview only: nothing about the kit itself is saved. */
export default function KitDesignerPreview({ shortName, primaryColor, secondaryColor, accentColor }: {
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}) {
  const torso = 'M 95 62 L 132 50 Q 160 85 188 50 L 225 62 L 215 285 L 105 285 Z';
  return (
    <figure className="kit-jersey-card" style={{ margin: 0, padding: '1.5rem 1rem 1rem' }}>
      <svg viewBox="0 0 320 300" className="kit-jersey-svg" role="img"
        aria-label="A shirt in the club colours: stripes in the primary and secondary colours, trim in the accent"
        style={{ width: 240, height: 'auto' }}>
        <defs>
          <pattern id="kit-stripes" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="20" height="40" fill={primaryColor} />
            <rect x="20" width="20" height="40" fill={secondaryColor} />
          </pattern>
        </defs>
        {/* Sleeves, then their cuffs */}
        <path d="M 95 62 L 32 110 L 58 152 L 105 116 Z" fill={secondaryColor} />
        <path d="M 225 62 L 288 110 L 262 152 L 215 116 Z" fill={secondaryColor} />
        <path d="M 32 110 L 22 118 L 48 160 L 58 152 Z" fill={accentColor} />
        <path d="M 288 110 L 298 118 L 272 160 L 262 152 Z" fill={accentColor} />
        <path d={torso} fill="url(#kit-stripes)" stroke="rgba(var(--tint-rgb), 0.2)" strokeWidth="2" />
        {/* Collar */}
        <path d="M 132 50 Q 160 92 188 50 Q 160 80 132 50 Z" fill={accentColor} />
        {/* The club's short name on a band across the chest */}
        <rect x="104" y="146" width="112" height="38" rx="5" fill={primaryColor} />
        <text x="160" y="173" textAnchor="middle" fill={evaluateColorContrast(primaryColor).bestTextColor} fontSize="22" fontWeight="900" fontFamily="var(--font-heading)">
          {shortName.slice(0, 6).toUpperCase()}
        </text>
      </svg>
    </figure>
  );
}
