/**
 * shared/contactData.ts
 *
 * Read helpers that mirror the web CRM's data layer:
 *   - fetchContactDetail    → contact_master_masked (view)
 *   - fetchContactLeads     → lead_master
 *   - fetchContactStatus    → contact_project_status
 *   - fetchActivityFeed     → interaction (last N entries)
 *   - fetchTasks            → task
 *
 * Every function is DEFENSIVE:
 * - Returns null / empty array on error rather than throwing, so the panel
 *   can render partial data rather than crashing.
 * - Logs errors to the console for debugging.
 * - Guards against missing tables/columns (schema may vary between CRM versions).
 *
 * Identity note: these are READ-ONLY helpers (Phase 1).  No writes here.
 */

import { getSupabaseClient } from './supabaseClient';
import type {
  ContactDetail,
  LeadRecord,
  ContactProjectStatus,
  ContactProjectStatusWithOwner,
  CompanyContact,
  InteractionRecord,
  TaskRecord,
} from './types';

// ---------------------------------------------------------------------------
// fetchContactDetail — mirrors fetchContactById in web/src/data/contacts.ts
// ---------------------------------------------------------------------------

/**
 * Load a contact from the contact_master_masked view.
 * Masked columns (email, mobile_no, linkedin_url, linkedin_clean) will be
 * NULL when the calling user is not the owner/manager/admin/QC.
 * This is expected — render "hidden (not your record)", not "empty".
 */
export async function fetchContactDetail(
  contactId: number
): Promise<ContactDetail | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_master_masked')
    .select(
      'contact_id, full_name, email, mobile_no, alt_mobile_no, designation, ' +
      'linkedin_url, linkedin_clean, company_id, company_name, city_name, ' +
      'is_demo, created_by, created_date'
    )
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error) {
    console.error('[AltLeads] fetchContactDetail error:', error.message);
    return null;
  }
  if (!data) return null;

  return data as ContactDetail;
}

// ---------------------------------------------------------------------------
// fetchContactLeads — mirrors fetchContactLeads in web/src/data/leads.ts
// ---------------------------------------------------------------------------

/**
 * Load leads associated with a contact.
 * Returns an empty array on error rather than null so callers can always .map().
 */
export async function fetchContactLeads(
  contactId: number
): Promise<LeadRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('lead_master')
    .select(
      'lead_id, contact_id, project_id, lead_status, lead_stage, lead_type, ' +
      'company_name, created_by, created_date'
    )
    .eq('contact_id', contactId)
    .order('created_date', { ascending: false });

  if (error) {
    console.error('[AltLeads] fetchContactLeads error:', error.message);
    return [];
  }

  return (data ?? []) as LeadRecord[];
}

// ---------------------------------------------------------------------------
// fetchContactStatus — contact_project_status for a specific project
// ---------------------------------------------------------------------------

/**
 * Load the per-project status for a contact.
 * Returns null if no status row exists for this (contact, project) pair
 * (that is normal — it means no status has been set yet, not an error).
 */
export async function fetchContactStatus(
  contactId: number,
  projectId: number
): Promise<ContactProjectStatus | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_project_status')
    .select(
      'contact_id, project_id, contact_status, description, comments, updated_date'
    )
    .eq('contact_id', contactId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[AltLeads] fetchContactStatus error:', error.message);
    return null;
  }

  return data as ContactProjectStatus | null;
}

/**
 * Like fetchContactStatus but also retrieves owner_user_id, which the CRM's
 * getContactStatus (projectStatus.ts) includes.  Used to show the Owner field
 * in the Project Status section (read-only).
 */
export async function fetchContactStatusWithOwner(
  contactId: number,
  projectId: number
): Promise<ContactProjectStatusWithOwner | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_project_status')
    .select(
      'contact_id, project_id, contact_status, description, comments, owner_user_id, updated_date'
    )
    .eq('contact_id', contactId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[AltLeads] fetchContactStatusWithOwner error:', error.message);
    return null;
  }

  return data as ContactProjectStatusWithOwner | null;
}

