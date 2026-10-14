import { Check, Minus, X } from 'lucide-react';
import type { Cell } from '@/lib/competitors';

const MARK = {
  yes: { Icon: Check, color: 'var(--c-green)', label: 'Yes' },
  part: { Icon: Minus, color: 'var(--c-amber)', label: 'Partly' },
  no: { Icon: X, color: 'var(--c-red)', label: 'No' },
  info: { Icon: null, color: 'var(--text-muted)', label: '' },
} as const;

/** One comparison cell: a mark, the text and its source number. `sourceOffset` shifts the number when several
 *  competitors share one numbered source list (the all-in-one table on /vs). */
export default function CellView({ cell, sourceOffset = 0 }: { cell: Cell; sourceOffset?: number }) {
  const { Icon, color, label } = MARK[cell.mark];
  return (
    <span className="vs-cell">
      {Icon && <span className="vs-mark" style={{ color, borderColor: color }} aria-label={label}><Icon size={14} strokeWidth={3} /></span>}
      <span>
        {cell.text}
        {cell.source !== undefined && (
          <sup><a href={`#source-${cell.source + sourceOffset + 1}`} className="vs-ref">[{cell.source + sourceOffset + 1}]</a></sup>
        )}
      </span>
    </span>
  );
}
