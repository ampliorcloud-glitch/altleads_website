/**
 * useRowSelection — generic multi-row selection state for list/table pages.
 *
 * Returns a stable API for tracking a Set of selected ids (string | number).
 *
 *   const sel = useRowSelection<number>();
 *   sel.toggle(id)             // add/remove one id
 *   sel.isSelected(id)         // boolean
 *   sel.toggleAll(visibleIds)  // select all if not all selected, else clear those
 *   sel.addAll(matchingIds)    // add every id (never clears) — "Select all N matching"
 *   sel.allSelected(visibleIds)// true when every id in the list is selected
 *   sel.clear()                // deselect everything
 *   sel.selectedIds            // Set<Id>
 *   sel.count                  // selectedIds.size
 */

import { useCallback, useMemo, useState } from 'react';

export type SelectableId = string | number;

export interface RowSelection<Id extends SelectableId = SelectableId> {
  selectedIds: Set<Id>;
  isSelected: (id: Id) => boolean;
  toggle: (id: Id) => void;
  toggleAll: (ids: Id[]) => void;
  /** Add every supplied id to the selection (never deselects) — powers
   *  "Select all N matching" where the page-level toggle would otherwise cap
   *  the selection at the current page. */
  addAll: (ids: Id[]) => void;
  clear: () => void;
  allSelected: (ids: Id[]) => boolean;
  count: number;
}

export function useRowSelection<Id extends SelectableId = SelectableId>(): RowSelection<Id> {
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set<Id>());

  const isSelected = useCallback((id: Id) => selectedIds.has(id), [selectedIds]);

  const toggle = useCallback((id: Id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = useCallback(
    (ids: Id[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds],
  );

  const toggleAll = useCallback((ids: Id[]) => {
    setSelectedIds((prev) => {
      const everySelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (everySelected) {
        // Clear only the supplied ids (preserve any off-screen selections).
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const addAll = useCallback((ids: Id[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set<Id>()), []);

  const count = selectedIds.size;

  return useMemo(
    () => ({ selectedIds, isSelected, toggle, toggleAll, addAll, clear, allSelected, count }),
    [selectedIds, isSelected, toggle, toggleAll, addAll, clear, allSelected, count],
  );
}
