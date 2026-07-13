/**
 * Data layer for project_visibility_setting (access dials v2).
 *
 * Table: public.project_visibility_setting
 *   project_id  bigint  FK -> project
 *   object_type text    CHECK IN ('lead','company','contact')
 *   view_scope  text    CHECK IN ('owner','team','everyone')  DEFAULT 'owner'
 *   edit_scope  text    CHECK IN ('owner','team','everyone')  DEFAULT 'owner'
 *   updated_by  varchar
 *   updated_date timestamptz
 *
 * RLS:
 *   SELECT  — any authenticated user (USING true)
 *   INSERT/UPDATE/DELETE — is_admin() OR manages_project(project_id)
 *
 * A 42501 permission error surfaces when a non-admin, non-manager attempts a write.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

export type VisibilityScope = 'owner' | 'team' | 'everyone';
export type ObjectType = 'lead' | 'company' | 'contact';

export interface VisibilitySetting {
  object_type: ObjectType;
  view_scope: VisibilityScope;
  edit_scope: VisibilityScope;
}

export interface ProjectVisibility {
  project_id: number;
  settings: VisibilitySetting[];
}

interface PvsRow {
  object_type: string;
  view_scope: string;
  edit_scope: string;
}

const OBJECT_TYPES: ObjectType[] = ['lead', 'company', 'contact'];

const DEFAULTS: Record<ObjectType, VisibilitySetting> = {
  lead:    { object_type: 'lead',    view_scope: 'team',     edit_scope: 'owner' },
  company: { object_type: 'company', view_scope: 'everyone', edit_scope: 'owner' },
  contact: { object_type: 'contact', view_scope: 'everyone', edit_scope: 'owner' },
};

/**
 * Fetch all three visibility rows for a project.
 * If a row is missing (pre-seed or deleted) we fall back to the coded default.
 */
export async function fetchProjectVisibility(
  projectId: number
): Promise<{ settings: VisibilitySetting[]; error: string | null }> {
  const { data, error } = await supabase
    .from('project_visibility_setting')
    .select('object_type, view_scope, edit_scope')
    .eq('project_id', projectId);

  if (error) return { settings: [], error: error.message };

  const rows = (data ?? []) as PvsRow[];
  const byType = new Map(rows.map((r) => [r.object_type, r]));

  const settings: VisibilitySetting[] = OBJECT_TYPES.map((ot) => {
    const r = byType.get(ot);
    if (!r) return { ...DEFAULTS[ot] };
    return {
      object_type: ot,
      view_scope: (r.view_scope as VisibilityScope) ?? DEFAULTS[ot].view_scope,
      edit_scope: (r.edit_scope as VisibilityScope) ?? DEFAULTS[ot].edit_scope,
    };
  });

  return { settings, error: null };
}

/**
 * Upsert one object-type row for a project.
 * On a 42501 (permission denied) we return a friendly message.
 */
export async function upsertProjectVisibility(
  projectId: number,
  objectType: ObjectType,
  scopes: { view_scope: VisibilityScope; edit_scope: VisibilityScope },
  actorId: string
): Promise<string | null> {
  const { error } = await supabase
    .from('project_visibility_setting')
    .upsert(
      {
        project_id: projectId,
        object_type: objectType,
        view_scope: scopes.view_scope,
        edit_scope: scopes.edit_scope,
        updated_by: actorId,
        updated_date: new Date().toISOString(),
      },
      { onConflict: 'project_id,object_type' }
    );

  if (!error) return null;

  if (error.code === '42501') {
    return 'Permission denied: only admins and project managers can change access settings.';
  }
  return humanizeWriteError(error) ?? error.message;
}

/**
 * Upsert all three object-type rows for a project in sequence.
 * Stops and returns the first error encountered.
 */
export async function upsertAllProjectVisibility(
  projectId: number,
  settings: VisibilitySetting[],
  actorId: string
): Promise<string | null> {
  for (const s of settings) {
    const err = await upsertProjectVisibility(
      projectId,
      s.object_type,
      { view_scope: s.view_scope, edit_scope: s.edit_scope },
      actorId
    );
    if (err) return err;
  }
  return null;
}
