'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

interface Props {
  href: string;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  photoUrl: string | null;
  figures: { label: string; n: number }[];
  /** A plain sentence under the figures, e.g. a keeper's clean sheets out of games */
  line?: string | null;
}

/** The 1st-place card on Top Players, styled like the member pass: dark glass with the club colour
 *  glowing through and the shirt number huge and faded behind, beside the photo when there is one.
 *  The number drifts in once when the card scrolls into view, again for each new leader (a GK/DEF
 *  switch), and leans away from the mouse on desktop. Reduced motion: it simply sits there. */
export default function TopPlayerLeader({ href, name, position, jerseyNumber, photoUrl, figures, line }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lean = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--tp-px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    e.currentTarget.style.setProperty('--tp-py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const rest = (e: React.PointerEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty('--tp-px', '0');
    e.currentTarget.style.setProperty('--tp-py', '0');
  };

  const firstName = name.trim().split(/\s+/)[0];
  return (
    <Link ref={ref} href={href} onPointerMove={lean} onPointerLeave={rest}
      className={`tp-leader${photoUrl ? ' tp-leader-has-photo' : ''}${seen ? ' is-seen' : ''}`}>
      {/* Keyed by player, so a new leader's number plays its entrance */}
      {jerseyNumber != null && <span key={href} className="tp-leader-no" aria-hidden="true">{jerseyNumber}</span>}
      <div className="tp-leader-top">
        <div className="min-w-0">
          <span className="tp-rank1"><Trophy size={14} aria-hidden="true" /> 1st</span>
          <h3 className="tp-leader-name">{name}</h3>
          {position && <p className="tp-leader-pos">{position}</p>}
        </div>
        {photoUrl && <span className="tp-leader-photo"><PlayerAvatar photoUrl={photoUrl} name={name} fill /></span>}
      </div>
      <dl className={`tp-leader-stats${figures.length === 3 ? ' tp-leader-stats-3' : ''}`}>
        {figures.map(f => <div key={f.label}><dd>{f.n}</dd><dt>{f.label}</dt></div>)}
      </dl>
      {line && <p className="tp-leader-line">{line}</p>}
      <span className="tp-leader-go"><span>{firstName}&rsquo;s season</span><ChevronRight size={16} aria-hidden="true" /></span>
    </Link>
  );
}
