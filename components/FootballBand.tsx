'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Client only: three.js must never reach the server bundle (Cloudflare worker size)
const FootballBandScene = dynamic(() => import('./FootballBandScene'), { ssr: false });

/** The 3D player juggling in the home hero (lib/football-band-scene.ts, three.js). `kit` is the visitor's
 *  picked club colour: his shirt and socks are repainted in it. Decorative only: hidden from screen readers. */
export default function FootballBand({ kit }: { kit?: string }) {
  const band = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const tagline = useRef<HTMLHeadingElement>(null); // none in the hero: the scene frames the player alone
  const [live, setLive] = useState(false);
  const onLive = useCallback(() => setLive(true), []);
  const [firstKit] = useState(kit); // the scene starts in this colour; later picks arrive as fb-kit events

  useEffect(() => { band.current?.dispatchEvent(new CustomEvent('fb-kit', { detail: kit })); }, [kit, live]);

  return (
    <div ref={band} className={`fb-hero ${live ? 'is-live' : ''}`} aria-hidden="true">
      <div ref={host} className="fb-canvas" />
      <canvas ref={front} className="fb-front" />
      <FootballBandScene band={band} host={host} front={front} tagline={tagline} kit={firstKit} onLive={onLive} />
    </div>
  );
}
