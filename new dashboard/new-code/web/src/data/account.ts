import { supabase } from '../lib/supabase';
import { humanizeWriteError } from '../lib/writeError';

/* ------------------------------------------------------------------
   Notifications  (in_app_notification)
------------------------------------------------------------------ */

export interface AppNotification {
  notificationId: number;
  description: string;
  status: string | null;
  leadNumber: string | null;
  route: string | null;
  isSeen: boolean;
  createdDate: string | null;
}

interface NotificationRow {
  notification_id: number;
  notif_descr: string | null;
  status: string | null;
  lead_number: string | null;
  route: string | null;
  is_seen: boolean;
  created_date: string | null;
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    notificationId: row.notification_id,
    description: row.notif_descr ?? '',
    status: row.status,
    leadNumber: row.lead_number,
    route: row.route,
    isSeen: row.is_seen,
    createdDate: row.created_date,
  };
}

/**
 * Fetch the logged-in user's notifications, newest first.
 * The in_app_notification table has a per-user `user_id` column, so we
 * filter by it. Returns an empty list (not an error) when the user has none.
 */
export async function fetchNotifications(
  userId: number | null,
): Promise<{ notifications: AppNotification[]; error: string | null }> {
  if (userId == null) {
    return { notifications: [], error: null };
  }

  const { data, error } = await supabase
    .from('in_app_notification')
    .select('notification_id, notif_descr, status, lead_number, route, is_seen, created_date')
    .eq('user_id', userId)
    .is('deleted_date', null)
    .order('created_date', { ascending: false })
    .limit(200);

  if (error) {
    return { notifications: [], error: error.message };
  }

  return {
    notifications: (data as NotificationRow[]).map(mapNotification),
    error: null,
  };
}

/**
 * Mark a single notification as seen.
 *
 * `userId` scopes the write to the caller's own row so one user can never mark
 * another user's notification as read (defence-in-depth while RLS is off). It
 * is optional to keep the call signature backward-compatible.
 */
export async function markNotificationSeen(
  notificationId: number,
  actor: string,
  userId?: number | null,
): Promise<{ error: string | null }> {
  let query = supabase
    .from('in_app_notification')
    .update({
      is_seen: true,
      updated_by: actor,
      updated_date: new Date().toISOString(),
    })
    .eq('notification_id', notificationId);

  if (userId != null) {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;

  return { error: error ? humanizeWriteError(error) : null };
}

/**
 * Count of unread (is_seen = false) in_app_notification rows for the current user.
 * Used by the Sidebar bell badge — mirrors fetchPendingCount() from approvals.ts.
 */
export async function fetchUnreadNotifCount(userId: number | null): Promise<number> {
  if (userId == null) return 0;
  const { count } = await supabase
    .from('in_app_notification')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_seen', false)
    .is('deleted_date', null);
  return count ?? 0;
}

/** Mark every unread notification for the user as seen. */
export async function markAllNotificationsSeen(
  userId: number,
  actor: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('in_app_notification')
    .update({
      is_seen: true,
      updated_by: actor,
      updated_date: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_seen', false);

  return { error: error ? humanizeWriteError(error) : null };
}

/* ------------------------------------------------------------------
   Profile  (user_master)
------------------------------------------------------------------ */

export interface UserProfile {
  userId: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  linkedinUrl: string;
  designationId: number | null;
  designationName: string | null;
}

interface UserRow {
  user_id: number;
  full_name: string | null;
  f_name: string | null;
  l_name: string | null;
  email: string | null;
  mobile_number: string | null;
  linkedin_url: string | null;
  designation_id: number | null;
}

export async function fetchUserProfile(
  userId: number,
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_master')
    .select('user_id, full_name, f_name, l_name, email, mobile_number, linkedin_url, designation_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }
  if (!data) {
    return { profile: null, error: 'Profile not found.' };
  }

  const row = data as UserRow;

  // Resolve designation name (optional FK).
  let designationName: string | null = null;
  if (row.designation_id != null) {
    const { data: desig } = await supabase
      .from('designation_master')
      .select('designation_name')
      .eq('designation_id', row.designation_id)
      .maybeSingle();
    designationName = (desig as { designation_name: string | null } | null)?.designation_name ?? null;
  }

  return {
    profile: {
      userId: row.user_id,
      fullName: row.full_name ?? '',
      firstName: row.f_name ?? '',
      lastName: row.l_name ?? '',
      email: row.email ?? '',
      mobileNumber: row.mobile_number ?? '',
      linkedinUrl: row.linkedin_url ?? '',
      designationId: row.designation_id,
      designationName,
    },
    error: null,
  };
}

export interface ProfileUpdate {
  fullName: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  linkedinUrl: string;
}

export async function updateUserProfile(
  userId: number,
  patch: ProfileUpdate,
  actor: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_master')
    .update({
      full_name: patch.fullName.trim() || null,
      f_name: patch.firstName.trim() || null,
      l_name: patch.lastName.trim() || null,
      mobile_number: patch.mobileNumber.trim() || null,
      linkedin_url: patch.linkedinUrl.trim() || null,
      updated_by: actor,
      updated_date: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return { error: error ? humanizeWriteError(error) : null };
}

/* ------------------------------------------------------------------
   Shared helpers
------------------------------------------------------------------ */

/** "12 Jun 2026" — matches the app-wide date format. */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Relative time, e.g. "3h ago" / "2d ago", falling back to a date. */
export function formatRelativeTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}
