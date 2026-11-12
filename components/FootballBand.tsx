'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Client only: three.js must never reach the server bundle (Cloudflare worker size)
const FootballBandScene = dynamic(() => import('./FootballBandScene'), { ssr: false });

/** Home page band under the hero: "Football. Community. Passion." with a 3D player juggling beside it.
 *  The tagline is ordinary text. The 3D scene (lib/football-band-scene.ts, three.js) is fetched only once the
 *  band is close to the screen; until then, and wherever WebGL isn't available, a still picture of the same
 *  scene shows instead. */
export default function FootballBand() {
  const band = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const tagline = useRef<HTMLHeadingElement>(null);
  const [live, setLive] = useState(false);

  const [near, setNear] = useState(false);
  const onLive = useCallback(() => setLive(true), []);

  useEffect(() => {
    const el = band.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { io.disconnect(); setNear(true); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={band} className={`fb-band ${live ? 'is-live' : ''}`} aria-labelledby="fb-h">
      {(['dark', 'light'] as const).map(t => (
        <picture key={t} className={`fb-poster fb-poster-${t}`}>
          <source media="(max-width: 759px)" srcSet={`/images/football-band-phone-${t}.webp`} />
          <img src={`/images/football-band-${t}.webp`} alt="" loading="lazy" decoding="async" />
        </picture>
      ))}
      <div ref={host} className="fb-canvas" aria-hidden="true" />
      <canvas ref={front} className="fb-front" aria-hidden="true" />
      <div className="container fb-copy">
        <h2 id="fb-h" ref={tagline} className="fb-tagline">
          <span>Football.</span> <span>Community.</span> <span>Passion.</span>
        </h2>
      </div>
      {near && <FootballBandScene band={band} host={host} front={front} tagline={tagline} onLive={onLive} />}
    </section>
  );
}
