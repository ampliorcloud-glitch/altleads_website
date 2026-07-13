/**
 * useListKeyboardNav — keyboard-first navigation for any list page.
 *
 * Gives the data team the "feels fast" power-user flow every modern CRM has
 * (Gmail / Linear / HubSpot): move a row cursor with j / k, open the focused
 * row with Enter, toggle-select it with x, jump to search with /, and clear
 * the cursor with Esc — all without touching the mouse.
 *
 * Design / safety:
 *  • ONE document-level keydown listener per mounted list page (only one list
 *    page is mounted at a time, so there's no cross-page conflict).
 *  • It NEVER hijacks typing: it bails the moment the event target is an input,
 *    textarea, select or contentEditable, and it ignores any combo with
 *    Cmd/Ctrl/Alt — so the Cmd-K palette, the "?" help overlay, cell editing
 *    and browser shortcuts all keep working untouched.
 *  • Enter / x / Esc only act when a row is actually focused, so they fall
 *    through to their normal behaviour the rest of the time.
 *  • `enabled:false` pauses navigation (e.g. while a preview panel / modal is
 *    open) so j/k don't move the list underneath an open record.
 *
 * Wiring (per page): give it the CURRENTLY VISIBLE rows, an id accessor, and
 * the open / toggle-select callbacks the page already has. Render each row with
 * `data-rowid={id}` (so the focused row can be scrolled into view) and paint a
 * focus accent when `focusedId === id`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type ListRowId = string | number;

export interface ListKeyboardNavOptions<Row> {
  /** The rows currently visible (after filters + the current page of pagination). */
  rows: Row[];
  /** Stable id for a row (also used as the `data-rowid` for scroll-into-view). */
  getId: (row: Row) => ListRowId;
  /** Open the focused row (Enter) — usually the page's `setPreviewId`. */
  onOpen: (row: Row) => void;
  /** Toggle selection of the focused row (x). Optional. */
  onToggleSelect?: (row: Row) => void;
  /** Search input to focus on `/`. A plain ref object — avoids React-version ref typing churn. */
  searchInputRef?: { current: HTMLInputElement | null };
  /** When false, all navigation keys are ignored (e.g. a preview/modal is open). Default true. */
  enabled?: boolean;
}

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

export function useListKeyboardNav<Row>(opts: ListKeyboardNavOptions<Row>): {
  focusedId: ListRowId | null;
  setFocusedId: (id: ListRowId | null) => void;
} {
  const [focusedId, setFocusedId] = useState<ListRowId | null>(null);

  // Keep the latest props in a ref so the listener is bound ONCE, never stale.
  const latest = useRef(opts);
  latest.current = opts;
  const focusedRef = useRef<ListRowId | null>(focusedId);
  focusedRef.current = focusedId;

  // If the focused row disappears (filter / page change), drop the cursor.
  useEffect(() => {
    const id = focusedRef.current;
    if (id == null) return;
    if (!opts.rows.some((r) => opts.getId(r) === id)) setFocusedId(null);
  }, [opts.rows, opts]);

  const move = useCallback((delta: number) => {
    const { rows, getId } = latest.current;
    if (rows.length === 0) return;
    const cur = focusedRef.current;
    const idx = cur == null ? -1 : rows.findIndex((r) => getId(r) === cur);
    let next = idx === -1 ? (delta > 0 ? 0 : rows.length - 1) : idx + delta;
    next = Math.max(0, Math.min(rows.length - 1, next));
    const id = getId(rows[next]);
    setFocusedId(id);
    requestAnimationFrame(() => {
      const node = document.querySelector(`[data-rowid="${String(id)}"]`);
      if (node) (node as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const o = latest.current;
      if (o.enabled === false) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const cur = focusedRef.current;
      const focusedRow =
        cur == null ? undefined : o.rows.find((r) => o.getId(r) === cur);

      switch (e.key) {
        case 'j':
          move(1);
          e.preventDefault();
          break;
        case 'k':
          move(-1);
          e.preventDefault();
          break;
        case 'Enter':
          if (focusedRow) {
            o.onOpen(focusedRow);
            e.preventDefault();
          }
          break;
        case 'x':
          if (focusedRow && o.onToggleSelect) {
            o.onToggleSelect(focusedRow);
            e.preventDefault();
          }
          break;
        case '/': {
          const input = o.searchInputRef?.current;
          if (input) {
            input.focus();
            input.select();
            e.preventDefault();
          }
          break;
        }
        case 'Escape':
          if (cur != null) {
            setFocusedId(null);
            e.preventDefault();
          }
          break;
        default:
          break;
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [move]);

  return { focusedId, setFocusedId };
}

export default useListKeyboardNav;
