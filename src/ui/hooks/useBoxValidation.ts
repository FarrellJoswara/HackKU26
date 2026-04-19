/**
 * @file Box validation surfacing — `useBoxValidation`.
 *
 * Locked spec (`box_ui_clarified_requirements_7711a010.plan.md`):
 *  - **No live-per-keystroke** validation noise.
 *  - Show row-level nudges on **`blur`** of an amount field, OR after
 *    the **first failed Confirm attempt** (whichever comes first).
 *  - Resetting a row's value should re-arm its blur — i.e. typing
 *    re-hides the nudge until the next blur, so the user is not nagged
 *    while they are actively fixing the row.
 *
 * The hook is intentionally minimal — it returns:
 *   - `shouldShowFor(rowId)` — boolean predicate consumed by row UI;
 *   - `markBlurred(rowId)` — call from `<input onBlur>`;
 *   - `markEditing(rowId)` — call from `<input onChange>` to clear blur;
 *   - `markConfirmAttemptFailed()` — call when Confirm is pressed but
 *     gating is unsatisfied (e.g. zero-based fails);
 *   - `reset()` — call after a successful submit to start fresh.
 */

import { useCallback, useRef, useState } from 'react';
import type { BudgetCategoryId } from '@/core/budgetTypes';

export interface BoxValidationApi {
  shouldShowFor: (rowId: BudgetCategoryId) => boolean;
  markBlurred: (rowId: BudgetCategoryId) => void;
  markEditing: (rowId: BudgetCategoryId) => void;
  markConfirmAttemptFailed: () => void;
  reset: () => void;
  /**
   * True after the first failed Confirm attempt. UI can also surface a
   * banner-level nudge in addition to per-row marks.
   */
  confirmAttempted: boolean;
}

export function useBoxValidation(): BoxValidationApi {
  const [, force] = useState(0);
  // We use a ref-set (not state) for the per-row "blurred" tracker so
  // updating it does not cascade re-renders to every consumer of the
  // hook on every keystroke. Re-render is forced explicitly when the
  // visible state could change (blur added / cleared, confirm attempted).
  const blurred = useRef<Set<BudgetCategoryId>>(new Set());
  const [confirmAttempted, setConfirmAttempted] = useState(false);

  const markBlurred = useCallback((id: BudgetCategoryId) => {
    if (!blurred.current.has(id)) {
      blurred.current.add(id);
      force((n) => n + 1);
    }
  }, []);

  const markEditing = useCallback((id: BudgetCategoryId) => {
    if (blurred.current.has(id)) {
      blurred.current.delete(id);
      force((n) => n + 1);
    }
  }, []);

  const markConfirmAttemptFailed = useCallback(() => {
    setConfirmAttempted(true);
  }, []);

  const shouldShowFor = useCallback(
    (id: BudgetCategoryId) => {
      if (confirmAttempted) return true;
      return blurred.current.has(id);
    },
    [confirmAttempted],
  );

  const reset = useCallback(() => {
    blurred.current.clear();
    setConfirmAttempted(false);
    force((n) => n + 1);
  }, []);

  return {
    shouldShowFor,
    markBlurred,
    markEditing,
    markConfirmAttemptFailed,
    reset,
    confirmAttempted,
  };
}
