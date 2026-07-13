/**
 * ColumnCustomizer — popover to toggle column visibility, reorder columns, and
 * save / reset a per-user view (wired to data/views.ts).
 *
 * On mount it loads the user's active saved view for `entity` and, if found,
 * applies it via onChange (merging against allColumns so newly-added columns are
 * appended and removed columns are dropped). "Save view" persists the current
 * value; "Reset" deactivates the saved view and restores defaults from
 * allColumns.
 *
 * The parent owns the `value: ColumnPref[]` state (key + visible, in display
 * order) and re-renders its table from it.
 *
 * Props:
 *   entity      view scope key (e.g. 'contacts', 'companies')
 *   userId      numeric user_id (null disables save/reset persistence)
 *   allColumns  { key, header, defaultVisible? }[] — the full catalogue
 *   value       current ColumnPref[] (parent state)
 *   onChange    called with the next ColumnPref[]
 */

import React, { useEffect, useRef, useState } from 'react';
import { Settings2, ChevronUp, ChevronDown, Check, Save, RotateCcw, Pin, PinOff } from 'lucide-react';
import type { ColumnDef } from './columns';
import type { ColumnPinningState } from '@tanstack/react-table';
import {
  getActiveView,
  saveView,
  resetView,
  type ColumnPref,
} from '../../data/views';

interface Props {
  entity: string;
  userId: number | null;
  allColumns: ColumnDef[];
  value: ColumnPref[];
  onChange: (next: ColumnPref[]) => void;
  /** Current column pinning state (optional — if absent, pin controls are hidden). */
  columnPinning?: ColumnPinningState;
  /** Called when user toggles pin for a column (optional — pair with columnPinning). */
  onColumnPinningChange?: (pinning: ColumnPinningState) => void;
}

/** Build the default ColumnPref[] from a column catalogue (in catalogue order). */
export function defaultColumnPrefs(allColumns: ColumnDef[]): ColumnPref[] {
  return allColumns.map((c) => ({ key: c.key, visible: c.defaultVisible !== false }));
}

/**
 * Reconcile a saved/parent ColumnPref[] against the current catalogue: keep
 * known columns in their saved order, drop unknown keys, and append any new
 * catalogue columns (using their default visibility) at the end.
 */
export function reconcileColumns(prefs: ColumnPref[], allColumns: ColumnDef[]): ColumnPref[] {
  const known = new Map(allColumns.map((c) => [c.key, c]));
  const seen = new Set<string>();
  const kept: ColumnPref[] = [];
  for (const p of prefs) {
    if (known.has(p.key) && !seen.has(p.key)) {
      kept.push({ key: p.key, visible: p.visible !== false });
      seen.add(p.key);
    }
  }
  for (const c of allColumns) {
    if (!seen.has(c.key)) kept.push({ key: c.key, visible: c.defaultVisible !== false });
  }
  return kept;
}

export function ColumnCustomizer({ entity, userId, allColumns, value, onChange, columnPinning, onColumnPinningChange }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const headerByKey = new Map(allColumns.map((c) => [c.key, c.header]));

  // Load the active saved view once on mount and apply it.
  useEffect(() => {
    let cancelled = false;
    getActiveView(entity, userId).then((view) => {
      if (cancelled || !view) return;
      onChange(reconcileColumns(view.columns, allColumns));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, userId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleVisible(key: string) {
    onChange(value.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  function togglePin(key: string) {
    if (!columnPinning || !onColumnPinningChange) return;
    const isPinned = columnPinning.left?.includes(key) ?? false;
    onColumnPinningChange({
      ...columnPinning,
      left: isPinned
        ? (columnPinning.left ?? []).filter((k) => k !== key)
        : [...(columnPinning.left ?? []), key],
    });
  }

  async function handleSave() {
    setBusy(true);
    setNote(null);
    const { error } = await saveView(entity, userId, value);
    setBusy(false);
    setNote(error ? `Save failed: ${error}` : 'View saved.');
  }

  async function handleReset() {
    setBusy(true);
    setNote(null);
    const { error } = await resetView(entity, userId);
    setBusy(false);
    if (error) {
      setNote(`Reset failed: ${error}`);
      return;
    }
    onChange(defaultColumnPrefs(allColumns));
    setNote('Reset to defaults.');
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 12px',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
    height: 32,
  };

  const iconBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: 2,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" style={btnStyle} onClick={() => setOpen((o) => !o)}>
        <Settings2 size={14} /> Columns
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d4d4d8',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            width: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #f3f4f6',
              fontSize: 13,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            Customize columns
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
            {value.map((col, idx) => (
              <div
                key={col.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleVisible(col.key)}
                  title={col.visible ? 'Hide column' : 'Show column'}
                  aria-label={col.visible ? 'Hide column' : 'Show column'}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: `1px solid ${col.visible ? '#1A7EE8' : '#d4d4d8'}`,
                    background: col.visible ? '#1A7EE8' : '#fff',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {col.visible && <Check size={12} />}
                </button>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: col.visible ? '#18181b' : '#9ca3af',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {headerByKey.get(col.key) ?? col.key}
                </span>
                {columnPinning && onColumnPinningChange && (
                  (() => {
                    const isPinned = columnPinning.left?.includes(col.key) ?? false;
                    return (
                      <button
                        type="button"
                        onClick={() => togglePin(col.key)}
                        title={isPinned ? 'Unpin column' : 'Pin column to left'}
                        aria-label={isPinned ? 'Unpin column' : 'Pin column to left'}
                        style={{
                          ...iconBtn,
                          color: isPinned ? '#1A7EE8' : '#9ca3af',
                        }}
                      >
                        {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                      </button>
                    );
                  })()
                )}
                <button
                  type="button"
                  style={{ ...iconBtn, opacity: idx === 0 ? 0.3 : 1 }}
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  title="Move up"
                  aria-label="Move up"
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  style={{ ...iconBtn, opacity: idx === value.length - 1 ? 0.3 : 1 }}
                  disabled={idx === value.length - 1}
                  onClick={() => move(idx, 1)}
                  title="Move down"
                  aria-label="Move down"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
            ))}
          </div>

          {note && (
            <div style={{ padding: '6px 14px', fontSize: 11, color: '#6b7280' }}>{note}</div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 14px',
              borderTop: '1px solid #f3f4f6',
            }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || userId == null}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                padding: '7px 10px',
                border: 'none',
                borderRadius: 6,
                background: busy || userId == null ? '#93c5fd' : '#1A7EE8',
                color: '#fff',
                cursor: busy || userId == null ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={13} /> Save view
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                padding: '7px 12px',
                border: '1px solid #d4d4d8',
                borderRadius: 6,
                background: '#fff',
                color: '#374151',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
