'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Slides each [data-flip-key] element inside `container` from its old place to its new one whenever `order`
 * changes (FLIP), so a reordered list glides instead of jumping. A row that moved up also gets a brief glow in
 * the club colour. Nothing moves under reduced motion: the list simply shows its new order.
 */
export function useFlipReorder(container: RefObject<HTMLElement | null>, order: string) {
  const last = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const box = container.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top;
    const rows = Array.from(box.querySelectorAll<HTMLElement>('[data-flip-key]'));
    // Positions relative to the list, so scrolling the page between renders doesn't count as moving
    const now = new Map(rows.map(r => [r.dataset.flipKey!, r.getBoundingClientRect().top - top]));
    const before = last.current;
    last.current = now;
    if (!before.size || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (const row of rows) {
      const was = before.get(row.dataset.flipKey!);
      if (was === undefined) continue;
      const dy = was - now.get(row.dataset.flipKey!)!;
      if (Math.abs(dy) < 1) continue;
      row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      if (dy > 0) {
        const rgb = getComputedStyle(row).getPropertyValue('--club-primary-rgb').trim() || '16, 185, 129';
        row.animate(
          [{ boxShadow: `0 0 0 2px rgba(${rgb}, 0.9), 0 0 26px rgba(${rgb}, 0.5)` }, { boxShadow: `0 0 0 0 rgba(${rgb}, 0)` }],
          { duration: 1400, easing: 'ease-out' }
        );
      }
    }
  }, [container, order]);
}
