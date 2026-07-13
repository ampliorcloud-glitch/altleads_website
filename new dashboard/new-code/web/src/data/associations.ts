/**
 * associations.ts — Data layer for record_association (ALT-442).
 *
 * All functions are no-ops / return empty when COLLAB_ASSOC is false.
 *
 * Table shape (from apply-create-association.cjs):
 *   association_id, from_type, from_id, to_type, to_id,
 *   assoc_label, is_primary, project_id,
 *   created_by, created_date, updated_by, updated_date,
 *   deleted_by, deleted_date
 *
 * DATA-LAYER CONVENTION: normalise endpoint ordering before every write so the
 * lexicographically-lower (type, id) pair is always stored as (from_type, from_id).
 * This prevents mirror-duplicate rows.  The partial-unique index on
 * (from_type, from_id, to_type, to_id) WHERE deleted_date IS NULL enforces it at DB level.
 */

import { supabase } from '../lib/supabase';
import {
  COLLAB_ASSOC,
  type Association,
  type AssocLabel,
  type RecordType,
} from '../lib/collabAssoc';

const TABLE = 'record_association';

/* ------------------------------------------------------------------ */
/*  Endpoint normalisation (mirrors DB convention note in migration)   */
/* ------------------------------------------------------------------ */

function normalise(
  aType: RecordType, aId: number,
  bType: RecordType, bId: number,
): { from_type: RecordType; from_id: number; to_type: RecordType; to_id: number } {
  // lexicographic compare: type first, then id
  const ltType = aType < bType;
  const eqType = aType === bType;
  const ltId = aId < bId;
  if (ltType || (eqType && ltId)) {
    return { from_type: aType, from_id: aId, to_type: bType, to_id: bId };
  }
  return { from_type: bType, from_id: bId, to_type: aType, to_id: aId };
}

/* ------------------------------------------------------------------ */
/*  Read                                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch all active associations for a record (both as from-end and to-end).
 * Returns the list with the "other" endpoint populated as from/to relative to
 * the caller's perspective.
 * Returns [] when COLLAB_ASSOC is false.
 */
export async function listAssociations(
  recordType: RecordType,
  recordId: number,
): Promise<{ associations: Association[]; error: string | null }> {
  if (!COLLAB_ASSOC) return { associations: [], error: null };

  // Fetch rows where record is from-end OR to-end
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      association_id,
      from_type,
      from_id,
      to_type,
      to_id,
      assoc_label,
      is_primary,
      project_id,
      created_date
    `)
    .is('deleted_date', null)
    .or(`and(from_type.eq.${recordType},from_id.eq.${recordId}),and(to_type.eq.${recordType},to_id.eq.${recordId})`);

  if (error) return { associations: [], error: error.message };
  return { associations: (data ?? []) as Association[], error: null };
}

/* ------------------------------------------------------------------ */
/*  Write                                                              */
/* ------------------------------------------------------------------ */

/**
 * Add an association between two records.
 * Normalises endpoint order before writing.
 */
export async function addAssociation(params: {
  typeA: RecordType;
  idA: number;
  typeB: RecordType;
  idB: number;
  label: AssocLabel;
  isPrimary: boolean;
  projectId?: number | null;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  const { from_type, from_id, to_type, to_id } = normalise(
    params.typeA, params.idA,
    params.typeB, params.idB,
  );

  const { error } = await supabase.from(TABLE).insert({
    from_type,
    from_id,
    to_type,
    to_id,
    assoc_label: params.label,
    is_primary: params.isPrimary,
    project_id: params.projectId ?? null,
    created_by: params.actorId,
    created_date: new Date().toISOString(),
  });

  return { error: error?.message ?? null };
}

/**
 * Soft-delete an association.
 */
export async function removeAssociation(params: {
  associationId: number;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  const { error } = await supabase
    .from(TABLE)
    .update({
      deleted_date: new Date().toISOString(),
      deleted_by: params.actorId,
    })
    .eq('association_id', params.associationId)
    .is('deleted_date', null);

  return { error: error?.message ?? null };
}

/**
 * Mark an association as primary (and un-mark any existing primary on the same
 * (recordType, recordId) pair so there's at most one primary per lead).
 */
export async function setPrimaryAssociation(params: {
  /** The "anchor" record we're setting primary from (e.g. a lead). */
  anchorType: RecordType;
  anchorId: number;
  /** The association to mark primary. */
  associationId: number;
  actorId: string;
}): Promise<{ error: string | null }> {
  if (!COLLAB_ASSOC) return { error: null };

  // Step 1: clear existing primaries for this anchor record on both ends
  const now = new Date().toISOString();

  // Clear from-end primaries
  await supabase
    .from(TABLE)
    .update({ is_primary: false, updated_by: params.actorId, updated_date: now })
    .eq('from_type', params.anchorType)
    .eq('from_id', params.anchorId)
    .eq('is_primary', true)
    .is('deleted_date', null);

  // Clear to-end primaries
  await supabase
    .from(TABLE)
    .update({ is_primary: false, updated_by: params.actorId, updated_date: now })
    .eq('to_type', params.anchorType)
    .eq('to_id', params.anchorId)
    .eq('is_primary', true)
    .is('deleted_date', null);

  // Step 2: set the target row as primary
  const { error } = await supabase
    .from(TABLE)
    .update({ is_primary: true, updated_by: params.actorId, updated_date: now })
    .eq('association_id', params.associationId)
    .is('deleted_date', null);

  return { error: error?.message ?? null };
}
