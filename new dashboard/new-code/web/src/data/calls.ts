/**
 * Call module — data layer (ALT-269 / owner feedback #6).
 *
 * Supabase CRUD for the LOGGED-CALL ledger (public.call_log): a call that
 * already HAPPENED, with disposition/outcome, notes, duration and timestamp,
 * tied to a lead / company / contact / meeting.
 *
 * This is the SIBLING of the Task Manager (data/tasks.ts). Scheduling a FUTURE
 * call still lives in the Task Manager (task_type='CALL' with due_at + reminders)
 * — this module is NOT scheduling. It is the "this call already happened" record
 * that powers the dashboard "Calls today" stat and the per-record call history.
 *
 * Types here mirror the canonical `public.call_log` data contract EXACTLY
 * (column names + enums) so the migration and the frontend never drift. The
 * table is staged (migration not yet applied), so at runtime queries will error
 * until it is applied — that is expected; only TS compilation is required now.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER-DEFAULT decisions baked into this module (capture in code like
 * data/meetings.ts so the owner can refine):
 *
 *  - DISPOSITION set (B2B outreach). Mirrors call_log_disposition_chk:
 *      CONNECTED, NO_ANSWER, BUSY, WRONG_NUMBER, LEFT_VOICEMAIL,
 *      CALLBACK_REQUESTED, NOT_INTERESTED, INTERESTED, FOLLOW_UP
 *  - DIRECTION: OUTBOUND (default) / INBOUND.
 *
 * FUTURE CALLING-TOOL SEAM: `recording_url` and `transcript` are NULLABLE and
 * are left NULL by logCall(). They exist so that when a real calling tool is
 * integrated (click-to-dial / VoIP), it can attach the audio recording URL and
 * the call transcript to the same row — no schema change needed then.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------ */
/*  Enums (match the CHECK constraints in the migration exactly)        */
/* ------------------------------------------------------------------ */

export type CallDirection = 'OUTBOUND' | 'INBOUND';

export type CallDisposition =
  | 'CONNECTED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'WRONG_NUMBER'
  | 'LEFT_VOICEMAIL'
  | 'CALLBACK_REQUESTED'
  | 'NOT_INTERESTED'
  | 'INTERESTED'
  | 'FOLLOW_UP';

/**
 * OWNER-DEFAULT disposition options (value + human label), in the order shown in
 * the Log-call modal. Keep in lockstep with the call_log_disposition_chk set.
 */
export const CALL_DISPOSITIONS: { value: CallDisposition; label: string }[] = [
  { value: 'CONNECTED', label: 'Connected' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'FOLLOW_UP', label: 'Follow-up needed' },
  { value: 'CALLBACK_REQUESTED', label: 'Callback requested' },
  { value: 'LEFT_VOICEMAIL', label: 'Left voicemail' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'BUSY', label: 'Busy' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
  { value: 'WRONG_NUMBER', label: 'Wrong number' },
];

export const CALL_DIRECTIONS: { value: CallDirection; label: string }[] = [
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'INBOUND', label: 'Inbound' },
];

/** Human label for a disposition value (falls back to the raw value). */
export function dispositionLabel(d: string | null | undefined): string {
  if (!d) return '';
  return CALL_DISPOSITIONS.find((o) => o.value === d)?.label ?? d;
}

/**
 * Tone for a disposition badge — green = good outcome, amber = needs follow-up,
 * red = dead/negative, gray = neutral. Used by the call-history list.
 */
export function dispositionTone(
  d: string | null | undefined,
): 'good' | 'warn' | 'bad' | 'neutral' {
  switch (d) {
    case 'CONNECTED':
    case 'INTERESTED':
      return 'good';
    case 'FOLLOW_UP':
    case 'CALLBACK_REQUESTED':
    case 'LEFT_VOICEMAIL':
      return 'warn';
    case 'NOT_INTERESTED':
    case 'WRONG_NUMBER':
      return 'bad';
    case 'NO_ANSWER':
    case 'BUSY':
    default:
      return 'neutral';
  }
}

