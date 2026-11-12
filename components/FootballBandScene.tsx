'use client';

import { useEffect, type RefObject } from 'react';
import { mountFootballBand } from '@/lib/football-band-scene';

interface Props {
  band: RefObject<HTMLElement | null>;
  host: RefObject<HTMLDivElement | null>;
  kit?: string;
  onLive: () => void;
  onFail: () => void;
}

/** Starts the three.js scene inside FootballBand's elements. Loaded with ssr: false so three.js stays out of the server bundle. */
export default function FootballBandScene({ band, host, kit, onLive, onFail }: Props) {
  useEffect(() => {
    if (!band.current || !host.current) return;
    let gone = false;
    let dispose: (() => void) | undefined;
    mountFootballBand({ band: band.current, host: host.current, kit })
      .then(d => { if (gone) d(); else { dispose = d; onLive(); } })
      .catch(() => { if (!gone) onFail(); }); // no WebGL, or the model didn't load
    return () => { gone = true; dispose?.(); };
  }, [band, host, kit, onLive, onFail]);
  return null;
}
