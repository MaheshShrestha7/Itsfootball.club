'use client';

import { useSearchParams } from 'next/navigation';

/**
 * A page tab kept in the URL (?tab=income), so the admin menu's sub-items and other links can open it
 * and the menu highlights the tab that's showing. The first tab is the default and leaves the URL bare.
 * Switching uses history.replaceState with no state of its own, which Next keeps in sync with
 * useSearchParams (no reload); passing Next's own history state would skip that sync.
 */
export function useUrlTab<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab = tabs.find(t => t === requested) ?? tabs[0];

  const setTab = (next: T) => {
    const query = new URLSearchParams(window.location.search);
    if (next === tabs[0]) query.delete('tab');
    else query.set('tab', next);
    const search = query.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  };

  return [tab, setTab];
}
