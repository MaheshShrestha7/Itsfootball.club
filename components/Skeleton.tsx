import type { CSSProperties } from 'react';

/** A glass placeholder block that shimmers while data loads (.skeleton in globals.css) */
export function Skeleton({ style }: { style?: CSSProperties }) {
  return <div className="skeleton" aria-hidden="true" style={style} />;
}

/** Page-shaped placeholder: keeps the layout steady while the data arrives, instead of a spinner */
export function PageSkeleton({ label, kind = 'page' }: { label: string; kind?: 'page' | 'match' }) {
  return (
    <div role="status" className="container" style={{ padding: '2rem 1rem 4rem', maxWidth: kind === 'match' ? '960px' : undefined }}>
      <span className="sr-only">{label}</span>
      {kind === 'match' ? (
        <>
          <Skeleton style={{ height: 260, borderRadius: 'var(--radius-xl)', marginBottom: '2rem' }} />
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {[110, 90, 80].map(w => <Skeleton key={w} style={{ height: 22, width: w }} />)}
          </div>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} style={{ height: 56, marginBottom: '0.75rem' }} />)}
        </>
      ) : (
        <>
          <Skeleton style={{ height: 'min(52vh, 420px)', borderRadius: 'var(--radius-xl)', marginBottom: '2rem' }} />
          <Skeleton style={{ height: 28, width: 220, marginBottom: '1.25rem' }} />
          <div className="grid-responsive-3">
            {[0, 1, 2].map(i => <Skeleton key={i} style={{ height: 150 }} />)}
          </div>
        </>
      )}
    </div>
  );
}