/* ------------------------------------------------------------------ */
/*  Row + input shapes                                                  */
/* ------------------------------------------------------------------ */

/**
 * A row of `public.call_log`. Column names are the canonical contract — do not
 * rename without changing the migration in lockstep.
 */
export interface CallLog {
  call_id: number;
  direction: CallDirection;
  disposition: CallDisposition;
  notes: string | null;
  duration_seconds: number | null;
  called_at: string;
  lead_id: number | null;
  company_id: number | null;
  contact_id: number | null;
  meeting_id: number | null;
  assoc_label: string | null;
  assoc_phone: string | null;
  owner_user_id: number;
  /** FUTURE calling-tool seam — null until a calling integration attaches it. */
  recording_url: string | null;
  /** FUTURE calling-tool seam — null until a calling integration attaches it. */
  transcript: string | null;
  created_by: number | null;
  created_date: string;
  updated_date: string | null;
  deleted_date: string | null;
}

/** All `call_log` columns, as a single select projection (kept in sync with `CallLog`). */
const CALL_COLUMNS =
  'call_id, direction, disposition, notes, duration_seconds, called_at, ' +
  'lead_id, company_id, contact_id, meeting_id, assoc_label, assoc_phone, ' +
  'owner_user_id, recording_url, transcript, created_by, created_date, ' +
  'updated_date, deleted_date';

/**
 * Shape accepted by `logCall`. Server-maintained columns (call_id identity,
 * audit dates) are NOT part of the input. `owner_user_id` is the current user.
 * `recording_url` / `transcript` are intentionally omitted — the future calling
 * tool fills them; logCall always writes them NULL.
 */
export interface LogCallInput {
  direction?: CallDirection;
  disposition: CallDisposition;
  notes?: string | null;
  duration_seconds?: number | null;
  /** ISO timestamptz; defaults to now() at the DB if omitted. */
  called_at?: string | null;
  lead_id?: number | null;
  company_id?: number | null;
  contact_id?: number | null;
  meeting_id?: number | null;
  assoc_label?: string | null;
  assoc_phone?: string | null;
  owner_user_id: number;
  created_by?: number | null;
}

