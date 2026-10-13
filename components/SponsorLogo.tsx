'use client';

import React, { useEffect, useState } from 'react';

interface SponsorLogoProps {
  src?: string;
  name: string;
  /** Logo height in px; the initials tile is a square of this size */
  height: number;
  /** Applied to the logo image only (e.g. maxWidth, drop shadow) */
  style?: React.CSSProperties;
  className?: string;
  loading?: 'lazy' | 'eager';
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

/** Sponsor logo, falling back to an initials tile when there is no logo or it fails to load.
 *  Every placement shows the sponsor's name next to the logo, so the tile is decorative. */
export default function SponsorLogo({ src, name, height, style, className, loading = 'lazy' }: SponsorLogoProps) {
  // A missing or dead logo URL shows initials instead of the browser's broken-image icon and alt text
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        className={className}
        loading={loading}
        decoding="async"
        src={src}
        alt={`${name} logo`}
        draggable={false}
        onError={() => setFailed(true)}
        style={{ height, objectFit: 'contain', ...style }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: height,
        height,
        flexShrink: 0,
        borderRadius: Math.max(6, Math.round(height * 0.18)),
        background: 'rgba(var(--tint-rgb), 0.08)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, Math.round(height * 0.36)),
        fontWeight: 800,
        letterSpacing: '0.02em',
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
