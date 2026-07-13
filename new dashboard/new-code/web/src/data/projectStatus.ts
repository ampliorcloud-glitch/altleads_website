/**
 * Project-status data layer — per-(record, project) status tracking plus the
 * append-only interaction history that records every change.
 *
 * Tables:
 *   contact_project_status(contact_id, project_id, contact_status, description,
 *     comments, owner_user_id, audit)  UNIQUE(contact_id, project_id)
 *   company_project_status(company_id, project_id, account_status, is_feasible,
 *     decision_power, description, comments, owner_user_id, audit)
 *     UNIQUE(company_id, project_id)
 *   interaction(interaction_id, record_type, record_id, project_id, owner_user_id,
 *     type, disposition, note_text, occurred_at, created_at, created_by)
 *     — append-only; we add `status_change` rows on every status edit and
 *       `call` rows for logged dispositions.
 *
 * Conventions (match contacts.ts / admin.ts):
 *   - supabase client + { data, error } style; functions return { ..., error }.
 *   - audit columns created_by / updated_by store the acting user_id as TEXT.
 *   - owner_user_id is a numeric user_id.
 */

import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';
import type { Interaction } from './contacts';

export type { Interaction } from './contacts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

// 'meeting' is valid here too: the interaction table is keyed by free-text
// record_type, and the read path (data/callLogs fetchCallLogs) already filters
// record_type='meeting'. Logging a call against a meeting therefore lands in the
// same store the meeting's "Recent calls" preview reads (ALT-337).
export type RecordType = 'contact' | 'company' | 'lead' | 'meeting';

export interface ContactProjectStatus {
  contact_id: number;
  project_id: number;
  contact_status: string | null;
  description: string | null;
  comments: string | null;
  owner_user_id: number | null;
}

export interface CompanyProjectStatus {
  company_id: number;
  project_id: number;
  account_status: string | null;
  // 'feasible' | 'not_feasible' | 'unknown' (text in DB; matches the feasibility dropdown values)
  is_feasible: string | null;
  decision_power: string | null;
  description: string | null;
  comments: string | null;
  owner_user_id: number | null;
}

/** Lightweight status shape keyed by contact_id, used to decorate list rows. */
export interface ContactStatusLite {
  contact_status: string | null;
  description: string | null;
  comments: string | null;
}

export interface ContactStatusPatch {
  contact_status?: string | null;
  description?: string | null;
  comments?: string | null;
}

export interface CompanyStatusPatch {
  account_status?: string | null;
  is_feasible?: string | null;
  decision_power?: string | null;
  description?: string | null;
  comments?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/*  Interaction history helper                                         */
/* ------------------------------------------------------------------ */

/**
 * Append a single interaction row (best-effort; failures are swallowed so a
 * history write never blocks the primary status upsert). Stamps occurred_at,
 * created_at and created_by (actor user_id as text).
 */
async function appendInteraction(params: {
  recordType: RecordType;
  recordId: number;
  projectId: number | null;
  ownerUserId: number | null;
  type: string;
  disposition?: string | null;
  noteText?: string | null;
  actorId: string | null;
}): Promise<{ interactionId: number | null; error: string | null }> {
  const ts = nowIso();
  const { data, error } = await supabase
    .from('interaction')
    .insert({
      record_type: params.recordType,
      record_id: params.recordId,
      project_id: params.projectId,
      owner_user_id: params.ownerUserId,
      type: params.type,
      disposition: params.disposition ?? null,
      note_text: params.noteText ?? null,
      occurred_at: ts,
      created_at: ts,
      created_by: params.actorId,
    })
    .select('interaction_id')
    .single();
  if (error) {
    return {
      interactionId: null,
      error: error.code === '42501'
        ? "You can only edit records you own (ask an admin or the owner's manager)."
        : humanizeWriteError(error),
    };
  }
  return { interactionId: (data as { interaction_id: number } | null)?.interaction_id ?? null, error: null };
}

/**
 * Build a human-readable note summarising the fields that changed in a status
 * patch, e.g. "contact_status: hot; comments updated".
 */
function describeChange(patch: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === 'description' || key === 'comments') {
      parts.push(`${key} updated`);
    } else if (typeof value === 'boolean') {
      parts.push(`${key}: ${value ? 'yes' : 'no'}`);
    } else {
      parts.push(`${key}: ${value ?? '—'}`);
    }
  }
  return parts.length ? parts.join('; ') : 'status updated';
}

