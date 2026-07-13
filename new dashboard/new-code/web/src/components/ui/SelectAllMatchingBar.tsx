/**
 * SelectAllMatchingBar — "you've selected the whole page; want every matching
 * record?" affordance for list pages (the missing piece for bulk reassign /
 * bulk status / export across more than one page).
 *
 * Why it's safe + correct here: every list page loads its full result set into
 * memory and paginates CLIENT-SIDE, so "all N matching" is simply every id in
 * `filteredData` — no extra fetch, no server round-trip, no guessing. Selecting
 * them just calls sel.addAll(allMatchingIds); every existing bulk action already
 * reads sel.selectedIds, so nothing downstream changes.
 *
 * Render contract (the bar shows ONLY when it has something to offer):
 *   • Hidden unless the entire current page is selected (pageSelectedCount ===
 *     pageCount) — i.e. the user has clearly opted into "select everything here".
 *   • Hidden when there's only one page (totalMatching <= pageCount) — the page
 *     toggle already covers it.
 *   • "Select all N matching"   → when more matching rows exist beyond the page.
 *   • "All N matching selected" + Clear → once every matching row is selected.
 */

import { CheckCheck } from 'lucide-react';

interface SelectAllMatchingBarProps {
  /** Rows selectable in the current page/view. */
  pageCount: number;
  /** How many of those page rows are currently selected. */
  pageSelectedCount: number;
  /** Total rows matching the active filters (the full client-side set). */
  totalMatching: number;
  /** Total currently selected (across pages). */
  totalSelected: number;
  /** Singular noun for the message, e.g. "lead", "contact". */
  noun?: string;
  /** Plural form when naive "+s" is wrong (e.g. "companies"). Defaults to noun+"s". */
  nounPlural?: string;
  /** Select every matching row (page calls sel.addAll(allMatchingIds)). */
  onSelectAllMatching: () => void;
  /** Clear the whole selection. */
  onClear: () => void;
}

const fmt = (n: number) => n.toLocaleString();

export function SelectAllMatchingBar({
  pageCount,
  pageSelectedCount,
  totalMatching,
  totalSelected,
  noun = 'record',
  nounPlural,
  onSelectAllMatching,
  onClear,
}: SelectAllMatchingBarProps) {
  // Only offer once the whole visible page is selected.
  const wholePageSelected = pageCount > 0 && pageSelectedCount === pageCount;
  if (!wholePageSelected) return null;
  // Single page → nothing more to offer.
  if (totalMatching <= pageCount) return null;

  const allMatchingSelected = totalSelected >= totalMatching;
  const plural = totalMatching === 1 ? noun : (nounPlural ?? `${noun}s`);

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 rounded-md"
      style={{
        background: 'var(--color-brand-light, #E8F2FD)',
        border: '1px solid var(--color-brand, #1A7EE8)',
        color: 'var(--color-gray-700)',
        fontSize: 12.5,
        padding: '7px 12px',
      }}
    >
      <CheckCheck size={14} style={{ color: 'var(--color-brand, #1A7EE8)', flexShrink: 0 }} />
      {allMatchingSelected ? (
        <span>
          All <strong>{fmt(totalMatching)}</strong> matching {plural} are selected.
          <button
            type="button"
            onClick={onClear}
            className="ml-2 font-medium"
            style={{ color: 'var(--color-brand, #1A7EE8)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5 }}
          >
            Clear selection
          </button>
        </span>
      ) : (
        <span>
          All <strong>{fmt(pageSelectedCount)}</strong> on this page are selected.
          <button
            type="button"
            onClick={onSelectAllMatching}
            className="ml-2 font-medium"
            style={{ color: 'var(--color-brand, #1A7EE8)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5 }}
          >
            Select all {fmt(totalMatching)} matching {plural}
          </button>
        </span>
      )}
    </div>
  );
}

export default SelectAllMatchingBar;
