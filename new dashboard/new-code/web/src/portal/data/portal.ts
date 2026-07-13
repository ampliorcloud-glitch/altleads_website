/**
 * Client Portal — DATA LAYER (the ONLY place portal pages read data from).
 *
 * Requires the portal schema applied to the DB AND added to Supabase API exposed
 * schemas; inert until then. (Apply: new-code/migration/apply-portal-foundation.cjs
 * + apply-portal-rls.cjs, then add `portal` to Supabase Dashboard → Settings → API →
 * Exposed schemas. Until both are done, every fetcher below resolves to an error /
 * empty and the UI degrades gracefully.)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DATA ISOLATION (non-negotiable): every read here goes through the `portal`
 * schema's SECURITY-INVOKER views (portal.portal_meetings / portal_notifications),
 * which read ONLY portal.meeting_snapshot — a denormalised, per-meeting photograph
 * carrying project_id + client_assoc_id + assigned_user_id, scoped by the portal RLS
 * policies (apply-portal-rls.cjs). This module NEVER queries public.* shared tables
 * (company_master / contact_master / lead_master / meeting_master / lead_report) and
 * NEVER imports any CRM page or CRM data module. That is what makes one client unable
 * to see another client's work on a shared company.
 *
 * Types below are derived 1:1 from the REAL view columns in
 * new-code/migration/apply-portal-foundation.cjs (§4a portal.portal_meetings,
 * §4c portal.portal_notifications) and the meeting_snapshot column set (§2).
 */
import { supabase } from '../../lib/supabase';

/**
 * The schema-scoped Supabase client. ALL portal reads/writes go through this so
 * we physically target the `portal` schema's views, never `public`.
 * (supabase.schema('portal') returns a client bound to that schema for PostgREST.)
 */
export const portalDb = supabase.schema('portal');

/** Name of the portal feedback table written by submitFeedback (service-applied later). */
const FEEDBACK_TABLE = 'meeting_feedback';

// ───────────────────────────── Types (from the real views) ─────────────────────────────

/**
 * A meeting LIST row — the lean subset of portal.portal_meetings the list needs.
 * (portal.portal_meetings exposes more columns; PortalMeetingDetail is the full row.)
 */
export interface PortalMeeting {
  meeting_id: number;
  project_id: number | null;
  client_assoc_id: number;
  assigned_user_id: number | null;
  /** Drives the feedback gate: feedback opens only once started_at <= now(). */
  started_at: string | null;
  company_name: string | null;
  company_city: string | null;
  meeting_name: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_mode: string | null;
  meeting_status: string | null;
  assigned_rep_name: string | null;
}

/** A pre-sales Q&A entry as stored in meeting_snapshot.pre_sales_qa (jsonb array). */
export interface PortalPreSalesQA {
  question: string | null;
  short_question: string | null;
  answer: string | null;
}

/**
 * FULL meeting detail — every column the SECURITY-INVOKER view portal.portal_meetings
 * selects (apply-portal-foundation.cjs §4a). This is the client-visible field set
 * (the vendor mobile MeetingDetails surface), nothing more.
 */
export interface PortalMeetingDetail {
  meeting_id: number;
  project_id: number | null;
  client_assoc_id: number;
  assigned_user_id: number | null;
  started_at: string | null;
  snapshot_source: string | null;

  // Company
  company_name: string | null;
  company_industry: string | null;
  company_city: string | null;
  company_turnover: string | null;
  company_size: string | null;
  company_sector: string | null;
  company_web_url: string | null;
  company_linkedin_url: string | null;

  // Address
  address_line_one: string | null;
  address_line_two: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;

  // Lead / contact
  lead_name: string | null;
  lead_designation: string | null;
  lead_email: string | null;
  lead_mobile_no: string | null;
  lead_alt_mobile_no: string | null;
  lead_linkedin_url: string | null;
  lead_role_and_resp: string | null;
  lead_area_of_interest: string | null;

  // Opportunity
  opportunity_title: string | null;
  opportunity_value: string | null;
  opportunity_description: string | null;
  sales_intelligence: string | null;

  // Meeting
  meeting_name: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_duration: string | null;
  meeting_mode: string | null;
  meeting_status: string | null;
  meeting_url: string | null;
  meeting_description: string | null;
  meeting_reason: string | null;
  scheduled_by_name: string | null;
  assigned_rep_name: string | null;

  // Pre-sales Q&A
  pre_sales_qa: PortalPreSalesQA[] | null;
  agenda_discussion: string | null;

  snapshot_taken_at: string | null;
  snapshot_refreshed_at: string | null;
}

/**
 * A read-only lead/contact lens — the subset of portal.portal_lead
 * (apply-portal-foundation.cjs §4b). Snapshot only; NOT the CRM lead page.
 */
