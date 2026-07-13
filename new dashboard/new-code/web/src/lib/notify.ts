/**
 * notify.ts — fire-and-forget email + in-app notification helpers.
 *
 * All functions are non-blocking: they catch their own errors and never throw.
 * Callers do NOT need to await them (though they can if they want to log results).
 *
 * In-app notification columns (from approvals.ts schema comment):
 *   notification_id (bigint PK, auto), created_by, created_date,
 *   deleted_by, deleted_date, updated_by, updated_date,
 *   is_seen (bool), lead_number (varchar), notif_descr (varchar),
 *   route (varchar), status (varchar),
 *   lead_id (bigint), report_id (bigint), meeting_id (bigint), user_id (bigint)
 */

// In production (combined server), BASE_URL is empty so fetch hits the same origin.
// For local dev with separate servers (web=5173, notify=8787), set VITE_NOTIFY_URL=http://localhost:8787.
const NOTIFY_URL = (import.meta as any).env?.VITE_NOTIFY_URL || '';

import { supabase } from './supabase';

/* ── Email (via notify-service) ──────────────────────────────────── */

/**
 * Send an email notification via the notify microservice.
 * Fire-and-forget: errors are logged as warnings, never thrown.
 * Attaches the current Supabase session token if available; skips silently if not.
 */
export async function notify(
  event: string,
  toEmail: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!toEmail) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${NOTIFY_URL}/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, to: toEmail, data }),
    });
    if (!res.ok) {
      console.warn(`[notify] service responded ${res.status} for event "${event}"`);
    }
  } catch (err) {
    console.warn('[notify] email send failed (non-blocking):', err);
  }
}

/* ── In-app notification (Supabase) ─────────────────────────────── */

/**
 * Write an in_app_notification row for a single recipient.
 * Uses the exact column names confirmed from the live schema in approvals.ts:
 *   user_id, lead_id, report_id, meeting_id, lead_number,
 *   notif_descr, route, is_seen, status, created_by, created_date
 */
export async function notifyInApp(
  supabase: unknown,
  recipientUserId: number,
  opts: {
    status: string;        // human-readable label shown as notification title
    notif_descr: string;   // notification body text
    route: string;         // client-side route to navigate to on click
    lead_id?: number;
    report_id?: number;
    meeting_id?: number;
    lead_number?: string | null;
    actor?: string;        // created_by
  }
): Promise<void> {
  if (!recipientUserId || recipientUserId <= 0) return;
  try {
    const now = new Date().toISOString();
    await (supabase as any).from('in_app_notification').insert({
      user_id: recipientUserId,
      lead_id: opts.lead_id ?? null,
      report_id: opts.report_id ?? null,
      meeting_id: opts.meeting_id ?? null,
      lead_number: opts.lead_number ?? null,
      notif_descr: opts.notif_descr,
      route: opts.route,
      is_seen: false,
      status: opts.status,
      created_by: opts.actor ?? 'system',
      created_date: now,
    });
  } catch (err) {
    console.warn('[notify] in-app notification failed (non-blocking):', err);
  }
}

/* ── Resolve user email from user_master ─────────────────────────── */

/**
 * Look up both email and full_name for a user in one query.
 */
export async function resolveUserEmailAndName(
  supabase: unknown,
  userId: number | null | undefined
): Promise<{ email: string; name: string }> {
  if (!userId) return { email: '', name: '' };
  try {
    const { data } = await (supabase as any)
      .from('user_master')
      .select('email, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    const row = data as { email: string; full_name: string } | null;
    return { email: row?.email ?? '', name: row?.full_name ?? '' };
  } catch {
    return { email: '', name: '' };
  }
}
