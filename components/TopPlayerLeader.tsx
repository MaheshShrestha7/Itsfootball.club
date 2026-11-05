'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import SilkBackdrop from '@/components/SilkBackdrop';

interface Props {
  href: string;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  photoUrl: string | null;
  figures: { label: string; abbr?: string; n: number }[];
  /** A plain sentence under the figures, e.g. a keeper's clean sheets out of games */
  line?: string | null;
  /** Level with the next player on every figure */
  joint?: boolean;
  /** Club colours for the silk background */
  primary?: string | null;
  secondary?: string | null;
}

/** The 1st-place card on Top Players, styled like the member pass: the club's silk behind, with the
 *  shirt number printed on it and the photo beside. Without WebGL it falls back to dark glass with the
 *  number huge and faded behind, drifting in once when the card scrolls into view and again for each
 *  new leader (a GK/DEF switch). Reduced motion: it simply sits there. */
export default function TopPlayerLeader({ href, name, position, jerseyNumber, photoUrl, figures, line, joint, primary, secondary }: Props) {
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

  const firstName = name.trim().split(/\s+/)[0];
  return (
    <Link ref={ref} href={href}
      className={`tp-leader${photoUrl ? ' tp-leader-has-photo' : ''}${seen ? ' is-seen' : ''}`}>
      <SilkBackdrop primary={primary} secondary={secondary} numberSelector=".tp-leader-no" number={jerseyNumber == null ? null : `${href}#${jerseyNumber}`} />
      {/* Keyed by player, so a new leader's number plays its entrance */}
      {jerseyNumber != null && <span key={href} className="tp-leader-no" aria-hidden="true">{jerseyNumber}</span>}
      {/* Keyed by player too: a new leader's details fade in over the silk, which stays put */}
      <div key={`${href}-body`} className="tp-swap">
        <div className="tp-leader-top">
          <div className="min-w-0">
            <span className="tp-rank1"><Trophy size={14} aria-hidden="true" /> {joint ? 'Joint 1st' : '1st'}</span>
            <h3 className="tp-leader-name">{name}</h3>
            {position && <p className="tp-leader-pos">{position}</p>}
          </div>
          {photoUrl && <span className="tp-leader-photo"><PlayerAvatar photoUrl={photoUrl} name={name} fill /></span>}
        </div>
        <dl className={`tp-leader-stats${figures.length === 3 ? ' tp-leader-stats-3' : ''}`}>
          {figures.map(f => <div key={f.label}><dd>{f.n}</dd><dt>{f.abbr ? <abbr title={f.label}>{f.abbr}</abbr> : f.label}</dt></div>)}
        </dl>
        {line && <p className="tp-leader-line">{line}</p>}
        <span className="tp-leader-go"><span>{firstName}&rsquo;s season</span><ChevronRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}
