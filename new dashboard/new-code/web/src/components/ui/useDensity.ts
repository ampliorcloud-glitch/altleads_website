/**
 * useDensity — a tiny hook to persist a list's row DENSITY per user + entity.
 *
 * Mirrors `useViewMode` (ViewSwitcher.tsx): density is a lightweight per-user UI
 * preference, so it lives in localStorage keyed by user + entity (no DB round-trip)
 * rather than the DB-backed `user_view_pref` table (reserved for column layouts).
 *
 * 'comfortable' (default) keeps today's roomy rows; 'compact' packs ~40% more rows
 * on screen — the "feels built for pros" win.
 *
 * Key shape: `altleads:density:<entity>:<userId>`.
 */

import { useCallback, useState } from 'react';

export type Density = 'comfortable' | 'compact';

export interface DensityMetrics {
  /** Row height in px (drives the table row height + its CSS height transition). */
  rowHeight: number;
  /** Vertical cell padding in px (top & bottom). */
  cellPaddingY: number;
  /** Optional cell font-size in px. */
  fontSize?: number;
}

/** Map a density to the concrete numbers the table renders with. */
export function getDensityMetrics(density: Density): DensityMetrics {
  return density === 'compact'
    ? { rowHeight: 32, cellPaddingY: 4, fontSize: 12 }
    : { rowHeight: 44, cellPaddingY: 0, fontSize: 13 };
}

export function densityKey(entity: string, userId: number | null): string {
  return `altleads:density:${entity}:${userId ?? 'anon'}`;
}

export function useDensity(
  entity: string,
  userId: number | null,
  fallback: Density = 'comfortable',
): [Density, (next: Density) => void] {
  const key = densityKey(entity, userId);
  const [density, setDensity] = useState<Density>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === 'compact' || stored === 'comfortable' ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (next: Density) => {
      setDensity(next);
      try {
        localStorage.setItem(densityKey(entity, userId), next);
      } catch {
        /* ignore storage failures (SSR / privacy mode) */
      }
    },
    [entity, userId],
  );
  return [density, update];
}

export default useDensity;