/** The record association a call is logged against (any subset). */
export interface CallRecordRef {
  leadId?: number | null;
  companyId?: number | null;
  contactId?: number | null;
  meetingId?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Log a call that already happened. Omits `call_id` (identity). Leaves the
 * future-seam columns (recording_url / transcript) NULL.
 */
export async function logCall(
  input: LogCallInput,
): Promise<{ call: CallLog | null; error: string | null }> {
  const payload = {
    direction: input.direction ?? 'OUTBOUND',
    disposition: input.disposition,
    notes: input.notes ?? null,
    duration_seconds: input.duration_seconds ?? null,
    // Only set called_at when provided; otherwise let the DB default (now()) win.
    ...(input.called_at ? { called_at: input.called_at } : {}),
    lead_id: input.lead_id ?? null,
    company_id: input.company_id ?? null,
    contact_id: input.contact_id ?? null,
    meeting_id: input.meeting_id ?? null,
    assoc_label: input.assoc_label ?? null,
    assoc_phone: input.assoc_phone ?? null,
    owner_user_id: input.owner_user_id,
    created_by: input.created_by ?? input.owner_user_id,
  };

  const { data, error } = await supabase
    .from('call_log')
    .insert(payload)
    .select(CALL_COLUMNS)
    .single();

  if (error) {
    console.error('[calls] logCall insert failed', error);
    return { call: null, error: humanizeWriteError(error) };
  }
  return { call: data as unknown as CallLog, error: null };
}

/* ------------------------------------------------------------------ */
/*  Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * List the logged calls tied to a record (lead / company / contact / meeting),
 * newest-first. Pass exactly one association id. Soft-deleted rows excluded.
 * Returns an empty list (not an error) when no id is supplied or none exist.
 */
export async function listCallsForRecord(
  ref: CallRecordRef,
): Promise<{ calls: CallLog[]; error: string | null }> {
  let query = supabase
    .from('call_log')
    .select(CALL_COLUMNS)
    .is('deleted_date', null);

  if (ref.leadId != null) query = query.eq('lead_id', ref.leadId);
  else if (ref.companyId != null) query = query.eq('company_id', ref.companyId);
  else if (ref.contactId != null) query = query.eq('contact_id', ref.contactId);
  else if (ref.meetingId != null) query = query.eq('meeting_id', ref.meetingId);
  else return { calls: [], error: null }; // no association supplied

  const { data, error } = await query.order('called_at', { ascending: false });
  if (error) {
    console.error('[calls] listCallsForRecord failed', error);
    return { calls: [], error: humanizeWriteError(error) };
  }
  return { calls: (data ?? []) as unknown as CallLog[], error: null };
}

/**
 * List a user's logged calls (owner = userId), newest-first. RLS additionally
 * lets admins/managers read more, but this convenience read scopes to one owner
 * for a "My calls" view. Returns empty (not an error) when userId is null.
 */
export async function listMyCalls(
  userId: number | null,
): Promise<{ calls: CallLog[]; error: string | null }> {
  if (userId == null) return { calls: [], error: null };

  const { data, error } = await supabase
    .from('call_log')
    .select(CALL_COLUMNS)
    .eq('owner_user_id', userId)
    .is('deleted_date', null)
    .order('called_at', { ascending: false });

  if (error) {
    console.error('[calls] listMyCalls failed', error);
    return { calls: [], error: humanizeWriteError(error) };
  }
  return { calls: (data ?? []) as unknown as CallLog[], error: null };
}

/**
 * Count of calls logged TODAY (IST day boundary), for the dashboard "Calls
 * today" stat. Pass a userId to scope to that user's calls; pass null to count
 * ALL calls the caller is allowed to see (RLS still applies on the server).
 *
 * The day window is computed in IST (Asia/Kolkata, fixed +05:30, no DST) so the
 * count matches what an Indian user reads on the calendar regardless of the
 * browser timezone — consistent with the Task module's IST reasoning.
 */
export async function callStatsToday(
  userId: number | null,
): Promise<{ count: number; error: string | null }> {
  const { startISO, endISO } = istTodayWindow();

  let query = supabase
    .from('call_log')
    .select('call_id', { count: 'exact', head: true })
    .is('deleted_date', null)
    .gte('called_at', startISO)
    .lt('called_at', endISO);

  if (userId != null) query = query.eq('owner_user_id', userId);

  const { count, error } = await query;
  if (error) {
    console.error('[calls] callStatsToday failed', error);
    return { count: 0, error: humanizeWriteError(error) };
  }
  return { count: count ?? 0, error: null };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const IST_OFFSET_MIN = 5 * 60 + 30; // India observes no DST.
const MS_PER_MIN = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

/** [start, end) ISO instants bounding the current IST calendar day. */
function istTodayWindow(now: Date = new Date()): { startISO: string; endISO: string } {
  // Shift to IST wall clock, read the date, then build IST-midnight back in UTC.
  const shifted = new Date(now.getTime() + IST_OFFSET_MIN * MS_PER_MIN);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  const istMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MIN * MS_PER_MIN;
  return {
    startISO: new Date(istMidnightUtcMs).toISOString(),
    endISO: new Date(istMidnightUtcMs + MS_PER_DAY).toISOString(),
  };
}

/** Format a duration in seconds as "m:ss" (or "—" when unknown). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse a duration entered as either "mm:ss" or a plain seconds number into a
 * seconds integer. Returns null for blank/invalid input (= unknown duration).
 */
export function parseDuration(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(v);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  if (/^\d+$/.test(v)) return Number(v);
  return null;
}
