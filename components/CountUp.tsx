'use client';

import { useEffect, useRef } from 'react';

/** A number that counts up from 0 when it first shows. The HTML holds the final number (no script, reduced motion) */
export default function CountUp({ value, delay = 0, duration = 700 }: { value: number; delay?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now() + delay;
    el.textContent = '0';
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / duration));
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); el.textContent = String(value); };
  }, [value, delay, duration]);
  return <span ref={ref}>{value}</span>;
}
