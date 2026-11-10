'use client';

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { useDialog } from '@/lib/use-escape-to-close';

/**
 * The panel inside a full-screen popup (UX10-1). Render it only while the popup is open: it
 * tells screen readers it's a dialog, moves focus into it, closes on Escape and gives focus back
 * to the button that opened it.
 */
export default function PopupPanel({ onClose, label, className, style, onClick, children }: {
  onClose: () => void;
  /** What the popup is for, read out by screen readers ("Edit season") */
  label: string;
  className?: string;
  style?: CSSProperties;
  /** e.g. stopPropagation, so a click inside doesn't reach the backdrop */
  onClick?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={className} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
