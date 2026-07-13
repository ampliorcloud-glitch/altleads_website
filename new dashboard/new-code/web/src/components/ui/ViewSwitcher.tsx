/**
 * ViewSwitcher — a small segmented control to switch a list page between view
 * modes (Table / Grid today; Kanban / Calendar can be appended later).
 *
 * Token-styled to sit beside the other toolbar buttons (Columns / Export).
 * Built to be extensible: pass a custom `options` array to add more modes — the
 * control simply renders one segment per option and highlights the active one.
 *
 * Props:
 *   value    the active view key (e.g. 'table' | 'grid')
 *   onChange called with the next view key when a segment is clicked
 *   options  optional segment list; defaults to Table + Grid
 */

import React, { useCallback, useState } from 'react';
import { List, LayoutGrid, KanbanSquare } from 'lucide-react';

export type ViewKey = string;

export interface ViewOption {
  key: ViewKey;
  label: string;
  icon: React.ReactNode;
}

/** Default options — Table + Grid + Kanban. Extend by passing your own `options`. */
export const DEFAULT_VIEW_OPTIONS: ViewOption[] = [
  { key: 'table', label: 'Table', icon: <List size={15} /> },
  { key: 'grid', label: 'Grid', icon: <LayoutGrid size={15} /> },
  { key: 'kanban', label: 'Kanban', icon: <KanbanSquare size={15} /> },
];

/* ------------------------------------------------------------------ */
/*  Per-user, per-entity view-mode persistence (localStorage)          */
/* ------------------------------------------------------------------ */

/**
 * Persist the chosen view mode per user + entity. The DB-backed `user_view_pref`
 * table is reserved for column layouts; the lightweight view-mode toggle uses
 * localStorage keyed by user + entity so each user keeps their preferred view of
 * each module without a round-trip. Falls back to `fallback` when nothing is
 * stored (or when storage is unavailable, e.g. SSR / privacy mode).
 *
 * Key shape: `altleads:view:<entity>:<userId>`.
 */
export function viewModeKey(entity: string, userId: number | null): string {
  return `altleads:view:${entity}:${userId ?? 'anon'}`;
}

export function useViewMode(
  entity: string,
  userId: number | null,
  fallback: ViewKey = 'table',
): [ViewKey, (next: ViewKey) => void] {
  const key = viewModeKey(entity, userId);
  const [view, setView] = useState<ViewKey>(() => {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const update = useCallback(
    (next: ViewKey) => {
      setView(next);
      try {
        localStorage.setItem(viewModeKey(entity, userId), next);
      } catch {
        /* ignore storage failures */
      }
    },
    [entity, userId],
  );
  return [view, update];
}

interface Props {
  value: ViewKey;
  onChange: (next: ViewKey) => void;
  options?: ViewOption[];
}

export function ViewSwitcher({ value, onChange, options = DEFAULT_VIEW_OPTIONS }: Props) {
  return (
    <div
      role="group"
      aria-label="Switch view"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 32,
        padding: 2,
        gap: 2,
        background: '#F3F4F6',
        border: '1px solid #d4d4d8',
        borderRadius: 7,
      }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            aria-label={`${opt.label} view`}
            title={`${opt.label} view`}
            onClick={() => { if (!active) onChange(opt.key); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 26,
              width: 28,
              padding: 0,
              border: 'none',
              borderRadius: 5,
              background: active ? '#fff' : 'transparent',
              color: active ? '#1A7EE8' : '#6b7280',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              cursor: active ? 'default' : 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}

export default ViewSwitcher;
