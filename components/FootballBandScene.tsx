'use client';

import { useEffect, type RefObject } from 'react';
import { mountFootballBand } from '@/lib/football-band-scene';

interface Props {
  band: RefObject<HTMLElement | null>;
  host: RefObject<HTMLDivElement | null>;
  front: RefObject<HTMLCanvasElement | null>;
  tagline: RefObject<HTMLHeadingElement | null>;
  kit?: string;
  onLive: () => void;
}

/** Starts the three.js scene inside FootballBand's elements. Loaded with ssr: false so three.js stays out of the server bundle. */
export default function FootballBandScene({ band, host, front, tagline, kit, onLive }: Props) {
  useEffect(() => {
    if (!band.current || !host.current || !front.current) return;
    let gone = false;
    let dispose: (() => void) | undefined;
    mountFootballBand({ band: band.current, host: host.current, front: front.current, tagline: tagline.current ?? undefined, kit })
      .then(d => { if (gone) d(); else { dispose = d; onLive(); } })
      .catch(() => { /* no WebGL, or the model didn't load: the still picture stays */ });
    return () => { gone = true; dispose?.(); };
  }, [band, host, front, tagline, kit, onLive]);
  return null;
}