export interface PortalLead {
  meeting_id: number;
  project_id: number | null;
  client_assoc_id: number;
  assigned_user_id: number | null;
  company_name: string | null;
  company_industry: string | null;
  company_city: string | null;
  company_web_url: string | null;
  company_linkedin_url: string | null;
  lead_name: string | null;
  lead_designation: string | null;
  lead_email: string | null;
  lead_mobile_no: string | null;
  lead_alt_mobile_no: string | null;
  lead_linkedin_url: string | null;
  lead_role_and_resp: string | null;
  lead_area_of_interest: string | null;
  opportunity_title: string | null;
  opportunity_value: string | null;
  opportunity_description: string | null;
  sales_intelligence: string | null;
  pre_sales_qa: PortalPreSalesQA[] | null;
}

/** A notification row — every column of portal.portal_notifications (§4c). */
export interface PortalNotification {
  notification_id: number;
  recipient_auth_uid: string;
  client_assoc_id: number;
  project_id: number | null;
  kind: string | null;
  body: string | null;
  route: string | null;
  is_read: boolean;
  read_at: string | null;
  created_date: string;
}

/** Input shape for submitting meeting feedback (written to portal.meeting_feedback). */
export interface PortalFeedbackInput {
  meeting_id: number;
  /** Free-text remark the rep records after the meeting. */
  remark: string;
  /** Optional structured outcome (e.g. 'interested' | 'not_interested' | 'follow_up'). */
  outcome?: string | null;
}

/** A discriminated result so callers can show a precise message without throwing. */
export type PortalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Column projections kept in sync with the view definitions above.
const MEETING_LIST_COLS =
  'meeting_id, project_id, client_assoc_id, assigned_user_id, started_at, ' +
  'company_name, company_city, meeting_name, meeting_date, meeting_time, ' +
  'meeting_mode, meeting_status, assigned_rep_name';

// ───────────────────────────── Fetchers ─────────────────────────────

/**
 * List the caller's meetings (RLS-scoped to their tenant/role by the portal policies).
 * Newest meeting_date first; nulls last.
 */
export async function fetchPortalMeetings(): Promise<PortalResult<PortalMeeting[]>> {
  const { data, error } = await portalDb
    .from('portal_meetings')
    .select(MEETING_LIST_COLS)
    .order('meeting_date', { ascending: false, nullsFirst: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as PortalMeeting[] };
}

/** Fetch ONE meeting's full detail by meeting_id (RLS still scopes visibility). */
export async function fetchPortalMeetingById(
  meetingId: number,
): Promise<PortalResult<PortalMeetingDetail | null>> {
  const { data, error } = await portalDb
    .from('portal_meetings')
    .select('*')
    .eq('meeting_id', meetingId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as unknown as PortalMeetingDetail | null) ?? null };
}

/** List the caller's own notifications, newest first (RLS: recipient + client scoped). */
export async function fetchPortalNotifications(): Promise<PortalResult<PortalNotification[]>> {
  const { data, error } = await portalDb
    .from('portal_notifications')
    .select('*')
    .order('created_date', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as PortalNotification[] };
}

/**
 * Submit meeting feedback. HARD GATE: feedback is allowed ONLY once the meeting has
 * STARTED (snapshot started_at <= now()). We re-read the snapshot's started_at here so
 * the guard cannot be bypassed by a stale client; the DB also enforces RLS/visibility.
 *
 * Inert until portal.meeting_feedback exists + the schema is exposed — in that state the
 * insert returns a clear error rather than throwing.
 */
export async function submitFeedback(
  input: PortalFeedbackInput,
): Promise<PortalResult<true>> {
  const remark = input.remark.trim();
  if (!remark) return { ok: false, error: 'Please enter your feedback before submitting.' };

  // Re-verify the meeting has started, server-truth via the snapshot view.
  const { data: meeting, error: readErr } = await portalDb
    .from('portal_meetings')
    .select('meeting_id, started_at')
    .eq('meeting_id', input.meeting_id)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!meeting) return { ok: false, error: 'Meeting not found or not visible to you.' };

  const startedAt = (meeting as { started_at: string | null }).started_at;
  if (!isMeetingStarted(startedAt)) {
    return { ok: false, error: 'Feedback becomes available once the meeting starts.' };
  }

  const { error: insertErr } = await portalDb.from(FEEDBACK_TABLE).insert({
    meeting_id: input.meeting_id,
    remark,
    outcome: input.outcome ?? null,
  });

  if (insertErr) return { ok: false, error: insertErr.message };
  return { ok: true, data: true };
}

/**
 * The single source of truth for the feedback gate: true once the meeting's
 * snapshot started_at is set AND in the past. Exported so the UI can disable the
 * feedback control with the exact same rule submitFeedback enforces.
 */
export function isMeetingStarted(startedAt: string | null | undefined): boolean {
  if (!startedAt) return false;
  const t = Date.parse(startedAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}