/* ------------------------------------------------------------------ */
/*  Contact status                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch statuses for a set of contacts within one project. Returns a record
 * keyed by contact_id -> { contact_status, description, comments }. Pages the
 * id list in chunks so a huge selection never trips PostgREST limits.
 */
export async function fetchContactStatuses(
  projectId: number,
  contactIds: number[],
): Promise<Record<number, ContactStatusLite>> {
  const out: Record<number, ContactStatusLite> = {};
  if (!projectId || contactIds.length === 0) return out;

  const CHUNK = 200;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const slice = contactIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('contact_project_status')
      .select('contact_id, contact_status, description, comments')
      .eq('project_id', projectId)
      .in('contact_id', slice);
    if (error) {
      console.error('[projectStatus] fetchContactStatuses error', error);
      continue;
    }
    for (const row of (data ?? []) as ContactProjectStatus[]) {
      out[row.contact_id] = {
        contact_status: row.contact_status ?? null,
        description: row.description ?? null,
        comments: row.comments ?? null,
      };
    }
  }
  return out;
}

/** Fetch a single contact's status for a project (null when none exists). */
export async function getContactStatus(
  contactId: number,
  projectId: number,
): Promise<ContactProjectStatus | null> {
  const { data, error } = await supabase
    .from('contact_project_status')
    .select('contact_id, project_id, contact_status, description, comments, owner_user_id')
    .eq('contact_id', contactId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ContactProjectStatus;
}

/**
 * Upsert a contact's status for a project (on contact_id + project_id) and append
 * a `status_change` interaction describing the edit. Only the keys present in
 * `patch` are written. Returns { error }.
 */
export async function upsertContactStatus(
  contactId: number,
  projectId: number,
  patch: ContactStatusPatch,
  actorId: string | null,
): Promise<{ error: string | null }> {
  const existing = await getContactStatus(contactId, projectId);
  const ts = nowIso();

  const row: Record<string, unknown> = {
    contact_id: contactId,
    project_id: projectId,
    updated_by: actorId,
    updated_date: ts,
  };
  if (patch.contact_status !== undefined) row.contact_status = patch.contact_status;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.comments !== undefined) row.comments = patch.comments;
  if (!existing) {
    row.created_by = actorId;
    row.created_date = ts;
  }

  const { error } = await supabase
    .from('contact_project_status')
    .upsert(row, { onConflict: 'contact_id,project_id' });
  if (error) {
    return {
      error: error.code === '42501'
        ? "You can only edit records you own (ask an admin or the owner's manager)."
        : humanizeWriteError(error),
    };
  }

  const histRes = await appendInteraction({
    recordType: 'contact',
    recordId: contactId,
    projectId,
    ownerUserId: existing?.owner_user_id ?? null,
    type: 'status_change',
    noteText: describeChange(patch as Record<string, unknown>),
    actorId,
  });
  if (histRes.error) {
    console.error('[projectStatus] contact history write failed', histRes.error);
  }

  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  Company status                                                     */
/* ------------------------------------------------------------------ */

/** Fetch a single company's status for a project (null when none exists). */
export async function getCompanyStatus(
  companyId: number,
  projectId: number,
): Promise<CompanyProjectStatus | null> {
  const { data, error } = await supabase
    .from('company_project_status')
    .select('company_id, project_id, account_status, is_feasible, decision_power, description, comments, owner_user_id')
    .eq('company_id', companyId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CompanyProjectStatus;
}

/**
 * Upsert a company's status for a project (on company_id + project_id) and append
 * a `status_change` interaction describing the edit. Returns { error }.
 */
export async function upsertCompanyStatus(
  companyId: number,
  projectId: number,
  patch: CompanyStatusPatch,
  actorId: string | null,
): Promise<{ error: string | null }> {
  const existing = await getCompanyStatus(companyId, projectId);
  const ts = nowIso();

  const row: Record<string, unknown> = {
    company_id: companyId,
    project_id: projectId,
    updated_by: actorId,
    updated_date: ts,
  };
  if (patch.account_status !== undefined) row.account_status = patch.account_status;
  if (patch.is_feasible !== undefined) row.is_feasible = patch.is_feasible;
  if (patch.decision_power !== undefined) row.decision_power = patch.decision_power;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.comments !== undefined) row.comments = patch.comments;
  if (!existing) {
    row.created_by = actorId;
    row.created_date = ts;
  }

  const { error } = await supabase
    .from('company_project_status')
    .upsert(row, { onConflict: 'company_id,project_id' });
  if (error) {
    return {
      error: error.code === '42501'
        ? "You can only edit records you own (ask an admin or the owner's manager)."
        : humanizeWriteError(error),
    };
  }

  const { error: histError } = await appendInteraction({
    recordType: 'company',
    recordId: companyId,
    projectId,
    ownerUserId: existing?.owner_user_id ?? null,
    type: 'status_change',
    noteText: describeChange(patch as Record<string, unknown>),
    actorId,
  });
  if (histError) console.error('Failed to append company status_change interaction:', histError);

  return { error: null };
}

/* ------------------------------------------------------------------ */
/*  Dispositions + activity                                            */
/* ------------------------------------------------------------------ */

/**
 * Log a call disposition as an interaction (type `call`).
 * Returns { interactionId, error }.
 *
 * Unlike the status-edit history (where a failed interaction write is best-effort
 * and swallowed because the primary status upsert already succeeded), THIS is the
 * primary write for the call-log path: if the interaction insert is denied (RLS)
 * or the table is missing, the call wrote nothing — so we must PROPAGATE that to
 * the caller (humanized) rather than reporting a false success.
 *
 * interactionId is returned so the caller (e.g. RecordActivityHub) can link the
 * newly-created interaction row to the task that triggered the call (ALT-430).
 */
export async function logDisposition(params: {
  recordType: RecordType;
  recordId: number;
  projectId: number | null;
  disposition: string;
  noteText: string;
  ownerUserId: number | null;
  actorId: string | null;
}): Promise<{ interactionId: number | null; error: string | null }> {
  const res = await appendInteraction({
    recordType: params.recordType,
    recordId: params.recordId,
    projectId: params.projectId,
    ownerUserId: params.ownerUserId,
    type: 'call',
    disposition: params.disposition,
    noteText: params.noteText,
    actorId: params.actorId,
  });
  if (res.error) {
    console.error('[projectStatus] logDisposition interaction write failed', res.error);
    return { interactionId: null, error: humanizeWriteError(res.error) };
  }
  return { interactionId: res.interactionId, error: null };
}

/**
 * Mirror a contact-scoped activity (status change / logged call) that happened
 * INSIDE a company's related-contacts view onto the COMPANY's own project feed.
 *
 * The primary write already records a `contact` interaction (so it shows on the
 * contact's timeline). But the company's Activity tab reads only `company`-typed
 * interactions for the selected project, so without this mirror the activity is
 * invisible from the company view. We append a second, company-scoped row —
 * same table, same project_id — so the company's per-project feed reflects work
 * done on its contacts. Best-effort; the prefix names the contact for context.
 */
export async function logCompanyContactActivity(params: {
  companyId: number;
  projectId: number | null;
  contactName: string;
  type: string; // 'status_change' | 'call'
  disposition?: string | null;
  noteText: string;
  ownerUserId: number | null;
  actorId: string | null;
}): Promise<{ error: string | null }> {
  const who = params.contactName.trim() || 'contact';
  const { error } = await appendInteraction({
    recordType: 'company',
    recordId: params.companyId,
    projectId: params.projectId,
    ownerUserId: params.ownerUserId,
    type: params.type,
    disposition: params.disposition ?? null,
    noteText: `${who}: ${params.noteText}`,
    actorId: params.actorId,
  });
  return { error };
}

/**
 * Fetch the interaction history for a record, newest first. When projectId is
 * given it scopes to that project; otherwise all projects are returned.
 */
export async function fetchActivity(
  recordType: RecordType,
  recordId: number,
  projectId?: number | null,
): Promise<Interaction[]> {
  let query = supabase
    .from('interaction')
    .select('*')
    .eq('record_type', recordType)
    .eq('record_id', recordId);
  if (projectId != null) query = query.eq('project_id', projectId);

  const { data, error } = await query.order('occurred_at', { ascending: false });
  if (error) {
    console.error('[projectStatus] fetchActivity error', error);
    return [];
  }
  return (data ?? []) as Interaction[];
}
