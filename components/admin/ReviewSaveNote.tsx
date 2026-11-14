import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ReviewSaveState } from '@/lib/use-match-reviews';

/** "Saving", "Saved" or a failed save with Try again, for a review that saves as the coach types */
export default function ReviewSaveNote({ state, retry, idle = 'Saves as you type' }: { state: ReviewSaveState; retry: () => void; idle?: string }) {
  return (
    <span className={`rv-status${state === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
      {state === 'saving' && <><Loader2 size={14} aria-hidden="true" className="spin" /> Saving</>}
      {state === 'saved' && <><CheckCircle2 size={14} aria-hidden="true" /> Saved</>}
      {state === 'idle' && idle}
      {state === 'error' && (
        <>
          <AlertTriangle size={14} aria-hidden="true" /> Not saved. Check your connection.
          <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Try again</button>
        </>
      )}
    </span>
  );
}
