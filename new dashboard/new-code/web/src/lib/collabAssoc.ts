/**
 * collabAssoc.ts — Feature flag + shared types for Collaborators & Associations (ALT-441/442).
 *
 * COLLAB_ASSOC=false → all UI is hidden, all data functions are no-ops.
 * Flip to true ONLY after apply-create-collaborator.cjs + apply-create-association.cjs
 * have been applied to production (manual, owner sign-off required).
 *
 * DB tables: public.record_collaborator, public.record_association
 * See: new-code/migration/apply-create-collaborator.cjs
 *      new-code/migration/apply-create-association.cjs
 */

/** Master on/off gate. Default false — prod unchanged until migrations land + flag flipped. */
export const COLLAB_ASSOC = false;

/* ------------------------------------------------------------------ */
/*  Collaborator types (matches record_collaborator columns)           */
/* ------------------------------------------------------------------ */

/** Two supported access tiers. Admin picks one per object via CollaboratorAccessTab. */
export type CollaboratorRole = 'viewer' | 'editor';

export interface Collaborator {
  collaborator_id: number;
  record_type: 'contact' | 'company' | 'lead' | 'meeting';
  record_id: number;
  project_id: number | null;
  user_id: number;
  collaborator_role: CollaboratorRole;
  /** Display name (joined from profiles/user_master — not in DB row, added client-side) */
  full_name?: string;
  created_date: string;
}

/* ------------------------------------------------------------------ */
/*  Association types (matches record_association columns)             */
/* ------------------------------------------------------------------ */

/**
 * v1 built-in labels (mirroring CHECK constraint in apply-create-association.cjs).
 * null = no label (unlabeled association).
 */
export type AssocLabel =
  | 'Decision Maker'
  | 'Influencer'
  | 'Technical Contact'
  | 'Finance Contact'
  | 'Other'
  | null;

export const ASSOC_LABELS: AssocLabel[] = [
  'Decision Maker',
  'Influencer',
  'Technical Contact',
  'Finance Contact',
  'Other',
  null,
];

export type RecordType = 'contact' | 'company' | 'lead' | 'meeting';

export interface Association {
  association_id: number;
  from_type: RecordType;
  from_id: number;
  to_type: RecordType;
  to_id: number;
  assoc_label: AssocLabel;
  is_primary: boolean;
  project_id: number | null;
  created_date: string;
  /** Resolved display name for the "other" endpoint (added client-side) */
  display_name?: string;
}

/* ------------------------------------------------------------------ */
/*  Collaborator access setting (global admin toggle)                  */
/* ------------------------------------------------------------------ */

/** Admin-set access level for collaborators: view-only vs view+edit. */
export type CollaboratorAccessLevel = 'view' | 'edit';

export interface CollaboratorAccessSetting {
  object_type: RecordType;
  access_level: CollaboratorAccessLevel;
}
