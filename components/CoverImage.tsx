'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_CREST } from '@/lib/crest';

interface CoverImageProps {
  src?: string;
  alt: string;
  /** Club crest shown on the placeholder when there is no cover photo */
  crestUrl?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  /** Sizing and shape, applied to the image and the placeholder alike */
  style?: React.CSSProperties;
}

/** News cover photo, falling back to a club-coloured panel with the club crest when the article
 *  has no cover or it fails to load. The site's share image can't be used here: cropped into a
 *  small card it reads as random cut-off text. */
export default function CoverImage({ src, alt, crestUrl, width, height, loading = 'lazy', style }: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        loading={loading}
        decoding="async"
        width={width}
        height={height}
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        style={{ objectFit: 'cover', ...style }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        background: 'linear-gradient(135deg, rgba(var(--tint-rgb), 0.12), rgba(var(--tint-rgb), 0.02)), var(--club-primary, #1F2937)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={crestUrl || DEFAULT_CREST}
        alt=""
        loading={loading}
        decoding="async"
        onError={e => { e.currentTarget.style.display = 'none'; }}
        style={{ width: '42%', height: '42%', maxWidth: 120, maxHeight: 120, objectFit: 'contain', opacity: 0.9 }}
      />
    </div>
  );
}
