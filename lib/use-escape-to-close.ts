'use client';

import { useEffect } from 'react';

/** Closes an open drawer / menu when Escape is pressed: calls setOpen(false) while `open` */
export function useEscapeToClose(open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
}
