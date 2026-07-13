/**
 * ViewPicker — toolbar dropdown to list / save / load / delete named saved views.
 *
 * ALT-270 · v1 (2026-06-28)
 *
 * Only rendered when ADVANCED_FILTERS is true.
 *
 * UX flow:
 *   • A "Views" button with a chevron opens a dropdown listing saved views.
 *   • Clicking a view name applies it (sets filter, sort, columns, density, view_mode).
 *   • A "Save current as…" option opens an inline modal to name and save the view.
 *   • Each row has: star (set/unset default), edit name (TODO v2), delete.
 *   • The active view name is shown on the button if one is loaded.
 *
 * Integration:
 *   The parent page passes the full current state (filters, sort, columns, etc.)
 *   and an onApply callback. ViewPicker handles its own DB calls internally.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Bookmark, Star, Trash2, Plus, Check } from 'lucide-react';
import {
  listSavedViews,
  createSavedView,
  deleteSavedView,
  setDefaultView,
  unsetDefaultView,
  type SavedViewRecord,
  type SavedViewPayload,
  type SortStateLite,
} from '../../data/savedViews';
import type { AdvancedFilterState } from '../../lib/filterEngine';
import type { ColumnPref } from '../../data/views';

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------

export interface ViewPickerApplyPayload {
  filter_state: AdvancedFilterState | null;
  sort_state: SortStateLite[] | null;
  column_prefs: ColumnPref[] | null;
  density: 'comfortable' | 'compact' | null;
  page_size: 25 | 50 | 100 | null;
  view_mode: 'table' | 'grid' | 'kanban' | null;
}

interface ViewPickerProps {
  entity: string;
  userId: number | null;
  projectId: number | null;
  /** Current state to capture when saving a view. */
  currentState: SavedViewPayload;
  /** The id of the currently active view (null = no saved view active). */
  activeViewId: number | null;
  /** Called when the user selects a saved view (apply it). */
  onApply: (view: SavedViewRecord) => void;
  /** Called after a view is saved or deleted to notify the page. */
  onViewsChange?: () => void;
}

// -----------------------------------------------------------------------
// ViewPicker
// -----------------------------------------------------------------------