// ---------------------------------------------------------------------------
// fetchActivityFeed — interaction table (last N entries for a contact)
// ---------------------------------------------------------------------------

/**
 * Load the last `limit` interaction rows for a contact.
 * Default limit = 5.  Returns [] on error.
 */
export async function fetchActivityFeed(
  contactId: number,
  limit = 5
): Promise<InteractionRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('interaction')
    .select(
      'interaction_id, record_type, record_id, project_id, type, ' +
      'disposition, note_text, occurred_at, created_by'
    )
    .eq('record_type', 'contact')
    .eq('record_id', contactId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AltLeads] fetchActivityFeed error:', error.message);
    return [];
  }

  return (data ?? []) as InteractionRecord[];
}

// ---------------------------------------------------------------------------
// fetchTasks — task table for a contact
// ---------------------------------------------------------------------------

/**
 * Load open tasks for a contact, ordered by due_at ascending.
 * Returns [] on error.
 */
export async function fetchTasks(contactId: number): Promise<TaskRecord[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('task')
    .select('task_id, contact_id, project_id, title, status, due_at, created_by')
    .eq('contact_id', contactId)
    .not('status', 'eq', 'done')        // only open tasks in the side panel
    .order('due_at', { ascending: true })
    .limit(10);

  if (error) {
    // The task table may not exist in older schema versions — degrade silently.
    if (error.code === '42P01') {
      console.warn('[AltLeads] task table not found (schema version mismatch). Skipping.');
      return [];
    }
    console.error('[AltLeads] fetchTasks error:', error.message);
    return [];
  }

  return (data ?? []) as TaskRecord[];
}

// ---------------------------------------------------------------------------
// resolveUserName — mirrors assignment.ts fetchUserLabel in the CRM
// ---------------------------------------------------------------------------

/**
 * Resolve a numeric user_id to a display name from user_master.
 * Returns "Unassigned" when userId is null/0, or "User #id" as a fallback.
 * Defensive: returns the fallback on any DB error.
 */
export async function resolveUserName(userId: number | null | undefined): Promise<string> {
  if (!userId) return 'Unassigned';
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_master')
    .select('full_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[AltLeads] resolveUserName error:', error.message);
    return `User #${userId}`;
  }

  const name = ((data as { full_name: string | null } | null)?.full_name ?? '').trim();
  return name || `User #${userId}`;
}

// ---------------------------------------------------------------------------
// fetchCompanyContacts — colleagues at the same company
// ---------------------------------------------------------------------------

/**
 * Load all contacts at a given company from contact_master_masked.
 * Mirrors fetchCompanyContacts in new-code/web/src/data/companies.ts.
 * PII columns (email, mobile_no, linkedin_url) are intentionally excluded —
 * the side panel only shows name + designation for colleagues (read-only).
 * Returns [] on error.
 */
export async function fetchCompanyContacts(
  companyId: number
): Promise<CompanyContact[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contact_master_masked')
    .select('contact_id, full_name, designation, city_name')
    .eq('company_id', companyId)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('[AltLeads] fetchCompanyContacts error:', error.message);
    return [];
  }

  return (data ?? []) as CompanyContact[];
}

// ---------------------------------------------------------------------------
// fetchProjects — list of projects the user can see (for project selector)
// ---------------------------------------------------------------------------

export interface ProjectOption {
  project_id: number;
  project_name: string;
}

/**
 * Load the list of projects accessible to the current user.
 * Mirrors the web CRM's fetchProjects in new-code/web/src/data/companies.ts —
 * queries `project` (the canonical table; there is no project_master in use).
 * RLS ensures the user only sees projects they have access to.
 * Returns [] on error.
 */
export async function fetchProjects(): Promise<ProjectOption[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('project')
    .select('project_id, project_name')
    .is('deleted_date', null)
    .order('project_name', { ascending: true });

  if (error) {
    console.error('[AltLeads] fetchProjects error:', error.message);
    return [];
  }

  return (data ?? []) as ProjectOption[];
}
