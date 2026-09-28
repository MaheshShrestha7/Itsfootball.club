'use client';

import { Moon, Sun } from 'lucide-react';

/** Flips <html data-theme> and remembers it in a cookie, which app/layout.tsx reads on the server
 *  so the next page load paints in the right theme. Which icon shows is decided by CSS (globals.css). */
export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#F3F5F9' : '#070A0F');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark mode"
      title="Switch between light and dark mode"
      className="touch-target"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        flexShrink: 0,
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        background: 'rgba(var(--tint-rgb), 0.04)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        ...style,
      }}
    >
      <Sun size={18} className="theme-icon-light" aria-hidden="true" />
      <Moon size={18} className="theme-icon-dark" aria-hidden="true" />
    </button>
  );
}
