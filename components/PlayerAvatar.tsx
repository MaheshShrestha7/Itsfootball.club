'use client';

import React from 'react';

interface PlayerAvatarProps {
  photoUrl?: string;
  name: string;
  size?: number;
  /** Extra styling merged in, e.g. a border/shadow to match the surrounding design */
  style?: React.CSSProperties;
}

/** Circular player photo, falling back to their initials when no photo is on file. */
export default function PlayerAvatar({ photoUrl, name, size = 32, style }: PlayerAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  const initials = name.trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'rgba(255, 255, 255, 0.08)',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.38),
        fontWeight: 800,
        ...style,
      }}
    >
      {initials || '?'}
    </div>
  );
}
