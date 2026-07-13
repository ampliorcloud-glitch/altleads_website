/**
 * useListFilters — drop-in replacement for `useState<Filters>(defaultFilters)`
 * that persists a list page's filter/search state to localStorage so it SURVIVES
 * a page refresh (and returning to the module later in the same browser).
 *
 * Why this exists: the team filters a list, opens a record, hits back / refreshes
 * — and every filter was gone. Industry CRMs (HubSpot, Zoho) remember the last
 * filter set per list; this brings that here without any server round-trip.
 *
 * Design choices that keep it safe:
 *  • Keyed by ENTITY ONLY (`altleads:filters:<entity>`), NOT by userId. localStorage
 *    is already per-browser, and keying by a userId that resolves asynchronously
 *    creates a race where the default-initialised state overwrites the saved set
 *    before it can load. Filter prefs are non-sensitive view state (cities,
 *    statuses) and the row-level RLS still governs what data actually loads, so
 *    per-browser persistence is the correct, race-free choice.
 *  • Loaded values are MERGED OVER the current defaults ({ ...defaults, ...saved }),
 *    so adding a new filter field later never breaks an old saved blob — the new
 *    field simply takes its default.
 *  • Every storage call is wrapped — private mode / disabled storage degrades to
 *    plain in-memory state (same as before this hook existed).
 *
 * The returned tuple is identical to useState, so callers keep using setFilters
 * exactly as before (functional updates and `setFilters(defaultFilters)` to clear
 * both work — clearing simply persists the default set).
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function filtersKey(entity: string): string {
  return `altleads:filters:${entity}`;
}

/**
 * Free-text filter keys that must NOT be persisted (ALT-373). localStorage
 * SURVIVES LOGOUT, and a user can type anything into a search box — including a
 * phone number or email while looking someone up — so persisting it would leak
 * PII to the next user on a shared device. The facet filters (cities, statuses,
 * owners, date ranges, etc.) are non-sensitive view state and are still
 * persisted. On load these keys are dropped, so search always starts empty.
 */
const NON_PERSISTED_KEYS = new Set(['search', 'q', 'query', 'searchTerm', 'keyword']);

/** Return a shallow copy of `filters` without the free-text (PII-prone) keys. */
function stripFreeText<T extends object>(filters: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (!NON_PERSISTED_KEYS.has(k)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Read the saved filters for an entity, merged over `fallback`. */
export function loadPersistedFilters<T extends object>(entity: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(filtersKey(entity));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Drop any free-text keys an older blob may still hold, then merge over
      // defaults so `search` (and friends) always restore to their default/empty.
      return { ...fallback, ...stripFreeText(parsed as Partial<T>) };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function useListFilters<T extends object>(
  entity: string,
  defaultFilters: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [filters, setFilters] = useState<T>(() => loadPersistedFilters(entity, defaultFilters));

  // Persist on every change (including "Clear filters", which sets defaults).
  // Free-text keys (search/query/...) are stripped first so no typed PII (a
  // phone/email looked up in the search box) is written to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(filtersKey(entity), JSON.stringify(stripFreeText(filters)));
    } catch {
      /* ignore storage failures (private mode, quota, SSR) */
    }
  }, [entity, filters]);

  return [filters, setFilters];
}

export default useListFilters;
