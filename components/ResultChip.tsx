import type { ClubOutcome } from '@/lib/fixtures';
import { OUTCOME_LABEL } from '@/lib/fixtures';

/** W / D / L in a small square: green, grey or red, with the word for screen readers */
export default function ResultChip({ outcome, size = 'sm' }: { outcome: ClubOutcome; size?: 'sm' | 'md' }) {
  const cls = outcome === 'W' ? 'win' : outcome === 'L' ? 'loss' : 'draw';
  return (
    <span className={`result-chip result-chip-${cls}${size === 'md' ? ' result-chip-md' : ''}`} title={OUTCOME_LABEL[outcome]}>
      <span aria-hidden="true">{outcome}</span>
      <span className="sr-only">{OUTCOME_LABEL[outcome]}</span>
    </span>
  );
}
