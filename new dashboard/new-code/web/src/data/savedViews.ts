/**
 * savedViews.ts — CRUD for the `saved_view` table.
 *
 * ALT-270 · v1 (2026-06-28)
 *
 * Keyed on (user_id, entity, project_id). Views are per-project-per-user.
 * A view saved while "All projects" is active has project_id = null and appears
 * in every project context.
 *
 * Load query: (user_id = me) AND (entity = X) AND (project_id = <pid> OR project_id IS NULL)
 *
 * The table does not exist yet — apply new-code/migration/apply-saved-views.cjs first.
 * Until then, every function returns gracefully with an empty result / no-op.
 *
 * TODO(gatekeeper ALT-431): route writes through the write gatekeeper before
 * enabling for all roles in production.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import type { AdvancedFilterState } from '../lib/filterEngine';
import type { ColumnPref } from './views';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface SavedViewRecord {
  id: number;
  user_id: number;
  project_id: number | null;
  entity: string;
  name: string;
  is_default: boolean;
  filter_state: AdvancedFilterState | null;
  sort_state: SortStateLite[] | null;
  column_prefs: ColumnPref[] | null;
  density: 'comfortable' | 'compact' | null;
  page_size: 25 | 50 | 100 | null;
  view_mode: 'table' | 'grid' | 'kanban' | null;
  created_at: string;
  updated_at: string;
}

/** Minimal sort state (compatible with TanStack SortingState). */
export interface SortStateLite {
  id: string;
  desc: boolean;
}

/** Payload for creating or updating a saved view. */
export interface SavedViewPayload {
  /** Name of the view. Required on create; optional on update. */
  name?: string;
  filter_state?: AdvancedFilterState | null;
  sort_state?: SortStateLite[] | null;
  column_prefs?: ColumnPref[] | null;
  density?: 'comfortable' | 'compact' | null;
  page_size?: 25 | 50 | 100 | null;
  view_mode?: 'table' | 'grid' | 'kanban' | null;
  is_default?: boolean;
}

// -----------------------------------------------------------------------
// Internal row normaliser
// -----------------------------------------------------------------------

function normaliseRow(row: Record<string, unknown>): SavedViewRecord {
  return {
    id:           row.id as number,
    user_id:      row.user_id as number,
    project_id:   (row.project_id as number | null) ?? null,
    entity:       row.entity as string,
    name:         row.name as string,
    is_default:   Boolean(row.is_default),
    filter_state: (row.filter_state as AdvancedFilterState | null) ?? null,
    sort_state:   (row.sort_state as SortStateLite[] | null) ?? null,
    column_prefs: (row.column_prefs as ColumnPref[] | null) ?? null,
    density:      (row.density as 'comfortable' | 'compact' | null) ?? null,
    page_size:    (row.page_size as 25 | 50 | 100 | null) ?? null,
    view_mode:    (row.view_mode as 'table' | 'grid' | 'kanban' | null) ?? null,
    created_at:   row.created_at as string,
    updated_at:   row.updated_at as string,
  };
}

// -----------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------

/**
 * List all saved views for (user, entity, project).
 * Also returns cross-project views (project_id IS NULL) which appear in every scope.
 */
