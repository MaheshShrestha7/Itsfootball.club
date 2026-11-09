'use client';

import Link from 'next/link';
import { ChevronRight, Trophy } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';
import SilkBackdrop from '@/components/SilkBackdrop';

interface Props {
  href: string;
  name: string;
  position: string | null;
  photoUrl: string | null;
  jerseyNumber?: number | null;
  figures: { label: string; abbr?: string; n: number }[];
  /** A plain sentence under the figures, e.g. a keeper's clean sheets out of games */
  line?: string | null;
  /** Level with the next player on every figure */
  joint?: boolean;
  /** Club colours for the silk background */
  primary?: string | null;
  secondary?: string | null;
}

/** The 1st-place card on Top Players: the club's two colours flowing as silk behind with the shirt number
 *  printed on the cloth (like the player page band), and the photo beside the name. Without WebGL it stays
 *  a flat field of the club colour, with no number. */
export default function TopPlayerLeader({ href, name, position, photoUrl, figures, line, joint, primary, secondary, jerseyNumber = null }: Props) {
  const firstName = name.trim().split(/\s+/)[0];
  return (
    <Link href={href} className={`tp-leader${photoUrl ? ' tp-leader-has-photo' : ''}`}>
      {/* Outside the keyed block, so the silk keeps flowing when the leader changes; a new leader's number fades in */}
      <SilkBackdrop primary={primary} secondary={secondary} numberSelector=".tp-leader-no" number={jerseyNumber == null ? null : `${href}#${jerseyNumber}`} />
      {/* Never shown itself: it places the number the silk prints (size, spot and tilt) */}
      {jerseyNumber != null && <span className="tp-leader-no" aria-hidden="true">{jerseyNumber}</span>}
      {/* Keyed by player: a new leader's details fade in */}
      <div key={href} className="tp-swap">
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
