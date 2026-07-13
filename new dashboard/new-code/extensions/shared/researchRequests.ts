/**
 * shared/researchRequests.ts
 *
 * Typed, DEFENSIVE helpers for public.contact_research_request.
 *
 * Error handling contract:
 *  - Postgres 42P01 (table missing)  → returns { tag: 'backend_not_ready' }
 *  - Postgres 42501 (RLS / forbidden) → returns { tag: 'forbidden' }
 *  - Any other error                  → returns { tag: 'error', message }
 *  - Success                          → the data (or null for look-ups)
 *
 * The table may not exist in the live schema yet (REQUEST 3 is CRM-side work).
 * All functions degrade gracefully so the UI can show "Research queue not set up yet"
 * rather than crashing.
 *
 * Write-stamping: requested_by / created_by = profiles.user_id AS TEXT
 * (the same numeric-user_id-as-text convention used everywhere in the CRM).
 *
 * Added helpers (used by data-research extension):
 *  - listOpenRequests()       — queue of pending/in_progress rows
 *  - fulfillRequest()         — mark done with fulfilled_by/fulfilled_at
 *  - markNotFound()           — mark not_found with fulfilled_by/fulfilled_at
 *  - updateContactDetails()   — write filled fields to contact_master
 */

import { getSupabaseClient } from './supabaseClient';
import { normalizeLinkedinSlug } from './normalizeLinkedin';
import type { ResearchRequest, ResearchRequestResult } from './types';

// Re-export so callers import from one place
export type { ResearchRequest, ResearchRequestResult };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a Supabase/PostgREST error to a ResearchRequestResult error tag.
 */
function classifyError(error: { code?: string; message?: string }): ResearchRequestResult {
  const code = error.code ?? '';
  const msg  = error.message ?? 'Unknown error';

  if (code === '42P01') {
    // relation does not exist — table not yet created by the CRM side
    return { tag: 'backend_not_ready' };
  }
  if (code === '42501' || code === 'PGRST301' || msg.toLowerCase().includes('permission denied')) {
    // RLS denial
    return { tag: 'forbidden' };
  }
  return { tag: 'error', message: msg };
}

// ---------------------------------------------------------------------------
// getOpenRequestForContact
// ---------------------------------------------------------------------------

/**
 * Returns the latest non-closed request for a contact (status in
 * 'pending' | 'in_progress'), or null if there is none.
 *
 * Callers should call this on panel load and use the result to decide
 * whether to show "Request" or "Re-request".
 */
export async function getOpenRequestForContact(
  contactId: number
): Promise<
  | { request_id: number; status: string; requested_at: string; fields_needed: string | null }
  | null
  | ResearchRequestResult
> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_research_request')
    .select('request_id, status, requested_at, fields_needed')
    .eq('contact_id', contactId)
    .in('status', ['pending', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return classifyError(error);
  }

  if (!data) return null;

  return {
    request_id:   data.request_id as number,
    status:       data.status as string,
    requested_at: data.requested_at as string,
    fields_needed: data.fields_needed as string | null,
  };
}

// ---------------------------------------------------------------------------
// createResearchRequest
// ---------------------------------------------------------------------------

export interface CreateResearchRequestParams {
  contactId:    number;
  companyId:    number | null;
  linkedinUrl:  string | null;
  linkedinClean: string | null;
  projectId:    number | null;
  fieldsNeeded: string | null;   // e.g. 'email,mobile,designation'
  notes?:       string | null;
  requestedBy:  string;          // profiles.user_id AS TEXT
}

/**
 * INSERT a new research request row.
 * Returns the new ResearchRequest on success, or an error tag.
 */
export async function createResearchRequest(
  params: CreateResearchRequestParams
): Promise<ResearchRequest | ResearchRequestResult> {
  const supabase = getSupabaseClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('contact_research_request')
    .insert({
      contact_id:    params.contactId,
      company_id:    params.companyId,
      linkedin_url:  params.linkedinUrl,
      linkedin_clean: params.linkedinClean,
      project_id:    params.projectId,
      fields_needed: params.fieldsNeeded,
      status:        'pending',
      notes:         params.notes ?? null,
      requested_by:  params.requestedBy,
      requested_at:  now,
      created_by:    params.requestedBy,
      created_date:  now,
    })
    .select()
    .single();

  if (error) {
    return classifyError(error);
  }

  return data as ResearchRequest;
}

// ---------------------------------------------------------------------------
// reRequest
// ---------------------------------------------------------------------------

/**
 * Re-open an existing research request:
 *  - status → 'pending'
 *  - requested_at → now()
 *  - updated_by / updated_date set
 *  - note appended to notes (if provided)
 *
 * Callers should check getOpenRequestForContact first; if there is no open
 * request, fall back to createResearchRequest instead.
 */
export async function reRequest(
  requestId: number,
  updatedBy: string,
  note?: string | null
): Promise<ResearchRequest | ResearchRequestResult> {
  const supabase = getSupabaseClient();

  const now = new Date().toISOString();

  // Fetch the current notes so we can append rather than overwrite
  const { data: existing, error: fetchError } = await supabase
    .from('contact_research_request')
    .select('notes')
    .eq('request_id', requestId)
    .maybeSingle();

  if (fetchError) {
    return classifyError(fetchError);
  }

  const existingNotes = (existing as { notes: string | null } | null)?.notes ?? null;
  const newNotes = note
    ? existingNotes
      ? `${existingNotes}\n[Re-requested ${now}] ${note}`
      : `[Re-requested ${now}] ${note}`
    : existingNotes;

  const { data, error } = await supabase
    .from('contact_research_request')
    .update({
      status:       'pending',
      requested_at: now,
      notes:        newNotes,
      updated_by:   updatedBy,
      updated_date: now,
    })
    .eq('request_id', requestId)
    .select()
    .single();

  if (error) {
    return classifyError(error);
  }

  return data as ResearchRequest;
}

