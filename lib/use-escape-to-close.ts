'use client';

import { useEffect, useRef } from 'react';

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

/**
 * For a popup (role="dialog"): Escape closes it, focus moves into it when it opens (the first
 * field or button, or the panel itself) and goes back to what had it when it closes.
 * Put the returned ref on the dialog element.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // A confirm dialog opened on top (native <dialog>) handles its own Escape
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close.current();
    };
    window.addEventListener('keydown', onKey);
    const focusIn = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || el.contains(document.activeElement)) return;
      const first = el.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
        || el.querySelector<HTMLElement>('button:not([disabled]), [href]');
      if (first) first.focus();
      else {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
        el.focus();
      }
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(focusIn);
      if (before && document.contains(before)) before.focus();
    };
  }, [open]);

  return ref;
}
