'use client';

import { useEffect, useRef } from 'react';
import { takeOpenItemRequest } from './admin-calendar';

/**
 * Opens the item a link asked for ('?open=<id>', e.g. from the admin calendar) once it has loaded:
 * its row (marked data-item-id) is scrolled into view and highlighted, and onOpen runs once.
 */
export function useOpenItem<T extends { id: string }>(items: T[], onOpen: (item: T) => void) {
  // undefined: URL not read yet; null: nothing (more) to open
  const wanted = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (wanted.current === undefined) wanted.current = takeOpenItemRequest();
    const id = wanted.current;
    if (!id) return;
    // Rows can arrive after the page: wait for this one
    const item = items.find(i => i.id === id);
    if (!item) return;
    wanted.current = null;
    onOpen(item);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.add('admin-open-flash');
      window.setTimeout(() => row.classList.remove('admin-open-flash'), 2600);
    });
    // onOpen is read when the item turns up, not a reason to look again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
