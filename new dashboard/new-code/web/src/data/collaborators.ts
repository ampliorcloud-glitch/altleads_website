/**
 * collaborators.ts — Data layer for record_collaborator (ALT-441).
 *
 * All functions are no-ops / return empty when COLLAB_ASSOC is false.
 *
 * Table shape (from apply-create-collaborator.cjs):
 *   collaborator_id, record_type, record_id, project_id, user_id,
 *   collaborator_role, created_by, created_date, updated_by, updated_date,
 *   deleted_by, deleted_date
 *
 * NOTE: Writes carry a TODO(gatekeeper ALT-431) comment — gatekeeper middleware
 * (role + collaborator_access setting check) will be layered on top once DEC-03
 * ownership-model validation is done and COLLAB_ASSOC is flipped live.
 */

import { supabase } from '../lib/supabase';
import { COLLAB_ASSOC, type Collaborator, type CollaboratorRole, type RecordType } from '../lib/collabAssoc';
import { createNotification } from './notifications';

const TABLE = 'record_collaborator';

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch all active collaborators on a record.
 * Returns [] when COLLAB_ASSOC is false (dark flag).
 */
export async function listCollaborators(
  recordType: RecordType,
  recordId: number,
): Promise<{ collaborators: Collaborator[]; error: string | null }> {
  if (!COLLAB_ASSOC) return { collaborators: [], error: null };

  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      collaborator_id,
      record_type,
      record_id,
      project_id,
      user_id,
      collaborator_role,
      created_date
    `)
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .is('deleted_date', null)
    .order('created_date', { ascending: true });

  if (error) return { collaborators: [], error: error.message };
  return { collaborators: (data ?? []) as Collaborator[], error: null };
}

/* ------------------------------------------------------------------ */
/*  Write                                                              */
/* ------------------------------------------------------------------ */

/**
 * Add a collaborator to a record.
 * TODO(gatekeeper ALT-431): validate caller has edit permission on the record
 * AND collaborator_access setting allows the write before reaching Supabase.
 */
export async function addCollaborator(params: {
  recordType: RecordType;
  recordId: number;
  userId: number;
  role: CollaboratorRole;
  projectId?: number | null;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  const { error } = await supabase.from(TABLE).insert({
    record_type: params.recordType,
    record_id: params.recordId,
    user_id: params.userId,
    collaborator_role: params.role,
    project_id: params.projectId ?? null,
    created_by: params.actorId,
    created_date: new Date().toISOString(),
  });

  if (!error) {
    // Fire-and-forget in-app notification to the added collaborator (ALT-489).
    // createNotification is a no-op when NOTIFICATIONS=false.
    void createNotification({
      recipientUserId: params.userId,
      type: 'Added as Collaborator',
      title: `You were added as a collaborator (${params.role}) on a ${params.recordType} record`,
      route: `/${params.recordType}s/${params.recordId}`,
      actor: params.actorId,
    });
  }

  return { error: error?.message ?? null };
}

/**
 * Soft-delete a collaborator row (sets deleted_date).
 * TODO(gatekeeper ALT-431): validate caller permission before write.
 */
export async function removeCollaborator(params: {
  collaboratorId: number;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  const { error } = await supabase
    .from(TABLE)
    .update({
      deleted_date: new Date().toISOString(),
      deleted_by: params.actorId,
    })
    .eq('collaborator_id', params.collaboratorId)
    .is('deleted_date', null);

  return { error: error?.message ?? null };
}

/**
 * Update the role (viewer/editor) for an existing collaborator.
 * TODO(gatekeeper ALT-431): validate caller permission before write.
 */
export async function updateCollaboratorRole(params: {
  collaboratorId: number;
  role: CollaboratorRole;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  const { error } = await supabase
    .from(TABLE)
    .update({
      collaborator_role: params.role,
      updated_by: params.actorId,
      updated_date: new Date().toISOString(),
    })
    .eq('collaborator_id', params.collaboratorId)
    .is('deleted_date', null);

  return { error: error?.message ?? null };
}
