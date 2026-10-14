import { Check, ExternalLink, Minus, X } from 'lucide-react';
import type { Cell, Source } from '@/lib/competitors';

const MARK = {
  yes: { Icon: Check, color: 'var(--c-green)', label: 'Yes' },
  part: { Icon: Minus, color: 'var(--c-amber)', label: 'Partly' },
  no: { Icon: X, color: 'var(--c-red)', label: 'No' },
  info: { Icon: null, color: 'var(--text-muted)', label: '' },
} as const;

/** One comparison cell: a mark, the text and a small link to the competitor page it came from. */
export default function CellView({ cell, sources = [] }: { cell: Cell; sources?: Source[] }) {
  const { Icon, color, label } = MARK[cell.mark];
  const source = cell.source !== undefined ? sources[cell.source] : undefined;
  return (
    <span className="vs-cell">
      {Icon && <span className="vs-mark" style={{ color, borderColor: color }} aria-label={label}><Icon size={14} strokeWidth={3} /></span>}
      <span>
        {cell.text}
        {source && <SourceLink source={source} />}
      </span>
    </span>
  );
}

export function SourceLink({ source }: { source: Source }) {
  return (
    <a href={source.url} target="_blank" rel="nofollow noopener" className="vs-ref" title={`Source: ${source.title}`} aria-label={`Source: ${source.title}`}>
      <ExternalLink size={11} />
    </a>
  );
}
