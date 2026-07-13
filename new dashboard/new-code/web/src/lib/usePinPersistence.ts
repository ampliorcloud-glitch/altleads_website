/**
 * usePinPersistence — persist a TanStack Table ColumnPinningState per user + entity
 * across page reloads, mirroring the sort persistence pattern in
 * `lib/useSortPersistence.ts`.
 *
 * Key shape: `altleads:pin:<entity>:<userId>` — identical convention to sort
 * (`altleads:sort:<entity>:<userId>`) and density (`altleads:density:<entity>:<userId>`),
 * so all list-level UI prefs share one consistent namespace.
 *
 * Initialised from localStorage on first render; written back on every change via
 * the returned `setColumnPinning` setter. Malformed / missing JSON degrades gracefully
 * to the default empty pinning state rather than crashing.
 *
 * ALT-440 — column pinning (left-freeze).
 */

import { useCallback, useState } from 'react';
import type { ColumnPinningState } from '@tanstack/react-table';

const EMPTY_PINNING: ColumnPinningState = { left: [], right: [] };

export function pinKey(entity: string, userId: number | null): string {
  return `altleads:pin:${entity}:${userId ?? 'anon'}`;
}

function loadPin(entity: string, userId: number | null): ColumnPinningState {
  try {
    const raw = localStorage.getItem(pinKey(entity, userId));
    if (!raw) return { ...EMPTY_PINNING };
    const parsed: unknown = JSON.parse(raw);
    // Must be an object with `left` and `right` string arrays.
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).left) &&
      Array.isArray((parsed as Record<string, unknown>).right) &&
      ((parsed as Record<string, unknown>).left as unknown[]).every((x) => typeof x === 'string') &&
      ((parsed as Record<string, unknown>).right as unknown[]).every((x) => typeof x === 'string')
    ) {
      return {
        left: (parsed as { left: string[]; right: string[] }).left,
        right: (parsed as { left: string[]; right: string[] }).right,
      };
    }
    return { ...EMPTY_PINNING };
  } catch {
    return { ...EMPTY_PINNING };
  }
}

/**
 * Drop-in replacement for `useState<ColumnPinningState>({ left: [], right: [] })`
 * that persists the pinning state to localStorage so it survives a refresh.
 *
 * @param entity  Stable string identifier for the list page (e.g. 'leads').
 * @param userId  The numeric user_id from the auth profile (null → keyed 'anon').
 */
export function usePinPersistence(
  entity: string,
  userId: number | null,
): [ColumnPinningState, (updater: ColumnPinningState | ((prev: ColumnPinningState) => ColumnPinningState)) => void] {
  const [columnPinning, setColumnPinningState] = useState<ColumnPinningState>(() =>
    loadPin(entity, userId),
  );

  const setColumnPinning = useCallback(
    (updater: ColumnPinningState | ((prev: ColumnPinningState) => ColumnPinningState)) => {
      setColumnPinningState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try {
          localStorage.setItem(pinKey(entity, userId), JSON.stringify(next));
        } catch {
          /* ignore storage failures (private mode, quota, SSR) */
        }
        return next;
      });
    },
    [entity, userId],
  );

  return [columnPinning, setColumnPinning];
}

export default usePinPersistence;
