'use client';

import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    const el = band.current;
    if (!el || !('IntersectionObserver' in window)) return;
    let gone = false;
    let dispose: (() => void) | undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      import('@/lib/football-band-scene')
        .then(m => m.mountFootballBand({ band: el, host: host.current!, front: front.current!, tagline: tagline.current! }))
        .then(d => { if (gone) d(); else { dispose = d; setLive(true); } })
        .catch(() => { /* no WebGL, or the model didn't load: the still picture stays */ });
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { gone = true; io.disconnect(); dispose?.(); };
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
    </section>
  );
}
