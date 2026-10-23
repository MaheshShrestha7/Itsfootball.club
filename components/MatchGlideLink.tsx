'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps, MouseEvent } from 'react';

/** Resolves once `find` returns something, or after `ms` regardless */
function whenPresent(find: () => unknown, ms: number): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => (find() || Date.now() - start > ms ? resolve() : setTimeout(check, 16));
    check();
  });
}

/**
 * A link to a match page that glides its fixture card (the nearest [data-glide-card], and its
 * [data-glide-score]) into the match page's scoreboard (view-transition-names match-card and match-score).
 * The page scrolls to the top inside the transition, so the card lands on the scoreboard rather than the page
 * jumping afterwards. A plain link where view transitions aren't supported, under reduced motion, or when
 * opened in a new tab.
 */
export default function MatchGlideLink({ matchId, href, onClick, ...rest }: ComponentProps<typeof Link> & { matchId: string; href: string }) {
  const router = useRouter();

  const glide = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = e.currentTarget.closest<HTMLElement>('[data-glide-card]');
    if (!card) return;
    e.preventDefault();
    const score = card.querySelector<HTMLElement>('[data-glide-score]');
    card.style.viewTransitionName = 'match-card';
    if (score) score.style.viewTransitionName = 'match-score';
    const transition = document.startViewTransition(async () => {
      card.style.viewTransitionName = '';
      if (score) score.style.viewTransitionName = '';
      router.push(href, { scroll: false });
      await whenPresent(() => document.querySelector(`[data-match-header="${matchId}"]`), 2500);
      // Instant, not the page's smooth scrolling, so the new view is captured at the top
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    transition.ready.catch(() => {});
  };

  return <Link href={href} onClick={glide} {...rest} />;
}
