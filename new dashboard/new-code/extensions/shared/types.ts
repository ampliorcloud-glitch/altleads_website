/**
 * shared/types.ts — Core types shared across both extensions.
 * Mirrors the CRM's table shapes (new-code/web/src/data/contacts.ts etc.)
 * but kept minimal — only the fields each extension actually reads.
 */

// ---------------------------------------------------------------------------
// Auth / identity
// ---------------------------------------------------------------------------

/** Subset of public.profiles we need inside the extension. */
export interface UserProfile {
  /** auth.uid() — the Supabase Auth UUID */
  auth_uid: string;
  /** profiles.user_id — the CRM numeric bigint, stored as a JS number */
  user_id: number;
  /** profiles.role — e.g. 'AGENT', 'ADMIN', 'TEAM_LEAD', etc. */
  role: string;
  /** display name if available */
  full_name?: string | null;
}

// ---------------------------------------------------------------------------
// Contact match (what find_contact_dup returns)
// ---------------------------------------------------------------------------

/** Row returned by the find_contact_dup() RPC. */
export interface ContactDupResult {
  contact_id: number;
  full_name: string;
  company_id: number | null;
  company_name: string | null;
}

/** Row returned by the find_contact_for_panel() RPC (ALT-282, may not exist yet). */
export interface ContactPanelResult {
  contact_id: number;
  full_name: string;
  company_id: number | null;
  company_name: string | null;
  company_status: string | null;
  contact_status: string | null;
  last_activity_at: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  can_view_details: boolean;
  email: string | null;
  mobile_no: string | null;
  linkedin_url: string | null;
}

// ---------------------------------------------------------------------------
// Contact detail (contact_master_masked view)
// ---------------------------------------------------------------------------

export interface ContactDetail {
  contact_id: number;
  full_name: string;
  email: string | null;
  mobile_no: string | null;
  alt_mobile_no: string | null;
  designation: string | null;
  linkedin_url: string | null;
  linkedin_clean: string | null;
  company_id: number | null;
  company_name: string | null;
  city_name: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_date: string | null;
}

// ---------------------------------------------------------------------------
// Associated records
// ---------------------------------------------------------------------------

/** A row from lead_master relevant to a contact. */
export interface LeadRecord {
  lead_id: number;
  contact_id: number | null;
  project_id: number | null;
  lead_status: string | null;
  lead_stage: string | null;
  lead_type: string | null;
  company_name: string | null;
  created_by: string | null;
  created_date: string | null;
}

/** A row from contact_project_status. */
export interface ContactProjectStatus {
  contact_id: number;
  project_id: number;
  contact_status: string | null;
  description: string | null;
  comments: string | null;
  updated_date: string | null;
}

/** A row from the interaction table (activity feed). */
export interface InteractionRecord {
  interaction_id: number;
  record_type: string;
  record_id: number;
  project_id: number | null;
  type: string;
  disposition: string | null;
  note_text: string | null;
  occurred_at: string;
  created_by: string | null;
}

/** A row from the task table. */
export interface TaskRecord {
  task_id: number;
  contact_id: number | null;
  project_id: number | null;
  title: string;
  status: string | null;
  due_at: string | null;
  created_by: string | null;
}

/** A colleague contact at the same company (from fetchCompanyContacts). */
export interface CompanyContact {
  contact_id: number;
  full_name: string;
  designation: string | null;
  city_name: string | null;
}

/**
 * Extended contact_project_status that also includes owner_user_id.
 * fetchContactStatusWithOwner returns this shape.
 */
export interface ContactProjectStatusWithOwner {
  contact_id: number;
  project_id: number;
  contact_status: string | null;
  description: string | null;
  comments: string | null;
  owner_user_id: number | null;
  updated_date: string | null;
}

// ---------------------------------------------------------------------------
// Research request (contact_research_request — ALT-282/R3; table may not exist yet)
// ---------------------------------------------------------------------------

export interface ResearchRequest {
  request_id: number;
  contact_id: number | null;
  company_id: number | null;
  linkedin_url: string | null;
  linkedin_clean: string | null;
  project_id: number | null;
  fields_needed: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'not_found';
  notes: string | null;
  requested_by: string | null;
  requested_at: string;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
}

/**
 * Discriminated union returned by researchRequests.ts helpers when an
 * operation cannot complete.  The caller maps each tag to a friendly UI state.
 *
 * - 'backend_not_ready' → Postgres 42P01 — table does not exist yet.
 * - 'forbidden'         → Postgres 42501 / PGRST301 — RLS denied the write.
 * - 'error'             → Any other failure; message carries details.
 */
export type ResearchRequestResult =
  | { tag: 'backend_not_ready' }
  | { tag: 'forbidden' }
  | { tag: 'error'; message: string };

// ---------------------------------------------------------------------------
// Extension messaging (background ↔ side panel)
// ---------------------------------------------------------------------------

/** Message posted from the background service worker to the side panel. */
export type BgMessage =
  | { type: 'TAB_URL'; url: string; slug: string }   // a /in/<slug> tab is active
  | { type: 'TAB_IDLE' };                             // active tab is not a LinkedIn profile
