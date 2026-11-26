'use client';

/** The on/off switch on the admin Emails and Features pages */
export default function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        flexShrink: 0,
        padding: 0,
        width: '48px',
        height: '28px',
        borderRadius: '999px',
        border: '1px solid var(--border-medium)',
        background: checked ? 'var(--club-primary)' : 'color-mix(in oklab, var(--color-ink) 10%, transparent)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '23px' : '3px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'var(--color-print)',
        boxShadow: 'var(--shadow-pop)',
        transition: 'left 0.2s var(--ease-out)',
      }} />
    </button>
  );
}
