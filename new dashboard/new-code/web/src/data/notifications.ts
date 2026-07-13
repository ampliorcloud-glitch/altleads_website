/**
 * notifications.ts — Notification Center data layer (ALT-489).
 *
 * Thin wrappers around the in_app_notification helpers already in data/account.ts.
 * All functions are no-ops / return empty when NOTIFICATIONS is false so the
 * flag is the single switch for the entire feature.
 *
 * Real table columns (verified from live schema 2026-06-29):
 *   notification_id (bigint PK, auto-increment)
 *   user_id         (bigint  — the RECIPIENT)
 *   notif_descr     (varchar — body / message text)
 *   status          (varchar — used as the human-readable title / label)
 *   lead_number     (varchar)
 *   route           (varchar — client-side navigation path on click)
 *   is_seen         (bool)
 *   lead_id         (bigint, nullable)
 *   report_id       (bigint, nullable)
 *   meeting_id      (bigint, nullable)
 *   created_by      (varchar)
 *   created_date    (timestamp)
 *   updated_by      (varchar, nullable)
 *   updated_date    (timestamp, nullable)
 *   deleted_by      (varchar, nullable)
 *   deleted_date    (timestamp, nullable)
 *
 * TODO(notify-service): createNotification writes directly via the anon/session
 * key which means RLS Group E (self + admin) constrains who can INSERT for
 * another user. Creating notifications for OTHER users should route through the
 * service-role notify-service / event-spine once that is wired up.
 */

import { NOTIFICATIONS } from '../lib/notificationsFlag';
import {
  fetchNotifications,
  markNotificationSeen,
  markAllNotificationsSeen,
  fetchUnreadNotifCount,
  type AppNotification,
} from './account';
import { supabase } from '../lib/supabase';

export type { AppNotification };

/* ── read ──────────────────────────────────────────────────────────── */

/**
 * List the most recent notifications for a user (newest first).
 * Returns [] when NOTIFICATIONS is false.
 */
export async function listNotifications(
  userId: number | null,
  limit = 20,
): Promise<{ notifications: AppNotification[]; error: string | null }> {
  if (!NOTIFICATIONS || userId == null) return { notifications: [], error: null };
  const result = await fetchNotifications(userId);
  return {
    notifications: result.notifications.slice(0, limit),
    error: result.error,
  };
}

/**
 * Count of unread notifications for the badge.
 * Returns 0 when NOTIFICATIONS is false.
 */
export async function unreadCount(userId: number | null): Promise<number> {
  if (!NOTIFICATIONS || userId == null) return 0;
  return fetchUnreadNotifCount(userId);
}

/* ── write ─────────────────────────────────────────────────────────── */

/**
 * Mark a single notification as read.
 * No-op when NOTIFICATIONS is false.
 */
export async function markRead(
  notificationId: number,
  actor: string,
  userId?: number | null,
): Promise<{ error: string | null }> {
  if (!NOTIFICATIONS) return { error: null };
  return markNotificationSeen(notificationId, actor, userId);
}

/**
 * Mark every unread notification for a user as read.
 * No-op when NOTIFICATIONS is false.
 */
export async function markAllRead(
  userId: number,
  actor: string,
): Promise<{ error: string | null }> {
  if (!NOTIFICATIONS) return { error: null };
  return markAllNotificationsSeen(userId, actor);
}

/* ── create ─────────────────────────────────────────────────────────── */

export interface CreateNotificationInput {
  recipientUserId: number;
  /** Human-readable label shown as the notification title (maps to `status`). */
  type: string;
  /** Short descriptive text (maps to `notif_descr`). */
  title: string;
  /** Optional longer body — appended to title when provided. */
  body?: string;
  /** Client-side route for click navigation (e.g. `/leads/123`). */
  route?: string;
  /** Legacy FK columns — pass when available for deep-linking. */
  leadId?: number;
  reportId?: number;
  meetingId?: number;
  actor?: string;
}

/**
 * Insert one in_app_notification row for the given recipient.
 * Fire-and-forget safe: errors are caught and returned, never thrown.
 * No-op (returns null) when NOTIFICATIONS is false.
 *
 * TODO(notify-service): writes for OTHER users should route through the
 * service-role notify-service / event-spine to respect RLS Group E.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<{ error: string | null }> {
  if (!NOTIFICATIONS) return { error: null };
  if (!input.recipientUserId || input.recipientUserId <= 0) return { error: null };

  const descr = input.body
    ? `${input.title} — ${input.body}`
    : input.title;

  const now = new Date().toISOString();
  const { error } = await supabase.from('in_app_notification').insert({
    user_id: input.recipientUserId,
    status: input.type,
    notif_descr: descr,
    route: input.route ?? null,
    lead_id: input.leadId ?? null,
    report_id: input.reportId ?? null,
    meeting_id: input.meetingId ?? null,
    is_seen: false,
    created_by: input.actor ?? 'system',
    created_date: now,
  });

  return { error: error?.message ?? null };
}
