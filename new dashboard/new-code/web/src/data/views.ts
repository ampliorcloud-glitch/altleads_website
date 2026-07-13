/**
 * Per-user saved column views — reads/writes the `user_view_pref` table.
 *
 * Table:
 *   user_view_pref(id, user_id, entity, name, columns jsonb, is_active, created_date)
 *
 * Model:
 *   - At most one ACTIVE row per (user_id, entity) holds the user's current
 *     column layout. Older rows are kept (never hard-deleted) for history.
 *   - `columns` is a jsonb array of ColumnPref { key, visible } in display order.
 *   - saveView deactivates the prior active row, then inserts a fresh active row.
 *   - resetView only deactivates the active row (falls back to defaults in the UI).
 *
 * Conventions (match dropdowns.ts / admin.ts): supabase client, functions return
 * a result with an `error: string | null`. user_id is stored as the value passed
 * in (callers pass the numeric user_id; null-safe).
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** One column's visibility preference; array order is the display order. */
export interface ColumnPref {
  key: string;
  visible: boolean;
}

export interface SavedView {
  id: number;
  user_id: number | null;
  entity: string;
  name: string | null;
  columns: ColumnPref[];
  is_active: boolean;
  created_date: string | null;
}

interface ViewRow {
  id: number;
  user_id: number | null;
  entity: string;
  name: string | null;
  columns: unknown;
  is_active: boolean;
  created_date: string | null;
}

function normaliseColumns(raw: unknown): ColumnPref[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is ColumnPref => !!c && typeof (c as ColumnPref).key === 'string')
    .map((c) => ({ key: c.key, visible: c.visible !== false }));
}

function mapRow(row: ViewRow): SavedView {
  return {
    id: row.id,
    user_id: row.user_id,
    entity: row.entity,
    name: row.name,
    columns: normaliseColumns(row.columns),
    is_active: row.is_active,
    created_date: row.created_date,
  };
}

/* ------------------------------------------------------------------ */
/*  Reads                                                              */
/* ------------------------------------------------------------------ */

/**
 * Get the user's active view for an entity (or null if none saved). On multiple
 * active rows (shouldn't happen) the most recent wins.
 */
export async function getActiveView(
  entity: string,
  userId: number | null,
): Promise<SavedView | null> {
  if (userId == null) return null;
  const { data, error } = await supabase
    .from('user_view_pref')
    .select('id, user_id, entity, name, columns, is_active, created_date')
    .eq('user_id', userId)
    .eq('entity', entity)
    .eq('is_active', true)
    .order('created_date', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[views] getActiveView error', error);
    return null;
  }
  const row = (data ?? [])[0] as ViewRow | undefined;
  return row ? mapRow(row) : null;
}

/* ------------------------------------------------------------------ */
/*  Writes                                                             */
/* ------------------------------------------------------------------ */

/**
 * Save a new active view: deactivate any prior active row for (user, entity),
 * then insert a fresh active row with the given columns. Old rows are retained.
 * Returns { error }.
 */
export async function saveView(
  entity: string,
  userId: number | null,
  columns: ColumnPref[],
  name?: string,
): Promise<{ error: string | null }> {
  if (userId == null) return { error: 'No user id.' };

  const { error: deactErr } = await supabase
    .from('user_view_pref')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('entity', entity)
    .eq('is_active', true);
  if (deactErr) return { error: humanizeWriteError(deactErr) };

  const { error: insErr } = await supabase.from('user_view_pref').insert({
    user_id: userId,
    entity,
    name: name ?? null,
    columns,
    is_active: true,
    created_date: new Date().toISOString(),
  });
  if (insErr) return { error: humanizeWriteError(insErr) };
  return { error: null };
}

/**
 * Reset to defaults: deactivate the active row only (never deletes). After this
 * getActiveView returns null and the UI falls back to its default columns.
 * Returns { error }.
 */
export async function resetView(
  entity: string,
  userId: number | null,
): Promise<{ error: string | null }> {
  if (userId == null) return { error: 'No user id.' };
  const { error } = await supabase
    .from('user_view_pref')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('entity', entity)
    .eq('is_active', true);
  return { error: error ? humanizeWriteError(error) : null };
}