// ---------------------------------------------------------------------------
// listOpenRequests — used by data-research extension queue
// ---------------------------------------------------------------------------

export interface OpenRequestRow {
  request_id:    number;
  contact_id:    number | null;
  company_id:    number | null;
  linkedin_url:  string | null;
  linkedin_clean: string | null;
  project_id:    number | null;
  fields_needed: string | null;
  status:        string;
  notes:         string | null;
  requested_by:  string | null;
  requested_at:  string;
}

/**
 * Returns pending + in_progress requests, newest first, up to `limit`.
 * Used by the data-research extension to populate the work queue.
 */
export async function listOpenRequests(
  limit = 50
): Promise<OpenRequestRow[] | ResearchRequestResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_research_request')
    .select(
      'request_id, contact_id, company_id, linkedin_url, linkedin_clean, ' +
      'project_id, fields_needed, status, notes, requested_by, requested_at'
    )
    .in('status', ['pending', 'in_progress'])
    .order('requested_at', { ascending: false })
    .limit(limit);

  if (error) return classifyError(error);
  return (data ?? []) as OpenRequestRow[];
}

// ---------------------------------------------------------------------------
// fulfillRequest — mark a request done
// ---------------------------------------------------------------------------

/**
 * Stamps a research request as 'done' with the fulfiller's user_id and
 * current timestamp.  Used by the data-research extension after saving
 * contact details.
 */
export async function fulfillRequest(
  requestId: number,
  fulfilledBy: string
): Promise<ResearchRequest | ResearchRequestResult> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('contact_research_request')
    .update({
      status:       'done',
      fulfilled_by: fulfilledBy,
      fulfilled_at: now,
      updated_by:   fulfilledBy,
      updated_date: now,
    })
    .eq('request_id', requestId)
    .select()
    .single();

  if (error) return classifyError(error);
  return data as ResearchRequest;
}

// ---------------------------------------------------------------------------
// markNotFound — mark a request not_found
// ---------------------------------------------------------------------------

/**
 * Stamps a research request as 'not_found'.  No contact data is written.
 */
export async function markNotFound(
  requestId: number,
  fulfilledBy: string
): Promise<ResearchRequest | ResearchRequestResult> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('contact_research_request')
    .update({
      status:       'not_found',
      fulfilled_by: fulfilledBy,
      fulfilled_at: now,
      updated_by:   fulfilledBy,
      updated_date: now,
    })
    .eq('request_id', requestId)
    .select()
    .single();

  if (error) return classifyError(error);
  return data as ResearchRequest;
}

// ---------------------------------------------------------------------------
// updateContactDetails — write filled contact fields to contact_master
// ---------------------------------------------------------------------------

export interface ContactDetailFields {
  full_name?:     string | null;
  designation?:   string | null;
  email?:         string | null;
  mobile_no?:     string | null;
  alt_mobile_no?: string | null;
  linkedin_url?:  string | null;
}

/**
 * Write filled detail fields to contact_master.
 *  - Re-derives linkedin_clean from linkedin_url via normalizeLinkedinSlug.
 *  - Only sets fields that are non-null/non-empty (never overwrites filled data
 *    with empty strings — pass only the fields the researcher actually filled).
 *  - Stamps updated_by (profiles.user_id as text) + updated_date.
 *
 * Returns { ok: true } on success, or a ResearchRequestResult error tag.
 * 42501 → 'forbidden' ("permission — RESEARCH role/RLS not enabled yet").
 * 42P01 → 'backend_not_ready'.
 */
export async function updateContactDetails(
  contactId: number,
  fields: ContactDetailFields,
  updatedBy: string
): Promise<{ ok: true } | ResearchRequestResult> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  type UpdatePayload = Record<string, string | null>;

  const payload: UpdatePayload = {
    updated_by:   updatedBy,
    updated_date: now,
  };

  if (fields.full_name     != null && fields.full_name.trim())     payload['full_name']     = fields.full_name.trim();
  if (fields.designation   != null && fields.designation.trim())   payload['designation']   = fields.designation.trim();
  if (fields.email         != null && fields.email.trim())         payload['email']         = fields.email.trim();
  if (fields.mobile_no     != null && fields.mobile_no.trim())     payload['mobile_no']     = fields.mobile_no.trim();
  if (fields.alt_mobile_no != null && fields.alt_mobile_no.trim()) payload['alt_mobile_no'] = fields.alt_mobile_no.trim();
  if (fields.linkedin_url  != null && fields.linkedin_url.trim())  {
    payload['linkedin_url'] = fields.linkedin_url.trim();
    const slug = normalizeLinkedinSlug(fields.linkedin_url.trim());
    if (slug) payload['linkedin_clean'] = slug;
  }

  const { error } = await supabase
    .from('contact_master')
    .update(payload)
    .eq('contact_id', contactId);

  if (error) return classifyError(error);
  return { ok: true };
}
