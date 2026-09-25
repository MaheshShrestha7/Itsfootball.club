'use client';

import React, { useEffect, useState } from 'react';

interface PlayerAvatarProps {
  photoUrl?: string;
  name: string;
  /** Square size in px. Ignored when `fill` is set. */
  size?: number;
  /** Fill the parent box (e.g. a card's photo banner) instead of a fixed square */
  fill?: boolean;
  /** Load immediately instead of lazily (for avatars visible at page load) */
  eager?: boolean;
  /** Extra styling merged in, e.g. a border/shadow to match the surrounding design */
  style?: React.CSSProperties;
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

/** Player photo, falling back to their initials when there is no photo or it fails to load. */
export default function PlayerAvatar({ photoUrl, name, size = 32, fill = false, eager = false, style }: PlayerAvatarProps) {
  // A broken/expired photo URL shows initials instead of the browser's broken-image icon
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl]);

  const box: React.CSSProperties = fill
    ? { width: '100%', height: '100%' }
    : { width: size, height: size, borderRadius: '50%', flexShrink: 0 };

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name ? `${name} photo` : 'Player photo'}
        {...(fill ? {} : { width: size, height: size })}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        style={{ ...box, objectFit: 'cover', display: 'block', ...style }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || 'Player'}
      style={{
        ...box,
        background: fill
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.02)), var(--club-primary, #1F2937)'
          : 'rgba(255, 255, 255, 0.08)',
        color: fill ? '#FFFFFF' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fill ? '4.5rem' : Math.round(size * 0.38),
        fontWeight: 800,
        fontFamily: fill ? 'var(--font-heading)' : undefined,
        letterSpacing: fill ? '0.02em' : undefined,
        ...style,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}
