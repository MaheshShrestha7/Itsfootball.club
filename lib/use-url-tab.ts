'use client';

import { useSearchParams } from 'next/navigation';

/**
 * A page tab kept in the URL (?tab=income), so the admin menu's sub-items and other links can open it
 * and the menu highlights the tab that's showing. The first tab is the default and leaves the URL bare.
 * Switching uses history.replaceState with no state of its own, which Next keeps in sync with
 * useSearchParams (no reload); passing Next's own history state would skip that sync.
 */
export function useUrlTab<T extends string>(tabs: readonly T[], key = 'tab'): [T, (tab: T) => void] {
  const [requested, setParam] = useUrlParam(key);
  const tab = tabs.find(t => t === requested) ?? tabs[0];
  return [tab, (next: T) => setParam(next === tabs[0] ? '' : next)];
}

/** Any one setting kept in the URL the same way (?season=2025, ?team=u12): '' when absent, and
 *  setting '' removes it. Public list pages use it so a filtered view can be shared and survives Back. */
export function useUrlParam(key: string): [string, (value: string) => void] {
  const value = useSearchParams().get(key) ?? '';
  const setValue = (next: string) => {
    const query = new URLSearchParams(window.location.search);
    if (next) query.set(key, next);
    else query.delete(key);
    const search = query.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  };
  return [value, setValue];
}