export function ViewPicker({
  entity,
  userId,
  projectId,
  currentState,
  activeViewId,
  onApply,
  onViewsChange,
}: ViewPickerProps) {
  const [open, setOpen]       = useState(false);
  const [views, setViews]     = useState<SavedViewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');

  const ref = useRef<HTMLDivElement>(null);

  // ── Load views when the dropdown opens ──────────────────────────────
  const loadViews = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    const rows = await listSavedViews(userId, entity, projectId);
    setViews(rows);
    setLoading(false);
  }, [userId, entity, projectId]);

  useEffect(() => {
    if (open) void loadViews();
  }, [open, loadViews]);

  // ── Close on outside click / Escape ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSave(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowSave(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Save current view ────────────────────────────────────────────────
  const handleSave = async () => {
    const name = newName.trim();
    if (!name) { setNameError('Name is required.'); return; }
    if (userId == null) return;

    // Duplicate-name guard (warn before the DB unique constraint fires)
    if (views.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setNameError('A view with this name already exists in this scope.');
      return;
    }

    setSaving(true);
    setNameError('');
    setSaveError('');

    const { error } = await createSavedView(userId, entity, projectId, {
      ...currentState,
      name,
    });

    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setNewName('');
    setShowSave(false);
    void loadViews();
    onViewsChange?.();
  };

  // ── Delete a view ────────────────────────────────────────────────────
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await deleteSavedView(id);
    if (error) { console.error('[ViewPicker] delete error', error); return; }
    setViews((prev) => prev.filter((v) => v.id !== id));
    onViewsChange?.();
  };

  // ── Toggle default ───────────────────────────────────────────────────
  const handleToggleDefault = async (view: SavedViewRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId == null) return;
    if (view.is_default) {
      await unsetDefaultView(view.id);
    } else {
      await setDefaultView(userId, entity, projectId, view.id);
    }
    void loadViews();
    onViewsChange?.();
  };

  const activeView = views.find((v) => v.id === activeViewId);

  // ── Styles ───────────────────────────────────────────────────────────
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    fontWeight: 500,
    height: 30,
    padding: '0 10px',
    borderRadius: 'var(--radius-input)',
    border: '1.5px solid var(--border-input)',
    background: activeViewId != null ? 'var(--color-brand-light, #E8F2FD)' : 'var(--color-surface)',
    color: activeViewId != null ? 'var(--color-brand)' : 'var(--color-gray-700)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={btnStyle}
        title="Saved views"
      >
        <Bookmark size={13} />
        {activeView ? activeView.name : 'Views'}
        <ChevronDown size={13} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Saved views"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            zIndex: 60,
            minWidth: 240,
            width: 'max-content',
            maxWidth: 320,
            background: '#fff',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}
        >
          {/* View list */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-gray-400)' }}>
                Loading…
              </div>
            )}
            {!loading && views.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--color-gray-400)' }}>
                No saved views yet.
              </div>
            )}
            {!loading && views.map((v) => {
              const isActive = v.id === activeViewId;
              return (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-brand-light, #E8F2FD)' : 'transparent',
                    borderBottom: '1px solid #F3F4F6',
                  }}
                  onClick={() => { onApply(v); setOpen(false); }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isActive ? 'var(--color-brand-light, #E8F2FD)' : 'transparent'; }}
                >
                  {/* Active check */}
                  <span style={{ width: 16, flexShrink: 0, color: 'var(--color-brand)' }}>
                    {isActive && <Check size={13} />}
                  </span>

                  {/* Name */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--color-brand)' : 'var(--color-gray-900)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.name}
                    {v.project_id == null && (
                      <span style={{ fontSize: 10, color: 'var(--color-gray-400)', marginLeft: 4 }}>
                        (all projects)
                      </span>
                    )}
                  </span>

                  {/* Star — default toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleDefault(v, e)}
                    title={v.is_default ? 'Unset as default' : 'Set as default'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: v.is_default ? '#F59E0B' : 'var(--color-gray-300)',
                      flexShrink: 0,
                    }}
                  >
                    <Star size={13} fill={v.is_default ? '#F59E0B' : 'none'} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(v.id, e)}
                    title="Delete view"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: 'var(--color-gray-300)',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Save section */}
          <div style={{ borderTop: '1px solid #F3F4F6', padding: '8px 10px' }}>
            {!showSave ? (
              <button
                type="button"
                onClick={() => { setShowSave(true); setNewName(''); setNameError(''); setSaveError(''); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-brand)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <Plus size={13} />
                Save current as…
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNameError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setShowSave(false); }}
                  placeholder="View name…"
                  maxLength={80}
                  className="input-brand-focus"
                  style={{
                    fontSize: 13,
                    padding: '4px 8px',
                    border: `1px solid ${nameError ? '#EF4444' : 'var(--border-input)'}`,
                    borderRadius: 6,
                    height: 30,
                    outline: 'none',
                    width: '100%',
                  }}
                />
                {nameError && (
                  <span style={{ fontSize: 11, color: '#EF4444' }}>{nameError}</span>
                )}
                {saveError && (
                  <span style={{ fontSize: 11, color: '#EF4444' }}>{saveError}</span>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !newName.trim()}
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 0',
                      borderRadius: 6,
                      border: 'none',
                      background: saving || !newName.trim() ? 'var(--color-gray-200)' : 'var(--color-brand)',
                      color: saving || !newName.trim() ? 'var(--color-gray-400)' : '#fff',
                      cursor: saving || !newName.trim() ? 'default' : 'pointer',
                    }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSave(false)}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border-input)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-gray-600)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewPicker;
