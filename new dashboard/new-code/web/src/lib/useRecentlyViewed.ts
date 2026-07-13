/**
 * useRecentlyViewed — track recently-opened detail-page records and surface
 * them in the Cmd-K command palette as a "jump back" shortcut.
 *
 * Key shape: `altleads:recent:<userId>` (matching the existing namespace
 * `altleads:sort:<entity>:<userId>`, `altleads:pin:<entity>:<userId>`, etc.).
 * Falls back to `altleads:recent:anon` when no user id is known.
 *
 * Keeps the 8 most-recently-visited records (most-recent-first), de-duped by
 * type+id. JSON parse errors degrade gracefully — no crash, just an empty list.
 *
 * ALT-??? — UX-Audit §5 "No recently viewed records" gap.
 */

export interface RecentItem {
  /** Entity type: 'lead' | 'company' | 'contact' | 'meeting' | 'wishlist' */
  type: string;
  /** Record id (numeric or string). Stored as string for uniformity. */
  id: string;
  /** Human-readable label shown in the palette. */
  label: string;
  /** React-Router route to navigate to when selected. */
  route: string;
  /** Unix-ms timestamp of when this record was last viewed (for ordering). */
  viewedAt: number;
}

const MAX_RECENT = 8;

function recentKey(userId?: string | number | null): string {
  return `altleads:recent:${userId != null ? String(userId) : 'anon'}`;
}

/** Read the stored recents list from localStorage (safe, never throws). */
export function getRecent(userId?: string | number | null): RecentItem[] {
  try {
    const raw = localStorage.getItem(recentKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation — discard malformed entries rather than crashing.
    return (parsed as unknown[]).filter(
      (x): x is RecentItem =>
        x !== null &&
        typeof x === 'object' &&
        typeof (x as Record<string, unknown>).type === 'string' &&
        typeof (x as Record<string, unknown>).id === 'string' &&
        typeof (x as Record<string, unknown>).label === 'string' &&
        typeof (x as Record<string, unknown>).route === 'string' &&
        typeof (x as Record<string, unknown>).viewedAt === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Record a page visit.  Call this inside a `useEffect` once the record is
 * loaded.  De-dupes by type+id (moves existing entry to front), then caps
 * the list at `MAX_RECENT`.
 */
export function pushRecent(
  item: Pick<RecentItem, 'type' | 'id' | 'label' | 'route'>,
  userId?: string | number | null,
): void {
  try {
    const key = recentKey(userId);
    const prev = getRecent(userId);
    // Remove any existing entry for the same type+id.
    const filtered = prev.filter((r) => !(r.type === item.type && r.id === item.id));
    // Prepend the new entry and cap.
    const next: RecentItem[] = [
      { ...item, id: String(item.id), viewedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore storage failures (private mode / quota) */
  }
}

/**
 * React hook — returns the current recents list (re-reads from localStorage on
 * mount so it reflects visits from other tabs or sessions).  The list is static
 * after mount; no polling.  Re-mounts (e.g. palette opens) refresh it.
 */
import { useState, useEffect } from 'react';

export function useRecentlyViewed(userId?: string | number | null): RecentItem[] {
  const [recents, setRecents] = useState<RecentItem[]>([]);

  useEffect(() => {
    setRecents(getRecent(userId));
  }, [userId]);

  return recents;
}

export default useRecentlyViewed;
