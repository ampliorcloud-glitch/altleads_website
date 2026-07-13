/**
 * useSortPersistence — persist a TanStack Table SortingState per user + entity
 * across page reloads, mirroring the density persistence pattern in
 * `components/ui/useDensity.ts`.
 *
 * Key shape: `altleads:sort:<entity>:<userId>` — identical convention to density
 * (`altleads:density:<entity>:<userId>`), so all list-level UI prefs share one
 * consistent namespace.
 *
 * Initialised from localStorage on first render; written back on every change via
 * the returned `setSorting` setter. Malformed / missing JSON degrades gracefully
 * to the default empty sort (no-sort) rather than crashing.
 *
 * ALT-440 — sort persistence (part 1).
 */

import { useCallback, useState } from 'react';
import type { SortingState } from '@tanstack/react-table';

export function sortKey(entity: string, userId: number | null): string {
  return `altleads:sort:${entity}:${userId ?? 'anon'}`;
}

function loadSort(entity: string, userId: number | null): SortingState {
  try {
    const raw = localStorage.getItem(sortKey(entity, userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Must be a non-empty array of { id: string, desc: boolean } objects.
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).id === 'string' &&
          typeof (item as Record<string, unknown>).desc === 'boolean',
      )
    ) {
      return parsed as SortingState;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Drop-in replacement for `useState<SortingState>([])` that persists the sort
 * to localStorage so it survives a refresh.
 *
 * @param entity  Stable string identifier for the list page (e.g. 'leads').
 * @param userId  The numeric user_id from the auth profile (null → keyed 'anon').
 */
export function useSortPersistence(
  entity: string,
  userId: number | null,
): [SortingState, (updater: SortingState | ((prev: SortingState) => SortingState)) => void] {
  const [sorting, setSortingState] = useState<SortingState>(() =>
    loadSort(entity, userId),
  );

  const setSorting = useCallback(
    (updater: SortingState | ((prev: SortingState) => SortingState)) => {
      setSortingState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem(sortKey(entity, userId), JSON.stringify(next));
        } catch {
          /* ignore storage failures (private mode, quota, SSR) */
        }
        return next;
      });
    },
    [entity, userId],
  );

  return [sorting, setSorting];
}

export default useSortPersistence;