export async function listSavedViews(
  userId: number | null,
  entity: string,
  projectId: number | null,
): Promise<SavedViewRecord[]> {
  if (userId == null) return [];

  // Fetch rows scoped to the exact project AND cross-project (null) rows.
  // PostgREST doesn't support "= pid OR IS NULL" in a single .eq call, so we
  // use .or() filter syntax.
  const filter =
    projectId != null
      ? `project_id.eq.${projectId},project_id.is.null`
      : 'project_id.is.null';

  const { data, error } = await supabase
    .from('saved_view')
    .select(
      'id, user_id, project_id, entity, name, is_default, filter_state, sort_state, column_prefs, density, page_size, view_mode, created_at, updated_at',
    )
    .eq('user_id', userId)
    .eq('entity', entity)
    .or(filter)
    .order('name', { ascending: true });

  if (error) {
    // Table may not exist yet (pre-migration). Degrade silently.
    if (error.code === '42P01') return []; // relation does not exist
    console.error('[savedViews] listSavedViews error', error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normaliseRow);
}

/**
 * Get the default saved view for (user, entity, project), or null.
 * Prefers exact-project default over cross-project default.
 */
export async function getDefaultView(
  userId: number | null,
  entity: string,
  projectId: number | null,
): Promise<SavedViewRecord | null> {
  const all = await listSavedViews(userId, entity, projectId);
  // Prefer exact-project match
  const exactDefault = all.find(
    (v) => v.is_default && v.project_id === projectId,
  );
  if (exactDefault) return exactDefault;
  // Fall back to cross-project default
  return all.find((v) => v.is_default && v.project_id == null) ?? null;
}

// -----------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------

/**
 * Create a new saved view.
 * Returns { data, error }.
 * TODO(gatekeeper ALT-431): route through write gatekeeper.
 */
export async function createSavedView(
  userId: number,
  entity: string,
  projectId: number | null,
  payload: SavedViewPayload & { name: string },
): Promise<{ data: SavedViewRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_view')
    .insert({
      user_id:      userId,
      project_id:   projectId,
      entity,
      name:         payload.name,
      is_default:   payload.is_default ?? false,
      filter_state: payload.filter_state ?? null,
      sort_state:   payload.sort_state ?? null,
      column_prefs: payload.column_prefs ?? null,
      density:      payload.density ?? null,
      page_size:    payload.page_size ?? null,
      view_mode:    payload.view_mode ?? null,
    })
    .select(
      'id, user_id, project_id, entity, name, is_default, filter_state, sort_state, column_prefs, density, page_size, view_mode, created_at, updated_at',
    )
    .single();

  if (error) {
    if (error.code === '42P01') {
      return { data: null, error: 'Saved views table not created yet — run apply-saved-views.cjs.' };
    }
    return { data: null, error: humanizeWriteError(error) };
  }

  return {
    data: data ? normaliseRow(data as Record<string, unknown>) : null,
    error: null,
  };
}

/**
 * Update an existing saved view by id.
 * Only updates the fields present in payload (partial update).
 * TODO(gatekeeper ALT-431): route through write gatekeeper.
 */
export async function updateSavedView(
  id: number,
  payload: Partial<SavedViewPayload>,
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name'         in payload) updates.name         = payload.name;
  if ('filter_state' in payload) updates.filter_state = payload.filter_state;
  if ('sort_state'   in payload) updates.sort_state   = payload.sort_state;
  if ('column_prefs' in payload) updates.column_prefs = payload.column_prefs;
  if ('density'      in payload) updates.density      = payload.density;
  if ('page_size'    in payload) updates.page_size    = payload.page_size;
  if ('view_mode'    in payload) updates.view_mode    = payload.view_mode;
  if ('is_default'   in payload) updates.is_default   = payload.is_default;

  const { error } = await supabase
    .from('saved_view')
    .update(updates)
    .eq('id', id);

  if (error) {
    if (error.code === '42P01') return { error: 'Saved views table not created yet.' };
    return { error: humanizeWriteError(error) };
  }
  return { error: null };
}

/**
 * Delete a saved view by id.
 * TODO(gatekeeper ALT-431): route through write gatekeeper.
 */
export async function deleteSavedView(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('saved_view').delete().eq('id', id);
  if (error) {
    if (error.code === '42P01') return { error: 'Saved views table not created yet.' };
    return { error: humanizeWriteError(error) };
  }
  return { error: null };
}

/**
 * Set is_default=true for one view and false for all others in the same scope.
 * Does this as two separate calls (clear all, then set one) — acceptable for v1
 * since the partial-unique index enforces the constraint server-side anyway.
 * TODO(gatekeeper ALT-431): route through write gatekeeper.
 */
export async function setDefaultView(
  userId: number,
  entity: string,
  projectId: number | null,
  viewId: number,
): Promise<{ error: string | null }> {
  // Clear all defaults in this scope
  const filter =
    projectId != null
      ? `project_id.eq.${projectId},project_id.is.null`
      : 'project_id.is.null';

  const { error: clearErr } = await supabase
    .from('saved_view')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('entity', entity)
    .or(filter)
    .eq('is_default', true);

  if (clearErr) {
    if (clearErr.code === '42P01') return { error: 'Saved views table not created yet.' };
    return { error: humanizeWriteError(clearErr) };
  }

  // Set the chosen view as default
  const { error: setErr } = await supabase
    .from('saved_view')
    .update({ is_default: true })
    .eq('id', viewId);

  if (setErr) return { error: humanizeWriteError(setErr) };
  return { error: null };
}

/**
 * Unset is_default for a view (without setting another one as default).
 * TODO(gatekeeper ALT-431): route through write gatekeeper.
 */
export async function unsetDefaultView(id: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('saved_view')
    .update({ is_default: false })
    .eq('id', id);
  if (error) return { error: humanizeWriteError(error) };
  return { error: null };
}
