'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Client only: three.js must never reach the server bundle (Cloudflare worker size)
const FootballBandScene = dynamic(() => import('./FootballBandScene'), { ssr: false });

/** The 3D player juggling in the home hero (lib/football-band-scene.ts, three.js). `kit` is the visitor's
 *  picked club colour: his shirt and socks are repainted in it. Decorative only: hidden from screen readers.
 *  Without WebGL (or if the model fails to load) the space closes up and the address box moves up. */
export default function FootballBand({ kit }: { kit?: string }) {
  const band = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'live' | 'off'>('loading');
  const onLive = useCallback(() => setState('live'), []);
  const onFail = useCallback(() => setState('off'), []);
  const [firstKit] = useState(kit); // the scene starts in this colour; later picks arrive as fb-kit events

  useEffect(() => { band.current?.dispatchEvent(new CustomEvent('fb-kit', { detail: kit })); }, [kit, state]);

  if (state === 'off') return null;
  return (
    <div ref={band} className={`fb-hero ${state === 'live' ? 'is-live' : ''}`} aria-hidden="true">
      <div ref={host} className="fb-canvas" />
      <FootballBandScene band={band} host={host} kit={firstKit} onLive={onLive} onFail={onFail} />
    </div>
  );
}
