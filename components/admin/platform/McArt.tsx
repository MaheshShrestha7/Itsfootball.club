// Shared bits of the Mission Control look: the itsfootball.club goalpost logo drawn large for banners,
// the small rail logo, and round crests/avatars with an initials fallback.
import React from 'react';
import { initials } from '@/lib/mission-control';

/** The goal frame and green ball from the logo, drawn big for a banner background. */
export function LogoArt({ id }: { id: string }) {
  return (
    <svg className="mc-logo-art" viewBox="0 0 300 220" aria-hidden="true">
      <defs>
        <radialGradient id={`mc-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#10B981" stopOpacity="0.55" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M40 205V30h230v175" fill="none" stroke="var(--mc-logo-frame)" strokeWidth="26" strokeLinecap="square" opacity="0.9" />
      <circle cx="102" cy="150" r="58" fill={`url(#mc-glow-${id})`} />
      <circle cx="102" cy="150" r="30" fill="#10B981" />
    </svg>
  );
}

/** Small version of the logo for the top of the icon rail. */
export function RailLogo() {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
      <path d="M7 30V11h26v19" fill="none" stroke="#F8FAFC" strokeWidth="3.2" strokeLinecap="square" />
      <circle cx="14" cy="24" r="3.6" fill="#10B981" />
    </svg>
  );
}

/** Round club crest: the logo if there is one, else the short name on the club colour. */
export function Crest({ logoUrl, label, color, size }: { logoUrl?: string | null; label: string; color?: string | null; size?: number }) {
  const style: React.CSSProperties = { background: color || '#10B981', ...(size ? { width: size, height: size } : {}) };
  return (
    <span className="mc-crest" style={style}>
      {logoUrl ? <img src={logoUrl} alt="" width={size || 40} height={size || 40} /> : label.slice(0, 2).toUpperCase()}
    </span>
  );
}

const AVATAR_TINTS = ['#C7F0DD', '#E4E1FB', '#FBE3C7', '#F9DCEB', '#DCEBFB'];

/** Round person avatar: photo if there is one, else initials on a soft colour picked from the name. */
export function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const tint = AVATAR_TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <span className={`mc-av${className ? ` ${className}` : ''}`} style={{ background: tint }}>
      {url ? <img src={url} alt="" width={46} height={46} /> : initials(name)}
    </span>
  );
}
